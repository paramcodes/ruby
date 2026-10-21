# Security

## Reporting a vulnerability

Please do not open a public issue for security vulnerabilities. Instead,
report them privately via GitHub's "Report a vulnerability" feature on the
repository's Security tab, or contact the maintainer directly.

Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Supported versions

Only the latest commit on `master` is supported.

## Security notes

- All page and workspace operations are scoped to the signed-in user
  (server-derived `UserId`).
- Database credentials and auth secrets must never be committed; see
  `.env.example`.
- Run `pnpm verify` before submitting changes.
