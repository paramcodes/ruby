# Task 15: Workspace Search and Deterministic Seed Data

## Summary

Implemented PostgreSQL full-text search over page titles and content, a Cmd+K
search dialog in the sidebar, and an idempotent deterministic seed script that
bootstraps a known set of pages for local development.

## Changes

### Search Validation

- **`src/server/search/validation.ts`** — `validateSearchQuery` trims and
  normalizes input (collapses whitespace, rejects empty/over-length queries).
  `MAX_SEARCH_QUERY_LENGTH` = 200.
- **`src/server/search/validation.test.ts`** — 10 unit tests covering trimming,
  whitespace collapsing, empty rejection, non-string rejection, max-length
  boundary, and case/punctuation preservation.

### Search Queries

- **`src/server/search/queries.ts`** — `searchPages` (React `cache`d) executes a
  raw SQL query joining `page` → `workspace` → `page_content` with two
  `to_tsvector('english', …)` predicates (one on `page.title`, one on
  `page_content.search_text`). Results include an `EXISTS` subquery for the
  favorited flag. Only active (non-archived) pages owned by the requesting user
  are returned, ordered by title, limited to 50.
- **`src/server/search/queries.test.ts`** — 8 DB tests covering title matching,
  content matching, no-result queries, archived-page exclusion, user scoping,
  and favorited-flag reporting.

### Database Migration

- **`src/server/db/migrations/0005_tender_search.sql`** — two GIN expression
  indexes:
  - `page_search_title_idx`: `to_tsvector('english', "title")` on `page`
  - `page_search_content_idx`: `to_tsvector('english', "search_text")` on
    `page_content`
- **`src/server/db/migrations/meta/_journal.json`** — journal entry for migration
  0005.

### Server Action

- **`src/app/actions/search.ts`** — `searchAction` server action that validates
  the query, checks authentication, and returns `{ id, parentId, title,
  favorited }` results (or an error: `unauthenticated` | `empty` | `too-long`).

### Search Dialog Component

- **`src/components/search/search-dialog.tsx`** — client component rendering a
  Radix UI dialog with a search input, debounced server calls (250 ms), a
  request-id guard for stale results, and results rendered as links that close
  the dialog on navigation. Global Cmd+K / Ctrl+K shortcut via `document`
  keydown listener.
- **`src/components/search/search-dialog.module.css`** — styling.

### Sidebar Integration

- **`src/components/workspace/sidebar.tsx`** — replaced
  `SearchPlaceholder` ("Coming soon") with `<SearchDialog />`.
- **`src/components/workspace/sidebar.module.css`** — removed placeholder
  styles.

### Deterministic Seed Data

- **`src/server/db/seed.ts`** — idempotent seed script that:
  1. Creates or finds a seed user (`wiki@example.com`) via
     `auth.api.signUpEmail` with `{ body: { … } }` input (Better Auth 1.7
     server-side API shape).
  2. Upserts 5 seed pages with deterministic UUID-v5 ids (RFC 4122, SHA-1
     namespace) derived from `(userId, key)`.
  3. Saves editor content for each page, only when the stored document differs
     from the expected one (keeps revision numbers stable on re-runs).
  4. Closes the postgres connection pool on completion (`db.session.client.end()`)
     so the Node.js process exits cleanly.

### Package Scripts

- **`package.json`** — added `tsx` devDependency and the `db:seed` script:
  `tsx --conditions react-server src/server/db/seed.ts`.

### E2E Tests

- **`tests/e2e/page-discovery.spec.ts`** — three serial tests:
  1. Search finds pages by title ("field") and content ("terrain"), navigates
     from results, and loads the page.
  2. Recently visited pages appear in the sidebar's "Recent" section.
  3. Search shows "No pages found." for an unmatched query.

## Key Decisions

- **Composite PKs** `(user_id, page_id)` for `favorite` and `page_view` tables
  (carried over from Task 14) — PK doubles as uniqueness constraint and upsert
  target.
- **Two GIN expression indexes** on `to_tsvector('english', …)` rather than a
  single tsvector column — avoids schema changes to store a materialized
  `tsvector` column.
- **UUID-v5 deterministic ids** — `createPage` generates random ids, so the seed
  computes its own deterministic ids via SHA-1(namespace + userId:key).
- **`tsx --conditions react-server`** — resolves the `server-only` import to an
  empty export at runtime while preserving `@/` path aliases.
- **Connection cleanup** — the `db` Proxy in `client.ts` binds function values,
  which strips methods like `.end()` from the postgres client. The seed accesses
  the raw client via `db.session.client.end()` (an internal property not
  surfaced by Drizzle's types, accessed through a cast).

## Issues Resolved During Implementation

1. **`truncateExistingSeedData` unused** — removed the function and its
   `inArray` import; moved `eq` import to the top of the file.
2. **Double `upsertPages` call in `main()`** — the original code called
   `upsertPages` twice (discarding the first result). Fixed to call once.
3. **TypeScript `noUncheckedIndexedAccess` errors** — `formatUuid` used
   `hex[0] + hex[1] + …` which produces `string | undefined` under strict
   indexed access. Rewrote using `Array.slice().join()`.
4. **`Object is possibly 'undefined'` on Buffer** — `hash[6]` and `hash[8]`
   reads in `uuidv5` resolved to `number | undefined` under
   `noUncheckedIndexedAccess`. Guarded with `?? 0`.
5. **Better Auth `signUpEmail` typing** — the server-side API expects
   `{ body: { email, password, name } }`, not flat fields. Fixed the call shape.
6. **`react-hooks/set-state-in-effect` lint errors** — the search dialog called
   `setState` synchronously inside `useEffect` bodies. Restructured to move
   state resets into the `onOpenChange` event handler and loading/error state
   into the debounced `setTimeout` callback. Used derived `visibleResults` /
   `visibleError` to hide stale state without `setState` in the effect.
7. **Keyboard shortcut bypassing state reset** — the Cmd+K handler called
   `setOpen(true)` directly, bypassing `handleOpenChange`. Changed to
   `handleOpenChange(true)` so search state is reset and the input is focused.

## Verification

| Gate | Result |
|------|--------|
| `pnpm format:check` | ✅ All files formatted |
| `pnpm lint` | ✅ No errors |
| `pnpm typecheck` | ✅ No type errors |
| `pnpm test` | ✅ 16 passed, 6 skipped (DB suites) |
| `pnpm build` | ✅ Compiled successfully |
| `pnpm db:migrate` | ✅ Migration 0005 applied |
| `pnpm test:db` | ✅ 152 tests passed (all suites) |
| `pnpm test:e2e` | ✅ 11 tests passed (3 new discovery tests) |

The seed script was verified as idempotent (two consecutive runs both succeed)
and exits cleanly.
