# Implementation Plan: firebase-read-optimization

## Overview

Optimize Firebase Firestore reads across six services using shared observable caching, point reads, and server-side pagination. All changes are confined to `src/app/core/services/`.

## Tasks

- [x] 1. Add `hasNextPage` to PaginatedResponse and update PostService, TripService, TestimonialService interfaces
  - Add `hasNextPage: boolean` to each local `PaginatedResponse<T>` definition in `post.service.ts`, `trip.service.ts`, `testimonial.service.ts`, and `category.service.ts`
  - _Requirements: 5.5_

- [x] 2. Implement shared observable cache for BannerService
  - [x] 2.1 Add `BrowserStorageService` injection, `banners$` cache field, `cacheKey`, and `invalidateCache()` to `BannerService`
    - Warm-start from `localStorage` key `unitur_banners_cache` then fetch from Firestore
    - Use `shareReplay({ bufferSize: 1, refCount: false })` on the observable
    - On error: emit localStorage value (or `[]`), set `banners$` to `null`
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [x] 2.2 Call `invalidateCache()` in `createBanner()`, `updateBanner()`, `deleteBanner()`, `reorderBanners()`
    - _Requirements: 1.3_

- [-] 3. Implement shared observable cache for CategoryService
  - [x] 3.1 Add `BrowserStorageService` injection, `categories$` cache field, `cacheKey`, and `invalidateCache()` to `CategoryService`
    - Warm-start from `localStorage` key `unitur_categories_cache` then fetch from Firestore
    - Use `shareReplay({ bufferSize: 1, refCount: false })` on the `getAllCategories()` observable
    - On error: emit localStorage value (or `[]`), set `categories$` to `null`
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - [x] 3.2 Update `getCategories(filters?)` to delegate to `getAllCategories()` and apply filters in-memory
    - _Requirements: 2.6_
  - [x] 3.3 Call `invalidateCache()` in `createCategory()`, `updateCategory()`, `deleteCategory()`
    - _Requirements: 2.3_

- [x] 4. Add `shareReplay` cache for `AboutContentService.load()`
  - Store the result observable in a `load$` private field using `shareReplay({ bufferSize: 1, refCount: false })`
  - Set `load$` to `null` on `save()` completion
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 5. Checkpoint — verify services compile cleanly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement point reads in PostService, TripService, TestimonialService
  - [x] 6.1 Replace `getDocs(collection(...))` with `getDoc(doc(..., String(id)))` in `PostService.getPost()`
    - Fall back to localStorage entry for the id on error or missing document
    - _Requirements: 4.1, 4.4, 4.5_
  - [x] 6.2 Replace `getDocs(collection(...))` with `getDoc(doc(..., String(id)))` in `TripService.getTrip()`
    - Fall back to localStorage entry for the id on error or missing document
    - _Requirements: 4.2, 4.4, 4.5_
  - [x] 6.3 Replace `getDocs(collection(...))` with `getDoc(doc(..., String(id)))` in `TestimonialService.getTestimonial()`
    - Fall back to localStorage entry for the id on error or missing document
    - _Requirements: 4.3, 4.4, 4.5_

- [x] 7. Implement server-side pagination in PostService
  - [x] 7.1 Add `adminCursor`, `lastFilterHash`, `hashFilters()`, and `resetPagination()` to `PostService`
    - _Requirements: 5.3, 5.4_
  - [x] 7.2 Update `getPosts()` to apply `limit(pageSize)` + `startAfter(cursor)` Firestore constraints and set `hasNextPage`
    - Auto-detect filter changes via `hashFilters()` and reset cursor when filters change
    - Use `orderBy('createdAt', 'desc')` for consistent cursor ordering
    - _Requirements: 5.1, 5.2, 5.4, 5.5_
  - [ ]* 7.3 Write unit test: `resetPagination()` clears the cursor so next `getPosts()` has no `startAfter`
    - _Requirements: 5.3_

- [ ] 8. Implement server-side pagination in TripService
  - [x] 8.1 Add `adminCursor`, `lastFilterHash`, `hashFilters()`, and `resetPagination()` to `TripService`
    - _Requirements: 5.3, 5.4_
  - [x] 8.2 Update `getTrips()` to apply `limit(pageSize)` + `startAfter(cursor)` when a `limit` filter is provided, and set `hasNextPage`
    - When `limit` is not set or called from public-facing components, keep existing behavior (no cursor)
    - Preserve `getTrips({ status: 'active', limit: 100 })` public-facing behavior
    - _Requirements: 5.6, 5.8_
  - [ ]* 8.3 Write unit test: `getTrips({ status: 'active', limit: 100 })` still returns up to 100 active trips correctly
    - _Requirements: 5.8_

- [x] 9. Implement server-side pagination in TestimonialService
  - [x] 9.1 Add `adminCursor`, `lastFilterHash`, `hashFilters()`, and `resetPagination()` to `TestimonialService`
    - _Requirements: 5.3, 5.4_
  - [x] 9.2 Update `getTestimonials()` to apply `limit(pageSize)` + `startAfter(cursor)` when a `limit` filter is provided, and set `hasNextPage`
    - _Requirements: 5.7_

- [x] 10. Wire pagination reset into admin list components
  - [x] 10.1 Call `postService.resetPagination()` in `PostsListComponent` when filters change (before reloading)
    - _Requirements: 5.4_
  - [x] 10.2 Bind `hasNextPage` from `PaginatedResponse` in `PostsListComponent` pagination UI
    - _Requirements: 5.5_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `TagService` already implements the required pattern (reference implementation) — no changes needed
- All localStorage keys match the existing conventions used in each service
- The `orderBy` needed for Firestore cursor pagination is added only in the services that support it; services that deliberately omit `orderBy` (to avoid filtering out docs without the field) use a client-side sort instead
