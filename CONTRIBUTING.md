# Contributing

Thanks for your interest in Individual Wiki. This project is a small,
focused MVP; contributions are welcome but please discuss large changes first.

## Development setup

See [docs/development/local-setup.md](docs/development/local-setup.md).

## Before you start

- Open an issue describing the change you want to make.
- For non-trivial work, wait for maintainer feedback before investing time.

## Workflow

1. Fork and create a branch from `master`.
2. Make your change with tests.
3. Run the full verification suite:

   ```sh
   pnpm verify
   ```

   (`pnpm verify` needs PostgreSQL and port 3100.)

4. Open a pull request with a clear description and screenshots for UI changes.

## Code standards

- Follow the architecture map in [AGENTS.md](AGENTS.md).
- Domain logic lives in `src/server/`; UI must not import database code.
- All page/workspace operations are scoped to the signed-in user.
- Editor documents go through the versioned adapter (`src/components/editor/editor-adapter.ts`).
- Schema changes require a numbered SQL migration in `src/server/db/migrations/`.

## Commit messages

Use Conventional Commits (`feat:`, `fix:`, `docs:`, etc.).

## Reporting bugs

Use the issue template and include reproduction steps, expected vs. actual,
and environment details.
