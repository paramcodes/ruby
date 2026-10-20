---
status: accepted
---

# Domain boundaries and agent verification

Organize the application around product domains such as accounts, private workspaces, pages, and search. Each domain owns its types, validation, commands, queries, and persistence access; UI components call domain operations and do not write database rows directly. Enforce user ownership at those operation boundaries. Add sharing as a separate domain when collaboration is in scope. This makes the safe implementation path easy to follow and gives static checks and tests clear seams to enforce, which is more reliable for agent contributions than relying on long prose instructions.

## Consequences

- Keep editor-specific data behind an adapter and keep page lifecycle behavior in the page domain.
- Prefer types, lint rules, tests, and CI checks for enforceable conventions; keep `AGENTS.md` concise and link deeper explanations from `docs/`.
- Provide deterministic local setup and browser verification so changes can be checked in a fresh worktree.
