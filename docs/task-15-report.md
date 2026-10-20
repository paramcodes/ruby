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

---

## Review fix pass: Batch D review findings (favorites, search, seed)

Status: **complete**. All findings below are fixed, covered by a test, and
verified by the full gate list. One commit:
`fix: address favorites, search, and seed review findings`.

---

## 1. The full-text index added in migration 0005 was never used

### Problem

`src/server/search/queries.ts` combined the title and content predicates with
`OR` across a `LEFT JOIN page_content`. PostgreSQL cannot use a GIN index for
that shape: the plan never mentioned `page_search_title_idx` or
`page_search_content_idx`, and the query fell back to scanning the joined
rows.

### Fix

`src/server/search/queries.ts` now builds the search as **two index-backed
branches joined with `UNION`** — a title branch (`page`) and a content branch
(`page_content` joined to `page`). Both branches repeat:

- the ownership filter, and
- the archived-page exclusion (`p.archived_at IS NULL`).

The ownership filter is written as a correlated subquery
(`(SELECT w.user_id FROM workspace w WHERE w.id = p.workspace_id) = $userId`)
instead of a join. A join lets the planner drive the scan from the
`workspace` btree index, which drops the GIN index from the plan; the
correlated subquery stays a filter, so the tsvector predicate is the only
index condition of the page scan and the GIN index becomes its access path.
The query is exported as `buildSearchQuery(userId, query)` so the test can
`EXPLAIN` the exact statement the search runs.

### Covering test

`src/server/search/queries.test.ts` — *"plans the search query with both
full-text GIN indexes"* inserts 300 pages plus their content for a test user,
runs `ANALYZE`, and asserts that an `EXPLAIN` of `buildSearchQuery` names
`page_search_title_idx` **and** `page_search_content_idx`.

The old query shape is still asserted against: running the pre-fix `OR` +
`LEFT JOIN` statement under the same conditions never produces a GIN index
scan (see the plan below), so the new test fails on the old code.

---

## 2. The recent view was recorded with a floating promise

### Problem

`src/app/(workspace)/pages/[pageId]/page.tsx` called
`void recordRecentPage(...)`: no `await`, no `catch`. The insert could be cut
off when the request ended, and a failure was swallowed silently.

### Fix

The write is now scheduled with the Next 16 `after()` primitive from
`next/server`, so it runs after the response and the request stays alive
until it settles. The callback catches a failure and logs it with the page id
instead of losing it:

```tsx
after(async () => {
  try {
    await recordRecentPage(user.id, page.id);
  } catch (error) {
    console.error("Failed to record the recent page view", { pageId: page.id, error });
  }
});
```

The compensating `await page.waitForTimeout(1_000)` was removed from
`tests/e2e/page-discovery.spec.ts`.

### Covering test

`tests/e2e/page-discovery.spec.ts` — *"recently visited pages appear in the
sidebar recent list"* now runs without the sleep and still passes
(3 consecutive runs of the spec, then the full e2e suite).

---

## 3. The search dialog stuck on "Searching…" when the action rejected

### Problem

`src/components/search/search-dialog.tsx` awaited `searchAction(query)`
without a `try`/`catch`. A rejected request left `loading` true forever. The
`unauthenticated` error case also fell into the generic branch and showed
"No pages found.".

### Fix

- The call is wrapped in `try`/`catch`. A rejection clears the loading state,
  clears the results, and shows "Search failed. Please try again.".
- The `unauthenticated` case shows "Your session has expired. Sign in again to
  search.".
- "No pages found." is no longer rendered while an error is visible, so the
  two messages cannot contradict each other.

### Covering test

`src/components/search/search-dialog.test.tsx` (new) covers a rejected
action, the `unauthenticated` result, and a successful search. Against the
pre-fix component two of the three tests fail (an unhandled rejection and the
"No pages found." message).

---

## 4. The seed bypassed the page domain commands

### Problem

`src/server/db/seed.ts` inserted pages with a raw `db.insert(...).onConflictDoUpdate(...)`,
so title validation, the archived-parent check, and workspace ownership were
all skipped.

### Fix

- **Domain widened** — `CreatePageInput` gained an optional `id`
  (`src/server/pages/types.ts`). `validateCreatePageInput` validates it when
  present (`src/server/pages/validation.ts`) and `createPage` uses it instead
  of a random UUID (`src/server/pages/commands.ts`). Ownership, title
  validation, and the archived-parent check are unchanged and still apply.
- **The action stays id-less** — `createPageAction` validates and passes only
  `{ title, parentId }`, so a client can never choose a page id
  (`src/app/actions/pages.ts`).
- **The seed uses the command** — `src/server/db/seed.ts` now calls
  `createPage(userId, { id, title, parentId })` with the deterministic
  UUID-v5 ids, and `renamePage` / `movePage` to keep an already seeded page
  in sync with the definition. A page that already exists is detected with
  `getPageForUser` instead of a raw write.
- **The seed is importable** — `runSeed(identity)` is exported and the CLI
  entry only runs when the file is executed as a script
  (`import.meta.url` check), so the test can import it.

### Covering test

`src/server/pages/commands.test.ts` — *"creates a page with an explicit id and
keeps the ownership rules"* asserts that the explicit id is used, that an
invalid id is rejected, and that a parent owned by another user is still
rejected.

---

## 5. The required seed-idempotence test did not exist

### Fix

`src/server/db/seed.test.ts` (new) uses `describe.skipIf(!process.env.DATABASE_URL)`
and runs the seed twice against a scratch identity
(`seed-test-<uuid>@example.test`), then asserts:

- the page count is unchanged (5),
- the page ids are unchanged and equal the ids of the first run,
- `page_content.revision` and `page_content.search_text` are unchanged,
- no second `user` row was created for the identity.

The suite also asserts the seed leaves no favorite or recent-view rows behind.

---

## Additional findings in the same pass

- **Missing 0005 snapshot** — `src/server/db/migrations/meta/0005_snapshot.json`
  restored. The two GIN expression indexes are now declared in the Drizzle
  schema (`src/server/pages/schema.ts`, `src/server/pages/content-schema.ts`)
  so the schema and the snapshot agree, and `pnpm db:generate` reports
  *"No schema changes, nothing to migrate"*.
- **`db:seed` had no `DATABASE_URL` default** — `package.json` now uses the
  same non-secret default as `db:generate` and `db:migrate`:
  `postgres://wiki:wiki@localhost:5432/wiki`.
- **Wrong comments** —
  - `src/server/pages/favorites.ts`: ownership of the reads comes from
    `favorite.user_id`; only the write in `addFavorite` checks
    `workspace.user_id`.
  - `src/server/pages/recent-pages.ts`: the listing is scoped by
    `page_view.user_id`; `recordRecentPage` is the query that checks
    `workspace.user_id`.
  - `src/server/pages/favorites-schema.ts`: the insert uses
    `onConflictDoNothing`, so `updated_at` keeps the value of the first
    favorite and is never bumped.

---

## Commands and output

```
$ pnpm format:check
Checking formatting...
All matched files use Prettier code style!

$ pnpm lint
$ eslint .
(no output — no findings)

$ pnpm typecheck
$ tsc --noEmit
(no output — no errors)

$ pnpm test
 Test Files  17 passed | 7 skipped (24)
      Tests  96 passed | 64 skipped (160)

$ pnpm build
▲ Next.js 16.4.2 (Turbopack)
✓ Compiled successfully in 4.1s
✓ Generating static pages using 3 workers (7/7)

$ pnpm db:migrate
[✓] migrations applied successfully!

$ pnpm db:generate
No schema changes, nothing to migrate 😴

$ DATABASE_URL=postgres://wiki:wiki@localhost:5432/wiki pnpm test:db
 Test Files  24 passed (24)
      Tests  160 passed (160)

$ pnpm test:e2e
Running 11 tests using 2 workers
  ✓   1 [chromium] › tests/e2e/auth.spec.ts:7:1 › redirects unauthenticated visitors to sign-in
  ✓   2 [chromium] › tests/e2e/auth.spec.ts:12:1 › signs up and reaches the dashboard
  ✓   3 [chromium] › tests/e2e/auth.spec.ts:23:1 › signs in with an existing account
  ✓   4 [chromium] › tests/e2e/editor-interactions.spec.ts:113:1 › keyboard shortcuts reorder blocks, and undo and redo restore state
  ✓   5 [chromium] › tests/e2e/editor-interactions.spec.ts:74:1 › slash menu inserts every supported block type and persists it
  ✓   6 [chromium] › tests/e2e/page-discovery.spec.ts:7:1 › search finds pages by title and content and navigates from results
  ✓   7 [chromium] › tests/e2e/page-editing.spec.ts:5:1 › typing autosaves and the content survives a reload
  ✓   8 [chromium] › tests/e2e/page-discovery.spec.ts:66:1 › recently visited pages appear in the sidebar recent list
  ✓   9 [chromium] › tests/e2e/page-discovery.spec.ts:90:1 › search shows a message when no pages match
  ✓  10 [chromium] › tests/e2e/page-navigation.spec.ts:7:1 › creates, renames, archives, restores, and isolates pages
  ✓  11 [chromium] › tests/e2e/page-navigation.spec.ts:91:1 › a second member signs back in without seeing another page tree
  11 passed (1.3m)
```

---

## EXPLAIN plan output

### Before (the `OR` + `LEFT JOIN` shape) — no GIN index

`EXPLAIN` of the pre-fix statement, 300 pages + 300 content rows, with
`enable_seqscan = off` so the planner is forced to consider every index:

```
 Limit  (cost=30.01..38.17 rows=1 width=70)
   ->  Result  (cost=30.01..38.17 rows=1 width=70)
         ->  Sort  (cost=30.01..30.01 rows=1 width=69)
               Sort Key: p.title, p.id
               ->  Nested Loop Left Join  (cost=8.85..30.00 rows=1 width=69)
                     Filter: ((to_tsvector('english'::regconfig, p.title) @@ '''entri'' & ''4242'''::tsquery) OR (to_tsvector('english'::regconfig, pc.search_text) @@ '''entri'' & ''4242'''::tsquery))
                     ->  Nested Loop  (cost=8.58..26.60 rows=1 width=69)
                           ->  Index Scan using workspace_user_id_unique on workspace w
                                 Index Cond: (user_id = 'expl-user'::text)
                           ->  Bitmap Heap Scan on page p
                                 Recheck Cond: (workspace_id = w.id)
                                 Filter: (archived_at IS NULL)
                                 ->  Bitmap Index Scan on page_workspace_parent_sort_idx on page p
                                       Index Cond: (workspace_id = w.id)
                     ->  Index Scan using page_content_pkey on page_content pc
                           Index Cond: (page_id = p.id)
```

Neither `page_search_title_idx` nor `page_search_content_idx` appears.

### After (`buildSearchQuery`, the same rows) — both GIN indexes are used

```
Limit  (cost=5630.34..5630.35 rows=4 width=97)
  ->  Sort  (cost=5630.34..5630.35 rows=4 width=97)
        Sort Key: p.title, p.id
        ->  Unique  (cost=5630.25..5630.30 rows=4 width=97)
              ->  Sort  (cost=5630.25..5630.26 rows=4 width=97)
                    Sort Key: p.id, p.parent_id, p.title, ((ANY (p.id = (hashed SubPlan 2).col1)))
                    ->  Append  (cost=27.07..5630.21 rows=4 width=97)
                          ->  Bitmap Heap Scan on page p  (cost=27.07..2616.11 rows=2 width=95)
                                Recheck Cond: (to_tsvector('english'::regconfig, title) @@ '''index'''::tsquery)
                                Filter: ((archived_at IS NULL) AND ((SubPlan 3) = '911bbc9c-f706-48e5-a8b5-950e8994a7b7'::text))
                                ->  Bitmap Index Scan on page_search_title_idx  (cost=0.00..27.07 rows=300 width=0)
                                      Index Cond: (to_tsvector('english'::regconfig, title) @@ '''index'''::tsquery)
                                SubPlan 2
                                  ->  Index Only Scan using favorite_user_id_page_id_pk on favorite f
                                        Index Cond: (user_id = '911bbc9c-f706-48e5-a8b5-950e8994a7b7'::text)
                                SubPlan 3
                                  ->  Index Scan using workspace_pkey on workspace w
                                        Index Cond: (id = p.workspace_id)
                          ->  Nested Loop  (cost=27.42..3014.08 rows=2 width=95)
                                ->  Bitmap Heap Scan on page_content pc  (cost=27.14..118.89 rows=300 width=37)
                                      Recheck Cond: (to_tsvector('english'::regconfig, search_text) @@ '''index'''::tsquery)
                                      ->  Bitmap Index Scan on page_search_content_idx  (cost=0.00..27.07 rows=300 width=0)
                                            Index Cond: (to_tsvector('english'::regconfig, search_text) @@ '''index'''::tsquery)
                                ->  Index Scan using page_pkey on page p_1  (cost=0.27..9.61 rows=1 width=94)
                                      Index Cond: (id = pc.page_id)
                                      Filter: ((archived_at IS NULL) AND ((SubPlan 6) = '911bbc9c-f706-48e5-a8b5-950e8994a7b7'::text))
                                      SubPlan 6
                                        ->  Index Scan using workspace_pkey on workspace w_1
                                              Index Cond: (id = p_1.workspace_id)
```

`page_search_title_idx` and `page_search_content_idx` are both the access
path of their branch; the ownership filter and the archived-page exclusion
are still applied in both branches.

### Seed idempotence, observed

```
$ pnpm db:seed
Seed complete: 5 pages
$ pnpm db:seed
Seed complete: 5 pages

 id                   |           title            | revision
----------------------+----------------------------+----------
 69c9dbc3-…-43fac3807b28 | Getting Started            |        1
 a5476929-…-eefb667ca20f | First Steps                |        1
 9fa615bd-…-e7b0f8c56ac03 | Welcome to Individual Wiki |        1
 e8059eb5-…-6393430ddde4 | Creating Pages             |        1
 45f3896e-…-27d59f9b7cfc | Search and Discovery       |        1
```

Same five ids, same revision 1 after the second run.

---

## Files changed

| File | Change |
|------|--------|
| `src/server/search/queries.ts` | `UNION` of two index-backed branches; `buildSearchQuery` exported |
| `src/server/search/queries.test.ts` | EXPLAIN test asserting both GIN indexes |
| `src/app/(workspace)/pages/[pageId]/page.tsx` | `after()` + logged failure for the recent-view write |
| `tests/e2e/page-discovery.spec.ts` | removed the compensating `waitForTimeout` |
| `src/components/search/search-dialog.tsx` | `try`/`catch`, error message, session-expired message |
| `src/components/search/search-dialog.test.tsx` | new component test |
| `src/server/pages/types.ts` | optional `id` on `CreatePageInput` |
| `src/server/pages/validation.ts` | validates the optional `id` |
| `src/server/pages/commands.ts` | `createPage` honours an explicit id |
| `src/server/pages/commands.test.ts` | explicit-id and ownership test |
| `src/app/actions/pages.ts` | the action never accepts a client-supplied id |
| `src/server/db/seed.ts` | pages created through the domain commands; `runSeed` exported |
| `src/server/db/seed.test.ts` | new seed idempotence suite |
| `src/server/db/migrations/meta/0005_snapshot.json` | restored snapshot |
| `src/server/pages/schema.ts` | declares `page_search_title_idx` |
| `src/server/pages/content-schema.ts` | declares `page_search_content_idx` |
| `src/server/pages/favorites.ts` | ownership comment corrected |
| `src/server/pages/recent-pages.ts` | ownership comment corrected |
| `src/server/pages/favorites-schema.ts` | `updated_at` comment corrected |
| `package.json` | `db:seed` gets the `DATABASE_URL` default |
| `docs/task-15-report.md` | this fix report |
