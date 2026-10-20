---
status: accepted
title: Authentication for the MVP
decision: Use Better Auth (self-hosted, TypeScript-first) with the Drizzle PostgreSQL adapter, email/password credentials, and database-backed sessions; expose it only through src/server/auth.
alternatives:
  - Clerk managed authentication
  - Auth.js v5 (NextAuth) self-hosted authentication
consequences:
  - Authentication tables are owned by the application PostgreSQL database and migrated with Drizzle.
  - Product tables reference Better Auth's text user IDs directly, so ownership stays server-derived.
  - Local development and browser tests need only PostgreSQL and a local secret, with no vendor account or network dependency.
  - Moving away from Better Auth later requires migrating its tables, but user IDs and application data remain under our control.
---

# Authentication for the MVP

## Decision

Use **Better Auth 1.7.x** as the MVP authentication provider.

Rationale:

- It is the library currently recommended for new Next.js projects; Auth.js is in maintenance mode and ships v5 as a beta (`next-auth@5.0.0-beta.32`), while Lucia and its Drizzle adapter are deprecated.
- It stores users, sessions, accounts, and verification records in our own PostgreSQL database through the official Drizzle adapter, matching the existing Drizzle/PostgreSQL ownership model.
- It provides built-in, secure email/password authentication and database-backed sessions, avoiding a hand-rolled password and session implementation.
- It gives a stable `user.id` string that server code can derive from the session without accepting any client-supplied ownership value.

## Comparison

| Criterion | Clerk (managed) | Auth.js v5 (library) | Better Auth (library) |
| --- | --- | --- | --- |
| Next.js App Router | First-class SDK and proxy helper | Supported, but v5 is beta and needs split edge/Node config | Official Next.js integration, Node proxy, `toNextJsHandler` |
| PostgreSQL/Drizzle ownership | User data stays in Clerk; our DB stores only Clerk IDs | Drizzle adapter available; sessions often JWT-cookie based | Auth tables live in our DB through the Drizzle adapter |
| Secure sessions | Clerk-controlled JWTs and revocation | JWT sessions by default; DB sessions possible | Opaque DB-backed session tokens; immediate server-side revocation |
| Fresh-worktree local setup | Requires Clerk keys and network access | Requires `AUTH_SECRET` and provider setup | Requires `DATABASE_URL` and `BETTER_AUTH_SECRET` only |
| Test identities | Requires Clerk test users and testing tokens | Manual user creation and password hashing | Seed deterministic users through the auth API or database |
| Migration cost | High: export users and map external IDs | Medium: Auth.js table shapes and beta API churn | Medium-low: tables are ours and user IDs remain stable |

## Integration approach (for Task 4)

- Configure `betterAuth` in `src/server/auth/auth.ts` with `drizzleAdapter(db, { provider: "pg" })`, email/password credentials, and the `nextCookies()` plugin as the last plugin.
- Mount handlers at `src/app/api/auth/[...all]/route.ts` using `toNextJsHandler(auth)`.
- Implement `getCurrentUser()` in `src/server/auth/current-user.ts` by calling `auth.api.getSession({ headers: await headers() })` and returning `{ id: session.user.id }` or `null`.
- Keep all provider-specific calls inside `src/server/auth/`; domain operations consume only `UserId`.
- Use `proxy.ts` only for optimistic cookie-existence redirects; revalidate the session in the data access layer, server actions, and route handlers.
- Generate Better Auth tables with `pnpm dlx @better-auth/cli generate`, then apply them through Drizzle migrations.

## Local development and test identities

- Local development needs only the existing Docker PostgreSQL service and `BETTER_AUTH_SECRET`; no vendor dashboard or external identity service.
- Browser tests can create or reuse a deterministic test user through `auth.api.signUpEmail` in Playwright global setup, or through `pnpm db:seed`.
- Unit tests mock or inject session resolution at `getCurrentUser()` rather than depending on networked auth services.
- Seed data must use stable credentials documented in `docs/development/local-setup.md` (Task 16) and be idempotent.

## Migration notes

- Auth.js remains a viable fallback if Better Auth lacks a required provider, but it would add manual credential handling and beta-version risk.
- Clerk is rejected for the MVP because it moves user data and test identities outside our database and requires vendor keys in every fresh worktree and CI run.
- Social login, passkeys, MFA, and organizations are deferred; Better Auth supports them through plugins if later required without changing the core user/session tables.
- If replacing Better Auth later, keep application foreign keys on the text user ID and migrate only the auth-owned tables.

## Consequences

- Task 4 adds the `better-auth` dependency and auth boundary implementation; no auth code is added by this ADR.
- The database schema will include `user`, `session`, `account`, and `verification` tables owned by Better Auth but migrated by Drizzle.
- Every protected operation must resolve `UserId` server-side; client input cannot supply the acting user ID.
- CI must provide `BETTER_AUTH_SECRET` and PostgreSQL for auth and browser tests.<|end|><|start|><|start|>assistant to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="path">
/home/param/.codex/worktrees/54db/ruby/docs/adr/0003-authentication-for-the-mvp.md