# Design Document: firebase-read-optimization

## Overview

This design covers six targeted optimizations to reduce Firebase Firestore read quota usage in the Angular app. The current services issue redundant full-collection fetches on every subscription, scan entire collections to read single documents, and load all pages of data on every navigation. The optimizations fall into three categories:

1. **Shared observable caching** — `shareReplay(1)` + `localStorage` warm-start for static/infrequently-changing data (`BannerService`, `CategoryService`, `AboutContentService`, `TagService`).
2. **Point reads** — replace `getDocs(collection)` → `getDoc(doc(…, id))` for single-document fetches (`PostService.getPost`, `TripService.getTrip`, `TestimonialService.getTestimonial`).
3. **Server-side pagination** — add Firestore `limit()` + `startAfter()` cursor for admin list views (`PostService.getPosts`, `TripService.getTrips`, `TestimonialService.getTestimonials`).

No new dependencies are needed. All changes are internal to `src/app/core/services/`.

---

## Architecture

The app uses a layered read strategy that will remain unchanged:

```
Component → Service → [localStorage warm-start] → Firestore
                ↓
           shareReplay(1) multicasts to all subscribers
```

After these changes the flow for cached services becomes:

```
First call:  localStorage (sync emit) → Firestore getDocs/getDoc → shareReplay cache
Subsequent:  shareReplay cache (no Firestore call)
After write: cache invalidated → next call starts flow again from top
```

For paginated admin lists:

```
getPosts({ page: 1, limit: 10 })  → Firestore query with limit(10)
getPosts({ page: 2, limit: 10 })  → Firestore query with limit(10) + startAfter(cursor)
filter change                     → cursor reset → same as page 1
```

---

## Components and Interfaces

### PaginatedResponse (extended)

`PaginatedResponse<T>` is currently defined identically in `PostService`, `TripService`, and `TestimonialService`. The pagination feature adds one field:

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;        // total matching docs (client-side count for admin)
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean; // NEW: true when a next-page cursor is available
}
```

### BannerService (modified)

```typescript
private banners$: Observable<Banner[]> | null = null;
private readonly cacheKey = 'unitur_banners_cache';

getBanners(): Observable<Banner[]>          // adds shareReplay + localStorage warm-start
getActiveBanners(): Observable<Banner[]>    // unchanged (delegates to getBanners())
createBanner(...): Observable<Banner>       // calls invalidateCache() on completion
updateBanner(...): Observable<Banner>       // calls invalidateCache() on completion
deleteBanner(...): Observable<void>         // calls invalidateCache() on completion
reorderBanners(...): Observable<void>       // calls invalidateCache() on completion
private invalidateCache(): void             // sets banners$ = null; removes localStorage entry
```

`BrowserStorageService` is injected (constructor param added).

### CategoryService (modified)

```typescript
private categories$: Observable<Category[]> | null = null;
private readonly cacheKey = 'unitur_categories_cache';

getAllCategories(): Observable<Category[]>           // shared observable with shareReplay + localStorage warm-start
getCategories(filters?): Observable<PaginatedResponse<Category>> // delegates to getAllCategories(), filters in-memory
createCategory(...): Observable<Category>            // calls invalidateCache() on completion
updateCategory(...): Observable<Category>            // calls invalidateCache() on completion
deleteCategory(...): Observable<void>                // calls invalidateCache() on completion
private invalidateCache(): void                      // sets categories$ = null; removes localStorage entry
```

`BrowserStorageService` is injected (constructor param added).

### AboutContentService (modified)

```typescript
private load$: Observable<SiteAboutContent> | null = null;

load(): Observable<SiteAboutContent>   // wraps existing logic in shareReplay, caches in load$
save(...): Observable<SiteAboutContent> // sets load$ = null on completion
```

### PostService (modified)

```typescript
// Single-document read
getPost(id: number): Observable<Post>  // uses getDoc(doc(firestore, 'posts', String(id)))

// Server-side paginated admin list
private adminCursor: DocumentSnapshot | null = null;
getPosts(filters?: PostFilters): Observable<PaginatedResponse<Post>>  // adds limit() + startAfter()
resetPagination(): void                                                // clears adminCursor
```

`PostFilters` gains an optional `adminPagination?: boolean` flag (or the cursor is applied whenever `filters.page > 1`). The simpler approach used here: cursor is stored in the service; `getPosts` always passes `limit(filters.limit ?? 10)` to Firestore; cursor is set after each successful page load; `resetPagination()` and filter-change detection both clear it.

### TripService (modified)

```typescript
getTrip(id: number): Observable<Trip>  // uses getDoc(doc(firestore, 'trips', String(id)))
getTrips(filters?: TripFilters): Observable<PaginatedResponse<Trip>>  // adds limit() + startAfter() when filters.limit is set
private adminCursor: DocumentSnapshot | null = null;
resetPagination(): void
```

The public `getTrips({ status: 'active', limit: 100 })` call remains untouched in behavior: it simply sends `limit(100)` server-side (which it should anyway) with no cursor, so it fetches up to 100 active trips in one query.

### TestimonialService (modified)

```typescript
getTestimonial(id: number): Observable<Testimonial>  // uses getDoc(doc(firestore, 'testimonials', String(id)))
getTestimonials(filters?): Observable<PaginatedResponse<Testimonial>>  // adds limit() + startAfter()
private adminCursor: DocumentSnapshot | null = null;
resetPagination(): void
```

### TagService (unchanged)

`TagService` already implements `shareReplay({ bufferSize: 1, refCount: false })` and cache invalidation on `createTag()`. No changes needed; the design documents the pattern as the reference implementation.

---

## Data Models

### LocalStorage cache entries

| Key | Service | Content |
|-----|---------|---------|
| `unitur_banners_cache` | BannerService | `Banner[]` serialized as JSON |
| `unitur_categories_cache` | CategoryService | `Category[]` serialized as JSON |

Existing keys used by `PostService` (`unitur_admin_posts`), `TripService` (`unitur_admin_trips`), and `TestimonialService` (`unitur_admin_testimonials`) are not changed — they continue to serve as localStorage fallbacks for the single-document and list operations.

### Firestore document paths used by point reads

| Method | Firestore path |
|--------|---------------|
| `PostService.getPost(id)` | `posts/{id}` |
| `TripService.getTrip(id)` | `trips/{id}` |
| `TestimonialService.getTestimonial(id)` | `testimonials/{id}` |

Document IDs are `String(id)` (the numeric timestamp cast to string), consistent with how `setDoc` stores them.

### Pagination cursor state

Each paginated service holds:

```typescript
private adminCursor: DocumentSnapshot | null = null;
// Set to last document of the page after each successful Firestore read.
// Cleared by resetPagination() and by filter-change detection.
```

Filter-change detection: the service stores the last applied filter hash; if the current filter differs, it calls `resetPagination()` before building the query.

```typescript
private lastFilterHash: string = '';
private hashFilters(f: PostFilters | TripFilters | TestimonialFilters): string {
  const { page: _p, ...rest } = f as Record<string, unknown>;
  return JSON.stringify(rest);
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Shared observable deduplication (cached services)

*For any* number of concurrent subscribers calling `getBanners()`, `getAllCategories()`, or `load()` (AboutContentService), the underlying Firestore `getDocs`/`getDoc` function SHALL be invoked exactly once regardless of subscriber count, and every subscriber SHALL receive the same data.

**Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2**

### Property 2: Mutation invalidates cache

*For any* mutation operation (create, update, delete, reorder) on a cached service (`BannerService`, `CategoryService`, `AboutContentService`), after the mutation completes, the next call to the read method SHALL issue a new Firestore request rather than returning the stale cached observable.

**Validates: Requirements 1.3, 2.3, 3.3**

### Property 3: localStorage persistence round-trip

*For any* list of items returned by a Firestore read in `BannerService` or `CategoryService`, after `getBanners()` / `getAllCategories()` resolves, reading the respective `localStorage` key SHALL return data equivalent to the Firestore result.

**Validates: Requirements 1.4, 2.4**

### Property 4: Firestore error falls back to localStorage

*For any* localStorage cache state containing N items, when the Firestore read throws an error or times out, `getBanners()` / `getAllCategories()` SHALL return those N items (or an empty array if the cache is empty).

**Validates: Requirements 1.5, 2.5**

### Property 5: getCategories filter correctness

*For any* list of categories and any filter predicate, `getCategories(filters)` SHALL return only categories satisfying the filter, and SHALL issue no more Firestore requests than a bare `getAllCategories()` call in the same session.

**Validates: Requirements 2.6**

### Property 6: Point read uses getDoc not getDocs

*For any* document id, calling `PostService.getPost(id)`, `TripService.getTrip(id)`, or `TestimonialService.getTestimonial(id)` SHALL invoke `getDoc` with the correct document path and SHALL NOT invoke `getDocs` on the full collection.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 7: Point read localStorage fallback

*For any* id present in the relevant `localStorage` cache but absent from (or timed-out in) Firestore, the single-document fetch (`getPost`, `getTrip`, `getTestimonial`) SHALL return the locally cached item rather than throwing.

**Validates: Requirements 4.4, 4.5**

### Property 8: Paginated query respects limit

*For any* `pageSize` value, a call to `getPosts({ limit: pageSize })`, `getTrips({ limit: pageSize })`, or `getTestimonials({ limit: pageSize })` SHALL construct a Firestore query that includes `limit(pageSize)`, so at most `pageSize` documents are transferred per request.

**Validates: Requirements 5.1, 5.6, 5.7**

### Property 9: Pagination cursor advances correctly

*For any* sequence of page-navigation calls (page 1 → page 2 → page N), each call after the first SHALL include `startAfter(cursorFromPreviousPage)` in the Firestore query, and the cursor SHALL correspond to the last document returned on the previous page.

**Validates: Requirements 5.2**

### Property 10: Filter change resets cursor

*For any* two distinct filter configurations (differing in search, categoryId, or status, ignoring the `page` field), transitioning from one to the other SHALL clear the pagination cursor so the next query starts from the beginning of the collection.

**Validates: Requirements 5.4**

### Property 11: hasNextPage invariant

*For any* `PaginatedResponse` returned by a paginated list method, `hasNextPage` SHALL be `true` if and only if the Firestore query returned exactly `pageSize` documents (indicating there may be more), and `false` otherwise.

**Validates: Requirements 5.5**

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Firestore timeout on `getBanners()` / `getAllCategories()` | Return `localStorage` value; set `banners$` / `categories$` to `null` so next call retries |
| Firestore timeout on `load()` (AboutContentService) | Return `localStorage` value; set `load$` to `null` |
| Firestore timeout on `getPost(id)` / `getTrip(id)` / `getTestimonial(id)` | Fall back to `localStorage` entry for that id; throw if not found |
| `getDoc` returns non-existent document | Fall back to `localStorage`; throw "not found" if absent |
| `localStorage` write fails (quota/private mode) | `BrowserStorageService` swallows silently; service continues with in-memory cache only |
| Pagination cursor is stale (document was deleted) | Firestore returns the next available document; behavior is acceptable for admin use |
| Filter change while paginating | `resetPagination()` is called automatically before new query; cursor cleared |

Cache invalidation on error: when `getBanners()` / `getAllCategories()` catches an error, the cached `Observable` reference is set to `null` so the next subscriber triggers a fresh attempt. This mirrors the existing pattern in `TagService`.

---

## Testing Strategy

### Unit tests (example-based)

- `resetPagination()` clears the cursor and the next `getPosts()` query has no `startAfter`
- `getTrips({ status: 'active', limit: 100 })` (public-facing) returns correct results with `limit(100)` and no cursor
- `BannerService.getBanner(id)` (which uses `getBanners()`) still returns the correct item from the shared cache
- `CategoryService.getCategory(id)` still resolves through the shared `getAllCategories()` cache

### Property-based tests

This project does not currently have a property-based testing library. The recommended library for Angular/TypeScript is **fast-check** (`npm install --save-dev fast-check`).

Each property test must run a **minimum of 100 iterations**. Tag each test with a comment:
`// Feature: firebase-read-optimization, Property N: <property_text>`

**Property 1** — Shared observable deduplication  
Generate a random subscriber count (2–10). Verify `getDocs`/`getDoc` spy call count === 1.

**Property 2** — Mutation invalidates cache  
Parameterize over mutation method names. After any mutation, verify the next read call increments the spy counter.

**Property 3** — localStorage persistence round-trip  
Generate a random `Banner[]` / `Category[]`. Mock Firestore to return it. After the read resolves, parse the `localStorage` entry and deep-equal compare.

**Property 4** — Firestore error falls back to localStorage  
Seed `localStorage` with a random array. Mock Firestore to reject. Verify the observable emits the seeded data.

**Property 5** — getCategories filter correctness  
Generate a random `Category[]` and a random filter. Verify every item in the result satisfies the filter predicate.

**Property 6** — Point read uses getDoc not getDocs  
Generate a random numeric id. Spy on `getDoc` and `getDocs`. Verify `getDoc` called once with correct path, `getDocs` never called.

**Property 7** — Point read localStorage fallback  
Seed localStorage with a random item. Mock `getDoc` to return non-existent. Verify the service returns the cached item.

**Property 8** — Paginated query respects limit  
Generate a random `pageSize` (1–50). Spy on Firestore query builder. Verify the `limit` constraint equals `pageSize`.

**Property 9** — Pagination cursor advances correctly  
Generate a random sequence of page calls (length 2–5). Verify each call after the first passes `startAfter` with the last doc from the previous page.

**Property 10** — Filter change resets cursor  
Generate two distinct filter objects. Apply first, advance to page 2, apply second. Verify the query for the second filter has no `startAfter`.

**Property 11** — hasNextPage invariant  
Generate random `(totalDocs, pageSize, page)`. Verify `hasNextPage` === (number of docs returned === pageSize).
