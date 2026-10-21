<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

| Command             | Description                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check` | Prettier formatting check.                                                                                                                             |
| `pnpm lint`         | ESLint on `src/app/` and `src/components/`.                                                                                                            |
| `pnpm typecheck`    | `tsc --noEmit` with strict TypeScript.                                                                                                                 |
| `pnpm test`         | Vitest unit and domain tests — **no database needed**.                                                                                                 |
| `pnpm test:db`      | Vitest with database tests (set `REQUIRE_DB=1`).                                                                                                       |
| `pnpm test:e2e`     | Playwright browser suite; webServer runs on port 3100.                                                                                                 |
| `pnpm build`        | Next.js production build.                                                                                                                              |
| `pnpm verify`       | Full chain: `format:check && lint && typecheck && test && build && db:migrate && test:db && test:e2e`. Requires a running database and free port 3100. |

## Architecture map

- **Domains** (`src/server/`): `auth` (Better Auth boundary), `db` (Drizzle client + schema + migrations), `ids` (typed page IDs), `pages` (page commands, queries, content, favorites, recent-pages), `workspaces` (single private workspace per user). Domain operations establish `UserId` server-side.
- **UI** (`src/components/`): `workspace` (sidebar, page-tree, page-actions, favorites-list, recent-pages-list, require-session), `editor` (page-editor, editor-adapter, editor-canvas, slash-menu, save-status), `ui` (button, dialog, input, menu — Radix-backed), `search` (search-dialog).
- **Routes** (`src/app/`): `(auth)` sign-in/sign-up, `(workspace)` shell + pages, `(protected)` dashboard, `api/auth/[...all]` Better Auth handler.
- **Editor adapter** (`src/components/editor/editor-adapter.ts`): versioned `EditorDocument` (`schemaVersion`), parse/serialize, search-text extraction. Editor serialization never leaks into the page domain.
- **Design tokens** (`src/styles/tokens.css`): OKLCH semantic colors, typography, spacing, borders, focus rings, motion. Imported via `globals.css`.

## Hard rules (enforced by tooling)

- **No database imports in UI**: ESLint `no-restricted-imports` blocks `drizzle-orm`, `postgres`, and any `@/db`, `**/db`, `**/repositories/**`, `**/persistence/**` paths from `src/app/` and `src/components/`.
- **Server-derived UserId**: every protected operation calls `getCurrentUser()` which resolves `UserId` from the session — never accepts client-supplied ownership.
- **Versioned editor documents**: `EditorDocument` carries `schemaVersion`; the adapter validates on parse.
- **Versioned SQL migrations**: all schema changes live as numbered SQL files in `src/server/db/migrations/`, applied via `pnpm db:migrate`.

## Docs

- [Design spec](docs/superpowers/specs/2026-10-20-individual-wiki-mvp-design.md)
- [ADR 0001 — MVP stack](docs/adr/0001-mvp-application-stack.md)
- [ADR 0002 — Domain boundaries](docs/adr/0002-domain-boundaries-and-agent-verification.md)
- [ADR 0003 — Authentication](docs/adr/0003-authentication-for-the-mvp.md)
- [Local setup](docs/development/local-setup.md)
- [Editor prototype checklist](docs/editor-prototype-checklist.md)
