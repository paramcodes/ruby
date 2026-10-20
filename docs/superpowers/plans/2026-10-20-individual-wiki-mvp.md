# Individual Wiki MVP Implementation Plan

> **For agentic workers:** Use one task per focused session. Read the design spec and the task's Interfaces block before changing code. Do not begin the next task until the current task's verification passes and its handoff is recorded.

Implement each behavior test-first: add the focused failing test, run it to confirm the failure, implement the smallest change, then rerun the focused and task-level checks. Commit each task's verified changes separately.

**Goal:** Build an individual-first personal wiki with a custom design system, nested pages, a reliable block editor, and search.

**Architecture:** Next.js App Router and strict TypeScript serve the UI and server-side domain operations. PostgreSQL stores user-owned workspace and page metadata plus versioned editor documents. Domain modules own validation, commands, queries, and persistence access; UI code cannot access database tables directly. BlockNote is gated on a focused editor prototype and remains behind an adapter.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, Drizzle, BlockNote (prototype gate), Vitest, Playwright, pnpm.

**Spec:** [Individual Wiki MVP Design](../../specs/2026-10-20-individual-wiki-mvp-design.md)

## Global Constraints

- The MVP is for individuals maintaining reference knowledge, with one private workspace per account.
- Use the stack and product direction in the approved design spec and ADRs.
- Keep page metadata and hierarchy separate from versioned editor content.
- UI components call domain operations; they do not write database rows directly.
- Scope every page and workspace read or mutation to the signed-in user.
- Do not include workspace membership, invitations, shared access, real-time collaboration, CRDTs, databases, public publishing, offline sync, comments, or AI features in the MVP.
- Every task ends with its listed verification command(s) and a concise handoff of changes, results, decisions, and risks.

## Review Focus

- A user requests another account's page ID: return not-found/unauthorized without exposing page data; cover in Task 5 domain tests and Task 9 server-operation tests.
- A page is moved beneath itself or one of its descendants: reject the command and preserve the existing tree; cover in Task 6 hierarchy tests.
- A persisted editor document is malformed or uses an unsupported schema version: reject or migrate it without crashing the page route; cover in Task 10 adapter tests.
- An autosave fails while the editor is dirty: preserve the editor state, expose retry, and warn before navigation would discard edits; cover in Task 12 component/browser tests.
- Archived pages appear in active navigation or search: exclude them from active results while keeping restore available; cover in Task 9 and Task 15 tests.

---

### Task 1: Bootable application and static checks

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc.json`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/styles/globals.css`, `playwright.config.ts`
- Create: `.github/workflows/ci.yml`
- Test: `src/app/page.test.tsx`

**Interfaces:**
- Produces scripts: `pnpm dev`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm verify`.
- Produces a minimal home page that renders without database or auth configuration.

- [ ] Scaffold the smallest bootable Next.js TypeScript app and pin dependencies in `pnpm-lock.yaml`.
- [ ] Configure strict TypeScript, lint, Prettier format checking, and the scripts listed above.
- [ ] Configure Playwright with a local `webServer`; initially make `pnpm verify` run lint, typecheck, unit tests, and build. Task 16 extends it with database and browser checks.
- [ ] Add ESLint import restrictions preventing `src/app/**` and `src/components/**` from importing database clients or domain repositories; CI lint must enforce these boundaries.
- [ ] Add CI steps for install, lint, format check, typecheck, unit tests, and production build.
- [ ] Add a smoke test asserting the home route renders its app heading.
- [ ] Verify with `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

### Task 2: Local PostgreSQL and migration workflow

**Files:**
- Create: `compose.yaml`, `.env.example`, `drizzle.config.ts`
- Create: `src/server/db/client.ts`, `src/server/db/migrations/.gitkeep`
- Modify: `package.json`, `.github/workflows/ci.yml`
- Test: `src/server/db/client.test.ts`

**Interfaces:**
- Produces `db`, a server-only Drizzle client configured from `DATABASE_URL`.
- Produces scripts: `pnpm db:up`, `pnpm db:down`, `pnpm db:migrate`, `pnpm db:generate`, `pnpm test:db`.

- [ ] Add a local Postgres service with a health check and documented non-secret defaults.
- [ ] Create the Drizzle client and migration configuration; fail with a clear message when `DATABASE_URL` is absent.
- [ ] Add a database connectivity smoke test under `pnpm test:db`; keep the default unit-test command independent of a running database.
- [ ] Add a CI database job that starts Postgres, applies migrations, and runs `pnpm test:db`.
- [ ] Verify with `pnpm db:up`, `pnpm db:migrate`, and `pnpm test:db`.

### Task 3: Authentication provider decision

**Files:**
- Create: `docs/adr/0003-authentication-for-the-mvp.md`

**Interfaces:**
- Produces one selected auth provider and a documented local development and session integration decision for Task 4.

- [ ] Compare managed and self-hosted/library options against Next.js integration, PostgreSQL ownership, secure sessions, fresh-worktree local setup, test identities, and migration cost using current official documentation.
- [ ] Select the smallest secure fit for the MVP and record the decision and a meaningful alternative in ADR 0003.
- [ ] Verify the choice supports deriving a stable user ID on the server without client-supplied ownership and supports reproducible local/browser tests.

### Task 4: Authentication boundary and sign-in flow

**Files:**
- Create: `src/server/auth/current-user.ts`, `src/server/auth/types.ts`
- Create: `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/sign-up/page.tsx`
- Test: `src/server/auth/current-user.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Produces `type UserId = string` and `getCurrentUser(): Promise<{ id: UserId } | null>`.
- Domain operations consume `UserId` from server-side session resolution; client input cannot supply the acting user ID.

- [ ] Implement the provider chosen in ADR 0003 behind `getCurrentUser()` and keep provider-specific calls inside `src/server/auth/`.
- [ ] Add sign-in/sign-up states and a protected-route redirect for unauthenticated users.
- [ ] Test authenticated and unauthenticated session resolution without exposing secrets to client code.
- [ ] Verify with `pnpm lint && pnpm typecheck && pnpm test -- src/server/auth` and `pnpm test:e2e -- tests/e2e/auth.spec.ts`.

### Task 5: Private workspace and page domain model

**Files:**
- Create: `src/server/workspaces/schema.ts`, `src/server/workspaces/queries.ts`
- Create: `src/server/pages/schema.ts`, `src/server/pages/types.ts`, `src/server/pages/validation.ts`
- Create: generated migration under `src/server/db/migrations/`
- Test: `src/server/pages/validation.test.ts`, `src/server/pages/queries.test.ts`

**Interfaces:**
- Produces `PageId`, `WorkspaceId`, `PageSummary`, `PageRecord`, `CreatePageInput = { title: string; parentId: PageId | null }`, and `MovePageInput = { pageId: PageId; parentId: PageId | null; sortOrder: number }`.
- `PageSummary = { id: PageId; parentId: PageId | null; title: string; sortOrder: number; archivedAt: Date | null }`.
- Produces `ensurePrivateWorkspace(userId: UserId): Promise<WorkspaceId>`.
- Produces `listPagesForUser(userId: UserId): Promise<PageSummary[]>` and `getPageForUser(userId: UserId, pageId: PageId): Promise<PageRecord | null>`.

- [ ] Add workspace and page tables with text user IDs from the auth adapter; enforce workspace parent consistency, unique IDs, and stable ordering fields.
- [ ] Enforce `(workspace_id, parent_id)` integrity in the schema; reject hierarchy cycles in Task 6 commands.
- [ ] Ensure first sign-in creates exactly one private workspace for the account, safely under repeated calls.
- [ ] Add validation for non-empty bounded titles, parent IDs, and page identifiers.
- [ ] Make all query functions require `UserId`; verify a page owned by another user returns `null`.
- [ ] Verify with `pnpm db:migrate && pnpm test -- src/server/pages`.

### Task 6: Page commands and hierarchy invariants

**Files:**
- Create: `src/server/pages/commands.ts`, `src/server/pages/repository.ts`
- Create: `src/server/pages/commands.test.ts`

**Interfaces:**
- Produces `createPage(userId: UserId, input: CreatePageInput): Promise<Result<PageSummary, PageCommandError>>`.
- Produces `renamePage(userId: UserId, pageId: PageId, title: string): Promise<Result<PageSummary, PageCommandError>>`.
- Produces `movePage(userId: UserId, input: MovePageInput): Promise<Result<PageSummary, PageCommandError>>`.
- Produces `archivePage(userId: UserId, pageId: PageId): Promise<Result<PageSummary, PageCommandError>>` and `restorePage(userId: UserId, pageId: PageId): Promise<Result<PageSummary, PageCommandError>>`.
- Produces `type PageCommandError = "not-found" | "invalid-title" | "invalid-parent" | "cycle"` and `type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }` for command outcomes.

- [ ] Write command tests for create, rename, move, archive, and restore.
- [ ] Return the same `not-found` result for missing and other-user page IDs; reject moves that create a cycle or target a parent outside the private workspace.
- [ ] Archive a page and its descendants as one subtree; restoring the archived root restores that subtree.
- [ ] Implement commands through repository functions with ownership filters in every mutation.
- [ ] Verify with `pnpm test -- src/server/pages/commands.test.ts`.

### Task 7: Design tokens

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/styles/globals.css`, `src/app/layout.tsx`

**Interfaces:**
- Produces semantic CSS variables for color, typography, spacing, border, and focus.

- [ ] Implement the calm editorial palette with warm neutral surfaces, a distinct accent, readable type, and generous spacing.
- [ ] Verify with `pnpm lint && pnpm typecheck && pnpm build`.

### Task 8: Accessible app primitives

**Files:**
- Create: `src/components/ui/button.tsx`, `input.tsx`, `dialog.tsx`, `menu.tsx`
- Create: `src/components/ui/button.test.tsx`, `input.test.tsx`, `dialog.test.tsx`, `menu.test.tsx`

**Interfaces:**
- Shared controls expose typed props, accessible names, keyboard behavior, and visible focus styles.

- [ ] Build buttons and inputs first, then menu and dialog primitives using accessible headless primitives where they reduce interaction risk.
- [ ] Add component tests for keyboard operation, focus visibility, and accessible names.
- [ ] Verify with `pnpm lint && pnpm typecheck && pnpm test -- src/components/ui`.

### Task 9: Private workspace shell and page navigation

**Files:**
- Create: `src/app/(workspace)/layout.tsx`, `src/app/(workspace)/page.tsx`
- Create: `src/components/workspace/sidebar.tsx`, `page-tree.tsx`, `page-actions.tsx`
- Create: `src/app/actions/pages.ts`
- Test: `src/components/workspace/page-tree.test.tsx`, `tests/e2e/page-navigation.spec.ts`

**Interfaces:**
- Server actions validate input, call Task 6 commands, resolve the current user, and return serializable results.
- Produces routes for the private workspace home and `/pages/[pageId]`.

- [ ] Build the responsive left navigation, page tree, create-page action, rename, move, archive, and restore controls.
- [ ] Use server actions only as transport; keep validation and ownership enforcement in domain commands.
- [ ] Exclude archived pages from active navigation and expose restore in an archive view.
- [ ] Test create/navigate/archive/restore and cross-user page access in the browser.
- [ ] Verify with `pnpm test:e2e -- tests/e2e/page-navigation.spec.ts`.

### Task 10: Editor prototype and format decision gate

**Files:**
- Create: `src/components/editor/editor-adapter.ts`, `src/components/editor/editor-prototype.tsx`
- Create: `src/app/(workspace)/editor-prototype/page.tsx`
- Create: `src/components/editor/editor-adapter.test.ts`
- Create: `docs/editor-prototype-checklist.md`
- Modify: `docs/adr/0001-mvp-application-stack.md` only if the prototype changes the decision.

**Interfaces:**
- Produces `type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }`.
- Produces `type EditorDocument = { schemaVersion: 1; content: JsonValue }` and `parseEditorDocument(input: unknown): { ok: true; value: EditorDocument } | { ok: false; reason: "invalid" | "unsupported-version" }`.
- Produces `serializeEditorDocument(editorState: unknown): EditorDocument` and `extractSearchableText(document: EditorDocument): string`.
- The adapter is the only application module that imports BlockNote document types.

- [ ] Prototype headings, paragraphs, lists, checklists, quotes, dividers, code blocks, slash menu, reordering, keyboard behavior, and product styling using fixture data.
- [ ] Check malformed input and an unsupported schema version; return a typed parse failure rather than throwing into the route.
- [ ] Keep BlockNote only if it meets the approved interaction and visual direction; otherwise compare the closest alternative and update ADR 0001 before continuing.
- [ ] Verify with `pnpm test -- src/components/editor/editor-adapter.test.ts` and the documented manual prototype checklist.

### Task 11: Page content persistence contract

**Files:**
- Create: `src/server/pages/content-schema.ts`, `src/server/pages/content-commands.ts`
- Create: generated page content migration under `src/server/db/migrations/`
- Test: `src/server/pages/content-commands.test.ts`

**Interfaces:**
- `savePageContent(userId: UserId, pageId: PageId, document: EditorDocument, expectedRevision: number): Promise<SaveContentResult>`.
- `SaveContentResult` is a discriminated union of `{ status: "saved"; revision: number; updatedAt: string }`, `{ status: "conflict"; currentRevision: number }`, and `{ status: "invalid" | "failed"; message: string }`.

- [ ] Persist one versioned JSONB document and extracted `search_text` per page, updating both atomically in the same ownership-checked command; use an integer revision for conflict detection between tabs.
- [ ] Test save/reload persistence, malformed documents, cross-user saves, and stale revision conflicts.
- [ ] Verify with `pnpm test -- src/server/pages/content-commands.test.ts`.

### Task 12: Editor integration, autosave, and save failures

**Files:**
- Create: `src/app/actions/page-content.ts`, `src/components/editor/page-editor.tsx`, `src/components/editor/save-status.tsx`
- Test: `src/components/editor/page-editor.test.tsx`, `tests/e2e/page-editing.spec.ts`

**Interfaces:**
- Editor receives `pageId`, validated `initialDocument`, initial revision, and an injected async save function; it does not import database code.
- Server action resolves the signed-in user, validates the payload, and calls Task 11 content commands.

- [ ] Implement debounced autosave with serialized requests so an older response cannot overwrite newer content.
- [ ] Show saving/saved/couldn't-save states; retain the in-memory document and provide retry after failure.
- [ ] Intercept in-app navigation and browser unload while dirty; clearly offer stay or leave with an explicit unsaved-loss message.
- [ ] On revision conflict, retain the local draft and offer reload-latest or an explicit confirmed overwrite.
- [ ] If stored content is invalid or has an unsupported version, show a recoverable load error without crashing the page route.
- [ ] Test autosave, failure/retry, stale-tab conflict, and navigation warning.
- [ ] Verify with `pnpm test -- src/components/editor/page-editor.test.tsx` and `pnpm test:e2e -- tests/e2e/page-editing.spec.ts`.

### Task 13: Editor commands and block interactions

**Files:**
- Create: `src/components/editor/slash-menu.tsx`, `src/components/editor/keyboard-shortcuts.ts`
- Create: `tests/e2e/editor-interactions.spec.ts`
- Modify: `src/components/editor/page-editor.tsx`

**Interfaces:**
- Editor commands operate through the editor adapter; UI controls do not manipulate stored JSON directly.

- [ ] Add slash menu insertion for every block type in the spec.
- [ ] Add keyboard shortcuts, block reorder, undo, and redo.
- [ ] Verify every operation updates the adapter document and persists after reload.
- [ ] Verify with `pnpm test:e2e -- tests/e2e/editor-interactions.spec.ts`.

### Task 14: Favorites and recent pages

**Files:**
- Create: `src/server/pages/favorites.ts`, `src/server/pages/recent-pages.ts`
- Create: `src/components/workspace/favorites-list.tsx`, `recent-pages-list.tsx`
- Create: migration for favorites and recent activity.
- Test: `src/server/pages/favorites.test.ts`, `src/server/pages/recent-pages.test.ts`

**Interfaces:**
- Produces favorite and recent-page queries and commands that require `UserId`.
- Produces `recordRecentPage(userId: UserId, pageId: PageId): Promise<void>` and `listRecentPages(userId: UserId): Promise<PageSummary[]>`.

- [ ] Implement favorites and recent-page ordering scoped to the signed-in user.
- [ ] Persist favorites and recent views per user and page; exclude archived pages from both by default.
- [ ] Record a recent view when an owned page route loads; link favorites and recent pages from the workspace shell.
- [ ] Test duplicate favorites, removal, recent ordering, archive exclusion, and account scoping.
- [ ] Verify with `pnpm test -- src/server/pages/favorites.test.ts src/server/pages/recent-pages.test.ts`.

### Task 15: Search and deterministic seed data

**Files:**
- Create: `src/server/search/queries.ts`, `src/server/search/validation.ts`
- Create: `src/components/search/search-dialog.tsx`, `src/server/db/seed.ts`
- Create: `tests/e2e/page-discovery.spec.ts` and full-text-index migration.
- Modify: `package.json`

**Interfaces:**
- Produces `searchPages(userId: UserId, query: string): Promise<PageSummary[]>` for active pages owned by the signed-in user.
- Produces `pnpm db:seed`, which creates deterministic development pages and editor documents for the local test user.

- [ ] Use PostgreSQL full-text search for page title and the editor adapter's extracted `search_text`; do not add an external search service.
- [ ] Exclude archived pages from search by default; keep restore available in the archive view.
- [ ] Seed a stable nested page hierarchy and editor documents; ensure repeated seed runs are idempotent.
- [ ] Test empty queries, no results, title/body matches, archived exclusion, account scoping, and seed idempotence.
- [ ] Verify with `pnpm test -- src/server/search` and `pnpm test:e2e -- tests/e2e/page-discovery.spec.ts`.

### Task 16: Accessibility, responsive behavior, and release verification

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`, `docs/development/local-setup.md`
- Modify: `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`

**Interfaces:**
- Produces a documented fresh-checkout workflow and one command for the complete verification suite.
- `AGENTS.md` stays concise and points to the design spec, ADRs, and local setup document.

- [ ] Review keyboard navigation, focus restoration, editor semantics, contrast, and responsive navigation.
- [ ] Add browser coverage for the full create → nest → edit → reorder → reload → search journey.
- [ ] Ensure CI runs lint, typecheck, unit/domain tests, database migration checks, and the browser suite.
- [ ] Update `pnpm verify` to include format check, lint, typecheck, unit/domain tests, database migration checks, browser tests, and build.
- [ ] Document setup, seed data, verification commands, and the architecture map; keep agent instructions to commands, map, and enforceable hard rules.
- [ ] Verify from a clean checkout using the documented bootstrap, `pnpm db:seed`, and `pnpm verify`.
