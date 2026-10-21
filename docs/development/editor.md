# Editor

How the block editor is built, and the rules that keep it working.

## Boundaries

| File | Responsibility |
| --- | --- |
| `src/components/editor/editor-adapter.ts` | The only place that knows the stored document shape. `EditorDocument` carries a `schemaVersion`, parsing validates it, serializing stays inside JSON, and `extractSearchableText` feeds the search index. UI code never touches a document's JSON. |
| `src/components/editor/editor-canvas.tsx` | Mounts BlockNote, provides the components context, and renders the two custom surfaces: the slash menu and the formatting toolbar. |
| `src/components/editor/editor-components.tsx` | Every piece of BlockNote chrome the app renders itself. |
| `src/components/editor/formatting-toolbar.tsx` | The bubble toolbar that appears on a text selection. |
| `src/components/editor/slash-menu.tsx` | The slash command list and the block commands it calls. |
| `src/components/editor/page-editor.tsx` | Autosave, save status, and the read-only state for archived pages. |

## The components context is all-or-nothing

BlockNote renders its chrome through `ComponentsContext`. Supplying a context
replaces the defaults: every group a mounted feature reads must exist, or the
editor throws `Cannot read properties of undefined (reading 'Root')` and the
page dies.

- The context provides `SideMenu`, `SuggestionMenu`, `TableHandle`, and
  `Generic.Menu`. Those four cover every BlockNote feature the app mounts:
  the slash menu, the side menu, and the table handles.
- BlockNote's own formatting and link toolbars stay off
  (`formattingToolbar={false}`, `linkToolbar={false}`). The custom markup owns
  those surfaces.
- Turning on a BlockNote feature means adding its component group to
  `editor-components.tsx` first, with the same token styling as the rest.

## Focus and selection

A menu that takes focus clears the editor's DOM selection. BlockNote hides the
toolbar when that happens, and a style applied to an empty selection does
nothing. Three rules keep the toolbar usable:

1. Render menus into a container registered with
   `editor.registerPortalElement`, so BlockNote counts the menu as editor UI
   and does not read the focus change as a blur.
2. Remember the selected range and restore it with
   `editor._tiptapEditor.commands.setTextSelection` before applying a style.
3. Return focus to the editor when the menu closes. The trigger is gone by
   then, so Radix's default focus restore lands on the document, which reads
   as a blur and hides the toolbar again.

## What the toolbar offers

Bold, italic, underline, strike, inline code, text colour, highlight colour,
alignment, links, and the block type. Colours come from `COLORS_DEFAULT` in
`@blocknote/core`; BlockNote's own stylesheet renders the marks.

## Blocks

The slash menu offers paragraph, headings 1-3, bullet list, numbered list,
checklist, quote, divider, code block, and table. A table carries its shape in
its content (`tableContent` with rows and cells), not in props, and the table
handles grow rows and columns.

## Storage

Documents are stored as JSON through the adapter. Tables, colours, alignment,
and links survive a save and a reload.

## Tests

- `src/components/editor/editor-adapter.test.ts` — parsing, serializing, block
  commands, and the table shape.
- `tests/e2e/editor-interactions.spec.ts` — the slash menu inserts every block
  type and persists it, and the keyboard shortcuts reorder blocks with undo
  and redo.
- `tests/e2e/page-editing.spec.ts` — typing autosaves and the content survives
  a reload.

## Open manual checks

Carried over from the [editor prototype checklist](../editor-prototype-checklist.md)
and still unverified on a real device or with assistive technology:

1. Tab and Shift+Tab to nest and outdent list items.
2. Touch drag-to-reorder, now that the rail is a drawer on touch screens.
3. IME composition (Japanese, Chinese).
4. Screen-reader announcement of the slash menu, the drag handle, and the
   selection toolbar.
5. Long-document performance at 500+ blocks.

