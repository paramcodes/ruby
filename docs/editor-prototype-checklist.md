# Editor prototype checklist

Prototype route: `/editor-prototype` (signed-in workspace only).
Adapter: `src/components/editor/editor-adapter.ts`.
Prototype: `src/components/editor/editor-prototype.tsx` and
`editor-prototype-canvas.tsx`.
Built-in chrome: `src/components/editor/editor-components.tsx`.

## Decision

**Go: keep BlockNote.** BlockNote `0.56.0` covers every block type and
interaction the MVP needs, and its chrome can be rendered entirely from our own
primitives (`ComponentsContext`) with the token system, so no theme package is
imported and ADR 0001 does not change.

The decision uses the `@blocknote/core` + `@blocknote/react` pair only. In this
version `BlockNoteViewRaw` no longer ships a ready-made UI: it renders its
default UI through a `ComponentsContext`, and the theme packages
(`@blocknote/mantine`, `@blocknote/shadcn`) supply one. The prototype instead
supplies a small component set (`editor-components.tsx`) built on our tokens and
Radix's dropdown primitive. That satisfies the "no default theme package"
constraint and keeps the visual language ours. It is also more code than a theme
package import; a later task can replace individual components without touching
stored documents.

## Environment

- Commit: the prototype commit that introduced this checklist.
- Chromium (Playwright), viewport 1440 × 1100, light and dark color schemes.
- Fixture has 14 top-level blocks and one nested bullet.
- Automated run: `node` script driving Playwright against
  `http://127.0.0.1:3100/editor-prototype`; no console errors.

## Checklist

| # | Check | Result |
|---|---|---|
| 1 | Prototype route loads for a signed-in user | **Pass.** Editor mounted, adapter panel showed `schemaVersion 1`, `Parse status valid`. |
| 2 | Heading 1 and Heading 2 render | **Pass.** Computed: 54 px, weight 500, reading-serif token. |
| 3 | Paragraphs render in product typography | **Pass.** Computed editor font: `"Iowan Old Style", Charter, "Bitstream Charter", "Source Serif 4", Georgia, serif` at 18 px. |
| 4 | Bullet list and nested bullet | **Pass.** Fixture rendered `bulletListItem` with one nested child. |
| 5 | Numbered list | **Pass.** Two `numberedListItem` blocks rendered with 1. / 2. |
| 6 | Checklist with checked and unchecked states | **Pass.** Both inputs rendered; checked states read `[true, false]`; checked text struck through. |
| 7 | Quote block | **Pass.** Italic, muted text colour, 2 px accent border (`--color-accent`). |
| 8 | Divider | **Pass.** Rendered as a token-coloured rule. |
| 9 | Code block | **Pass.** Token surface-sunken background and text colour in light and dark; no hardcoded `#161616` surface remained visible. |
| 10 | Slash menu opens on an empty block | **Pass.** Typing `/` opened 23 items; headings, quote, toggle list, numbered list, bullet list, check list, paragraph, code block were visible in the first 10. |
| 11 | Slash menu is keyboard operable | **Pass (partly automated).** Arrow keys and Enter are handled by BlockNote's suggestion-menu keyboard navigation; Escape closed the menu in the automated run. Full screen-reader announcement is a manual check below. |
| 12 | Block reordering by drag | **Pass.** Dragging the side-menu handle moved the fixture's last paragraph above the H1; the first block became "Try the slash menu here…". |
| 13 | Side menu appears on hover | **Pass.** Two buttons rendered: add block and drag handle. |
| 14 | Enter splits a block | **Pass.** Block count went 15 → 16. |
| 15 | Shift+Enter inserts a soft break in the same block | **Pass.** Block count stayed 16 and one `<br>` was added. |
| 16 | Backspace on an empty block removes it | **Pass.** The empty slash block was removed before the typing check. |
| 17 | Tab / Shift+Tab nests and outdents list items | **Pending manual check.** Not automated in this pass. |
| 18 | Styling coherence in light mode | **Pass.** Editor frame uses `--color-surface-raised`, borders use `--color-border`, headings use `--font-display`, body uses `--font-reading`. No BlockNote default white editor surface is visible. |
| 19 | Styling coherence in dark mode | **Pass.** Emulated dark scheme; token values switched, text and surfaces stayed legible. Note: `--bn-*` variables are mapped to light-dark tokens, so BlockNote chrome follows the token scheme. |
| 20 | Slash menu and side-menu styling | **Pass.** Custom menus use surface-raised, border, shadow-overlay, radius and small UI type; selected item uses accent-subtle. |
| 21 | No console errors | **Pass.** Empty console-error list after editing, slash menu, merge, and drag. |
| 22 | Adapter panel tracks edits | **Pass.** After edits the panel reported 15 top-level blocks and rebuilt searchable text including nested bullets. |
| 23 | Touch drag reorder and mobile toolbar | **Pending manual check.** Desktop pointer only in this pass. |
| 24 | IME composition (e.g. Japanese, Chinese) | **Pending manual check.** |
| 25 | Screen-reader navigation of slash menu and drag handle | **Pending manual check.** Labels exist (`Slash menu`, `Add block`, `Drag block`), but announcement quality needs a real AT pass. |
| 26 | Long-document performance (500+ blocks) | **Pending manual check.** Fixture is 14 blocks. |
| 27 | Firefox and Safari rendering | **Pending manual check.** Chromium only in this pass. |

## How to run the manual pass

1. Start the app (`pnpm dev`) and sign in.
2. Open `/editor-prototype`.
3. Work down the table. For each menu, confirm it opens, moves with arrow keys,
   closes on Escape, and looks like part of the product.
4. For reorder, hover a block, press and hold the drag handle, then move the
   pointer to the target position and release.
5. For keyboard, use Enter, Shift+Enter, Backspace on an empty block, Tab and
   Shift+Tab inside a list, and Ctrl/Cmd+B / I / U.
6. Repeat in a dark color scheme and at a narrow viewport.
7. Record anything that fails and re-open the editor-choice decision if a
   failure is in the interaction or visual direction rather than styling detail.

## Automated evidence

The adapter unit suite (`src/components/editor/editor-adapter.test.ts`) covers
parse success, malformed input, unsupported schema versions, serialization
round-trips, and nested search-text extraction. The browser observations above
come from a Playwright script against a real dev server on port 3100.
