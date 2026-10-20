# Task 1 report: bootable application and static checks

## Files changed

- Added the Next.js App Router application setup: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.prettierrc.json`, and `.prettierignore`.
- Added static tooling: `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, and `.github/workflows/ci.yml`.
- Added the minimal application route and design tokens: `src/app/layout.tsx`, `src/app/page.tsx`, and `src/styles/globals.css`.
- Added the Vitest setup and home-route smoke test: `src/test/setup.ts` and `src/app/page.test.tsx`.

## TDD evidence

The test protects against removing or changing the home route's accessible `Your personal wiki` heading.

### RED

Command:

```sh
pnpm test src/app/page.test.tsx
```

Before `src/app/page.tsx` existed, Vitest failed because it could not resolve `./page` from `src/app/page.test.tsx`. This was the expected missing-route failure.

### GREEN

Command:

```sh
pnpm test src/app/page.test.tsx
```

Result after adding the route and Vitest React transform:

```text
Test Files  1 passed (1)
Tests  1 passed (1)
```

## Verification

- `pnpm install --frozen-lockfile` completed successfully after approving the transitive `unrs-resolver` postinstall script in `pnpm-workspace.yaml`.
- `pnpm lint` passed.
- `pnpm format:check` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed: 1 file and 1 test.
- `pnpm build` passed. Next.js 16.4.2 built the static `/` route.
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passed.
- A local dev-server smoke check started `pnpm dev`, fetched `http://127.0.0.1:3000`, and found `Your personal wiki` in the response.
- A targeted ESLint stdin probe under `src/app` importing `@/db` failed with `no-restricted-imports`, confirming the UI-to-persistence boundary rule is active.

## Self-review

- The root layout contains the required `html` and `body` elements and uses Next metadata.
- TypeScript enables strict mode plus unchecked-index and exact-optional-property checks.
- The ESLint boundary rule covers aliases, likely relative persistence paths, and direct Drizzle/Postgres imports for both `src/app` and `src/components`.
- CI installs with the lockfile and runs lint, formatting, type checks, unit tests, and the production build.
- Generated dependencies and Next, coverage, and Playwright output are ignored.

## Concerns

- The current `eslint-config-next` dependency tree requires ESLint 9.39.1. pnpm reports that version as deprecated during installation; ESLint 10 creates peer-dependency conflicts with its bundled plugins. Linting itself passes without warnings.
- There are no browser test specifications in Task 1. `test:e2e` is configured with a local Playwright web server for the browser checks added in Task 16. A direct Python Playwright smoke attempt could not run because this environment lacks the Python `playwright` module; the local HTTP smoke check passed instead.
- Prettier ignores `docs/` because pre-existing roadmap and plan files do not match the configured Prettier style. Application, configuration, workflow, and lockfile formatting are checked in CI.
