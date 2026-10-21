# Local setup

A fresh-checkout workflow for running, editing, and verifying Individual Wiki.

## Prerequisites

- **Node.js** >= 26
- **pnpm** 12.9.1 (set in `package.json` `packageManager`)
- **Docker** (for the PostgreSQL service)

## 1. Install dependencies

```sh
pnpm install --frozen-lockfile
```

## 2. Start PostgreSQL

```sh
pnpm db:up
```

This runs `docker compose up -d --wait` and starts the Postgres 16 container
with the credentials in `compose.yaml` (`wiki` / `wiki` / `wiki`).

## 3. Configure auth

The app uses Better Auth, which requires a secret. Copy the example and set it:

```sh
cp .env.example .env.local
```

Then generate a real secret and put it in `.env.local`:

```sh
openssl rand -base64 32
```

Set the value in `.env.local`:

```env
DATABASE_URL=postgres://wiki:wiki@localhost:5432/wiki
BETTER_AUTH_SECRET=<output-from-openssl>
BETTER_AUTH_URL=http://localhost:3000
```

`pnpm dev` serves on port 3000 by default. If you run on a different port, set
`BETTER_AUTH_URL` to match — see [Troubleshooting](#troubleshooting).

## 4. Apply migrations

```sh
pnpm db:migrate
```

## 5. Seed the workspace

```sh
pnpm db:seed
```

This is idempotent. It creates one deterministic user and five pages
(`Welcome to Individual Wiki`, `Getting Started`, `First Steps`,
`Creating Pages`, `Search and Discovery`) with nested hierarchy and editor
content. Re-running it updates content that has drifted without creating
duplicates.

## 6. Start the app

```sh
pnpm dev
```

Open <http://localhost:3000>. The seeded account is:

- **Email:** `wiki@example.com`
- **Password:** `password1234`

## 7. Verification commands

| Command | Database needed? | Notes |
| --- | --- | --- |
| `pnpm format:check` | No | Prettier formatting check. |
| `pnpm lint` | No | ESLint on `src/`. |
| `pnpm typecheck` | No | `tsc --noEmit` against `tsconfig.json`. |
| `pnpm test` | No | Unit and domain tests via Vitest. |
| `pnpm build` | No | Next.js production build. |
| `pnpm db:migrate` | Yes | Applies SQL migrations to PostgreSQL. |
| `pnpm db:seed` | Yes | Inserts deterministic seed data. |
| `pnpm test:db` | Yes | Vitest database-backed tests (requires `DATABASE_URL`). |
| `pnpm test:e2e` | Yes + port 3100 | Playwright browser suite; starts its own dev server on port 3100. |

### Full chain

`pnpm verify` runs every command in order:

```
format:check → lint → typecheck → test → build → db:migrate → test:db → test:e2e
```

`pnpm verify` requires a running PostgreSQL database and a free port 3100
(the Playwright webServer starts `next dev --port 3100`).

### Unit tests without a database

The default `pnpm test` command needs no database. Database-backed tests
auto-skip when `DATABASE_URL` is absent. Use `pnpm test:db` (which sets
`REQUIRE_DB=1`) to force a hard failure when the database is missing.

## Troubleshooting

### `DATABASE_URL` for `pnpm test:db`

`pnpm test:db` runs `REQUIRE_DB=1 vitest run`. If `DATABASE_URL` is not set in
the shell, it fails with:

```
REQUIRE_DB=1 but DATABASE_URL is not set.
```

Export it before running:

```sh
export DATABASE_URL=postgres://wiki:wiki@localhost:5432/wiki
pnpm test:db
```

### `BETTER_AUTH_URL` on a non-default port

Better Auth checks the origin of incoming requests against `BETTER_AUTH_URL`.
If you run the dev server on port 3100 (e.g. `pnpm dev:e2e`), set
`BETTER_AUTH_URL` to match:

```sh
BETTER_AUTH_URL=http://127.0.0.1:3100 pnpm dev:e2e
```

The `pnpm dev:e2e` script already does this. For other ports, set the env var
to `http://127.0.0.1:<port>`.

### Dev server fails to start

- Ensure Docker is running: `docker compose ps`.
- Ensure `.env.local` exists with a non-empty `BETTER_AUTH_SECRET` (a string of
  at least 32 characters that is not the placeholder
  `dev-secret-change-me-please-32chars`).
- Ensure port 3000 (or 3100 for `dev:e2e`) is not in use.
