# Requirements Document

## Introduction

This feature optimizes Firebase Firestore read operations across the Angular application to reduce quota consumption and improve performance. The current implementation has several patterns that result in excessive reads: services with no caching, per-subscriber full-collection fetches, and single-document lookups that scan the entire collection. The optimization targets five categories of fixes: shared reactive caching for static data services, `getDoc` for single-document fetches, deduplication of concurrent identical reads, `shareReplay` for singleton observables, and server-side `limit()` with cursor-based pagination for admin list views.

## Glossary

- **BannerService**: Angular service that reads the `banners` Firestore collection.
- **CategoryService**: Angular service that reads the `categories` Firestore collection.
- **AboutContentService**: Angular service that reads the `siteContent/about` Firestore document.
- **PostService**: Angular service that reads and writes the `posts` Firestore collection.
- **TripService**: Angular service that reads and writes the `trips` Firestore collection.
- **TestimonialService**: Angular service that reads and writes the `testimonials` Firestore collection.
- **TagService**: Angular service that reads the `tags` Firestore collection.
- **Cache**: An in-memory shared Observable (via `shareReplay`) and/or a `localStorage` entry that prevents redundant Firestore reads within the same browser session.
- **shareReplay(1)**: RxJS operator that multicasts the last emitted value to all current and future subscribers without re-executing the upstream source.
- **getDoc**: Firestore SDK function that reads a single document by its full path, consuming exactly one read unit.
- **getDocs**: Firestore SDK function that reads all documents matching a query, consuming one read unit per document returned.
- **cursor-based pagination**: Server-side pagination using `startAfter(lastDoc)` + `limit(n)` so only the requested page is fetched from Firestore.
- **PaginatedResponse**: TypeScript interface describing `{ data, total, page, limit, totalPages }` returned by list methods.
- **Admin list view**: A component inside `src/app/features/admin/` that shows a paginated table of Firestore documents (posts, trips, testimonials, categories).
- **localStorage cache**: A serialized JSON entry in `BrowserStorageService` used as a fallback and warm-start for Firestore reads.

---

## Requirements

### Requirement 1: Shared reactive cache for BannerService

**User Story:** As a site visitor, I want the banner images to load immediately on repeated page visits, so that I do not see a blank hero section while Firestore is queried again.

#### Acceptance Criteria

1. THE BannerService SHALL expose a single shared Observable for `getBanners()` that multicasts the Firestore result to all subscribers using `shareReplay({ bufferSize: 1, refCount: false })`.
2. WHEN `getBanners()` is called a second time within the same browser session, THE BannerService SHALL return the cached Observable without issuing a new Firestore `getDocs` request.
3. WHEN `createBanner()`, `updateBanner()`, `deleteBanner()`, or `reorderBanners()` completes successfully, THE BannerService SHALL invalidate the in-memory cache so the next call to `getBanners()` fetches fresh data.
4. THE BannerService SHALL persist the last-fetched banner list to `localStorage` under the key `unitur_banners_cache` so subsequent cold page loads can render immediately from cache before the Firestore response arrives.
5. IF the Firestore read times out or errors, THEN THE BannerService SHALL return the cached `localStorage` value, or an empty array if no cache entry exists.

---

### Requirement 2: Shared reactive cache for CategoryService

**User Story:** As a blog reader and admin user, I want category data to load once per session regardless of how many components request it simultaneously, so that the same page load does not trigger multiple identical Firestore reads.

#### Acceptance Criteria

1. THE CategoryService SHALL expose a single shared Observable for `getAllCategories()` that multicasts the Firestore result using `shareReplay({ bufferSize: 1, refCount: false })`.
2. WHEN `getAllCategories()` is called concurrently by `BlogListComponent` and `PostsListComponent` on the same page load, THE CategoryService SHALL issue exactly one Firestore `getDocs` request and deliver the same result to both subscribers.
3. WHEN `createCategory()`, `updateCategory()`, or `deleteCategory()` completes successfully, THE CategoryService SHALL invalidate the in-memory cache so the next call to `getAllCategories()` fetches fresh data.
4. THE CategoryService SHALL persist the fetched category list to `localStorage` under the key `unitur_categories_cache` and return it as the immediate synchronous value while the Firestore request is in-flight.
5. IF the Firestore read times out or errors, THEN THE CategoryService SHALL return the cached `localStorage` value, or an empty array if no cache entry exists.
6. THE `getCategories(filters?)` method SHALL reuse the same shared Observable from `getAllCategories()` and apply filters in-memory, so it does not issue a separate Firestore query.

---

### Requirement 3: shareReplay for AboutContentService.load()

**User Story:** As a site visitor, I want the about/institutional content to be fetched only once even when multiple components on the same page call `load()`, so that the home page does not trigger redundant Firestore reads.

#### Acceptance Criteria

1. THE AboutContentService SHALL cache the result of `load()` in a private `load$` property using `shareReplay({ bufferSize: 1, refCount: false })`.
2. WHEN `load()` is called more than once before the first call resolves, THE AboutContentService SHALL not issue additional Firestore `getDoc` requests.
3. WHEN `save()` is called successfully, THE AboutContentService SHALL reset the `load$` cache so the next call to `load()` fetches fresh data.

---

### Requirement 4: Single-document reads for getPost, getTrip, getTestimonial

**User Story:** As a site visitor or admin user navigating to a detail page, I want the single-item fetch to read only that one document from Firestore, so that loading one record does not consume read quota proportional to the whole collection.

#### Acceptance Criteria

1. WHEN `PostService.getPost(id)` is called, THE PostService SHALL read the document at path `posts/{id}` using `getDoc(doc(firestore, 'posts', String(id)))` instead of `getDocs` on the full collection.
2. WHEN `TripService.getTrip(id)` is called, THE TripService SHALL read the document at path `trips/{id}` using `getDoc(doc(firestore, 'trips', String(id)))` instead of `getDocs` on the full collection.
3. WHEN `TestimonialService.getTestimonial(id)` is called, THE TestimonialService SHALL read the document at path `testimonials/{id}` using `getDoc(doc(firestore, 'testimonials', String(id)))` instead of `getDocs` on the full collection.
4. IF the Firestore document does not exist for the given id, THEN the respective service SHALL fall back to the `localStorage` cache before throwing a "not found" error.
5. IF the Firestore read times out, THEN the respective service SHALL fall back to the `localStorage` cache entry for that id, or throw if no local entry exists.

---

### Requirement 5: Server-side pagination with limit() and startAfter() for admin list views

**User Story:** As an admin user browsing the posts, trips, or testimonials list, I want each page navigation to fetch only the current page from Firestore, so that the application does not download the entire collection on every list view.

#### Acceptance Criteria

1. WHEN `PostService.getPosts(filters)` is called from an admin list component, THE PostService SHALL apply a Firestore `limit(pageSize)` constraint to the query so at most `pageSize` documents are transferred per request.
2. WHEN the admin navigates to a subsequent page, THE PostService SHALL use `startAfter(lastDocumentSnapshot)` to fetch only the next page from Firestore rather than re-fetching the full collection.
3. THE PostService SHALL expose a `resetPagination()` method that clears the current cursor so the next `getPosts()` call starts from the beginning of the collection.
4. WHEN a filter (search, categoryId, status) changes, THE PostService SHALL reset the pagination cursor automatically and re-query from the first page.
5. THE `PaginatedResponse` returned by `getPosts()` SHALL include a `hasNextPage: boolean` field derived from whether a next-page document cursor is available.
6. WHEN `TripService.getTrips(filters)` is called from an admin list component with an explicit `limit` filter, THE TripService SHALL apply the same server-side `limit()` + `startAfter()` pattern.
7. WHEN `TestimonialService.getTestimonials(filters)` is called from an admin list component with an explicit `limit` filter, THE TestimonialService SHALL apply the same server-side `limit()` + `startAfter()` pattern.
8. THE public-facing `getTrips()` call (used by `ViagensComponent` and `HomeComponent`) with `limit: 100` SHALL continue to function correctly, fetching up to 100 active trips in a single query.

---

### Requirement 6: Deduplication of concurrent TagService reads

**User Story:** As a developer, I want components that independently call `TagService.getAllTags()` to share a single in-flight Firestore request, so that a page with multiple tag consumers does not multiply Firestore reads.

#### Acceptance Criteria

1. THE TagService SHALL maintain the existing `shareReplay({ bufferSize: 1, refCount: false })` pattern so all concurrent and future subscribers share one cached result.
2. WHEN `getAllTags()` is called from `HomeComponent`, `ViagensComponent`, and any admin component within the same browser session, THE TagService SHALL issue at most one Firestore `getDocs` request total (unless `forceReload = true` is passed).
3. WHEN `createTag()` completes, THE TagService SHALL invalidate the cache (set `tags$` to `undefined`) so the next `getAllTags()` call fetches the updated list.
