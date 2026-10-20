# Task 14: Favorites and Recent Pages

## Summary

Implemented a favorites system and recent-pages tracking for the individual-wiki
Next.js app. Users can star pages to pin them in the sidebar and see their
recently visited pages in a dedicated "Recent" list.

## Changes

### Schema

- **`src/server/pages/favorites-schema.ts`** — `favorite` table with composite
  primary key `(user_id, page_id)`. The PK doubles as a uniqueness constraint and
  upsert target.
- **`src/server/pages/recent-pages-schema.ts`** — `page_view` table with
  composite primary key `(user_id, page_id)`. Upserts update the `viewed_at`
  timestamp in place rather than inserting duplicate rows.
- **`src/server/db/migrations/0004_brown_quicksilver.sql`** — migration creating
  both tables. Registered in `drizzle.config.ts`.

### Queries and Commands

- **`src/server/pages/favorites.ts`** — `listFavorites`, `listFavoritePageIds`,
  `isPageFavorited` (React `cache`d), plus `addFavorite` and `removeFavorite`.
  All queries join through `workspace.user_id` for ownership scoping.
- **`src/server/pages/recent-pages.ts`** — `listRecentPages` (React `cache`d) and
  `recordRecentPage`. Views are upserted by `(user_id, page_id)`; only active,
  owned pages are recorded or listed.

### Actions

- **`src/app/actions/favorites.ts`** — `favoritePageAction` and
  `unfavoritePageAction` server actions with ownership guards.

### UI

- **`src/components/workspace/favorite-toggle.tsx`** — star toggle that shows
  favorited/unfavorited state and optimistic updates.
- **`src/components/workspace/favorites-list.tsx`** — sidebar section listing
  favorited pages with inline remove buttons.
- **`src/components/workspace/recent-pages-list.tsx`** — sidebar section listing
  recently visited pages (most recent first).
- **`src/components/workspace/sidebar.tsx`** — integrated `FavoritesList` and
  `RecentPagesList` into the sidebar sections.
- **`src/components/workspace/sidebar.module.css`** — styling for the new
  sections.

### Layout and Routing

- **`src/app/(workspace)/layout.tsx`** — fetches favorites and recent pages via
  `Promise.all` and passes them to the `Sidebar`.
- **`src/app/(workspace)/pages/[pageId]/page.tsx`** — calls
  `recordRecentPage` on page load (fire-and-forget for active pages).
- **`src/app/(workspace)/pages/[pageId]/page.test.tsx`** — mocks the favorite
  action.

### Tests

- **`src/server/pages/favorites.test.ts`** — 6 tests covering add, remove,
  list, ownership scoping, and duplicate prevention.
- **`src/server/pages/recent-pages.test.ts`** — 7 tests covering insert,
  upsert-on-revisit, ordering, archived-page filtering, and ownership scoping.

## Verification

| Gate | Result |
|------|--------|
| `pnpm format:check` | ✅ All files formatted |
| `pnpm lint` | ✅ No errors |
| `pnpm typecheck` | ✅ No type errors |
| `pnpm test` | ✅ 16 passed, 6 skipped (DB suites) |
| `pnpm test:db` | ✅ 13 DB tests passed |
| `pnpm build` | ✅ Compiled successfully |
| `pnpm db:migrate` | ✅ Migration 0004 applied |

All 13 DB tests pass (`favorites.test.ts` + `recent-pages.test.ts`).
