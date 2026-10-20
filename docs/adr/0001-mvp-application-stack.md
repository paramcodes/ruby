---
status: accepted
---

# MVP application stack

For the MVP, use Next.js App Router and strict TypeScript for the application, PostgreSQL with Drizzle and versioned SQL migrations for persistence, and an accessible-primitives-based custom design system for the UI. This keeps the product in one typed application while retaining a relational source of truth and control over the visual language. Use BlockNote as the first editor candidate, behind an editor adapter and with versioned stored documents; a focused prototype must validate the required interactions and styling before the editor is treated as committed. If it fails that check, revisit the editor choice before building the full writing flow.

## Consequences

- Keep domain operations and authorization independent of UI components and editor serialization.
- Treat the editor document format as versioned persisted data, with an explicit migration path.
- Revisit this choice if the prototype reveals a mismatch in required editing behavior or design control.
