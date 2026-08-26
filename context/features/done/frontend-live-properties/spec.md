# Spec: Frontend Live Property Data

## Goal
Replace the homepage property fixtures with live data from the existing backend API. Visitors should see current featured listings while retaining the existing card design and accessible property section.

## Acceptance Criteria
- [ ] The frontend requests `GET /properties/featured` using `NEXT_PUBLIC_API_URL`.
- [ ] Backend records map correctly to the existing property card presentation, including LKR price formatting, the first image URL, image alt text, and nullable metadata.
- [ ] The homepage renders server-side loading, empty, and error states without introducing client state for the grid.
- [ ] Missing beds, baths, or square footage are omitted rather than shown as zeroes; missing images use an intentional neutral fallback.
- [ ] Existing section structure, responsive grid, card accessibility, pluralization, and non-interactive behavior remain intact.
- [ ] Tests cover the API request, response validation, mapping, nullable fields, empty results, loading, and errors.
- [ ] `pnpm test` and `pnpm build` pass from `frontend/`.

## Out of Scope
- Chat changes.
- Filters, sorting, search, pagination, or property detail pages.
- A new backend endpoint, backend schema changes, or deployment/admin work.
- Replacing listing imagery with a new image source.

## Edge Cases
- A successful empty array renders an intentional empty state.
- Slow requests preserve the grid layout with a loading state.
- Network, non-2xx, and malformed responses render a concise error state.
- Backend bedrooms, bathrooms, or sqft may be null.
- A listing may have no image URL.
- API base URLs may include trailing slashes.

## Notes
- Use the implemented `/properties/featured` route, not the unimplemented `/properties` route.
- Keep backend wire types separate from the card's display-oriented `Property` type.
- Use the existing API error and timeout conventions in `frontend/lib/api.ts`.
