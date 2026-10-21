---
status: accepted
---

# MVP application stack

For the MVP, use Next.js App Router and strict TypeScript for the application, PostgreSQL with Drizzle and versioned SQL migrations for persistence, and an accessible-primitives-based custom design system for the UI. This keeps the product in one typed application while retaining a relational source of truth and control over the visual language. Use BlockNote as the first editor candidate, behind an editor adapter and with versioned stored documents; a focused prototype must validate the required interactions and styling before the editor is treated as committed. If it fails that check, revisit the editor choice before building the full writing flow.

## Editor prototype validation

The BlockNote 0.56.0 prototype (see
[editor prototype checklist](../../editor-prototype-checklist.md))
validates every block type and primary interaction the MVP needs. Automated
browser checks pass for schema parsing, block rendering, the slash menu,
drag-to-reorder, and keyboard shortcuts. Five manual checks remain pending:

1. **Tab nesting** — Tab and Shift+Tab to nest and outdent list items.
2. **Touch drag** — drag-to-reorder on a touch device and mobile toolbar presence.
3. **IME composition** — Japanese/Chinese input method editor composition.
4. **Screen-reader navigation** — VoiceOver and NVDA announcement of the slash
   menu, drag handles, and block structure.
5. **Long-document performance** — 500+ blocks without jank or dropped keystrokes.

The decision to keep BlockNote stands unless any of these checks reveal a
mismatch in required editing behavior or design control.

## Consequences

- Keep domain operations and authorization independent of UI components and editor serialization.
- Treat the editor document format as versioned persisted data, with an explicit migration path.
- Revisit this choice if the prototype reveals a mismatch in required editing behavior or design control.
