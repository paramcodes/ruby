import { describe, expect, it, vi } from "vitest";

import {
  createEditorBlock,
  extractSearchableText,
  insertBlockCommand,
  moveBlockCommand,
  parseEditorDocument,
  redoEditorChange,
  serializeEditorDocument,
  setBlockCommand,
  undoEditorChange,
  type EditorCommandHost,
  type EditorDocument
} from "./editor-adapter";

const fixtureDocument: EditorDocument = {
  schemaVersion: 1,
  content: [
    {
      id: "heading-1",
      type: "heading",
      props: { level: 1 },
      content: [{ type: "text", text: "Field notes", styles: {} }],
      children: []
    },
    {
      id: "paragraph-1",
      type: "paragraph",
      props: {},
      content: [
        { type: "text", text: "A quiet place to ", styles: {} },
        { type: "text", text: "think.", styles: { italic: true } }
      ],
      children: []
    },
    {
      id: "list-1",
      type: "bulletListItem",
      props: {},
      content: [{ type: "text", text: "First point", styles: {} }],
      children: [
        {
          id: "nested-1",
          type: "bulletListItem",
          props: {},
          content: [{ type: "text", text: "Nested detail", styles: {} }],
          children: []
        }
      ]
    }
  ]
};

describe("parseEditorDocument", () => {
  it("accepts a versioned document and returns it unchanged", () => {
    expect(parseEditorDocument(fixtureDocument)).toEqual({
      ok: true,
      value: fixtureDocument
    });
  });

  it("rejects malformed input with the invalid reason", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      "a string",
      [],
      {},
      { schemaVersion: 1 },
      { schemaVersion: "1", content: [] },
      { schemaVersion: 1, content: undefined },
      { schemaVersion: 1, content: { nested: Number.NaN } },
      { schemaVersion: 1, content: { nested: new Date() } }
    ];

    for (const input of malformed) {
      expect(parseEditorDocument(input)).toEqual({
        ok: false,
        reason: "invalid"
      });
    }
  });

  it("rejects content that is not a block list", () => {
    expect(parseEditorDocument({ schemaVersion: 1, content: "hello" })).toEqual(
      { ok: false, reason: "invalid" }
    );
    expect(parseEditorDocument({ schemaVersion: 1, content: 42 })).toEqual({
      ok: false,
      reason: "invalid"
    });
    expect(
      parseEditorDocument({
        schemaVersion: 1,
        content: [{ id: "block-1", type: "paragraph" }, "not a block"]
      })
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a block with a nested value that JSON cannot represent", () => {
    const block = {
      id: "block-1",
      type: "paragraph",
      content: [{ type: "text", text: "visible" }],
      children: []
    };

    expect(
      parseEditorDocument({
        schemaVersion: 1,
        content: [{ ...block, props: { align: Number.NaN } }]
      })
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      parseEditorDocument({
        schemaVersion: 1,
        content: [{ ...block, props: { align: undefined } }]
      })
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      parseEditorDocument({
        schemaVersion: 1,
        content: [{ ...block, props: { createdAt: new Date() } }]
      })
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      parseEditorDocument({
        schemaVersion: 1,
        content: [
          {
            ...block,
            children: [{ ...block, id: "nested", content: [{ text: 1n }] }]
          }
        ]
      })
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects an unsupported schema version without throwing", () => {
    expect(parseEditorDocument({ schemaVersion: 2, content: [] })).toEqual({
      ok: false,
      reason: "unsupported-version"
    });
  });
});

describe("serializeEditorDocument", () => {
  it("round-trips a document through parse", () => {
    const serialized = serializeEditorDocument(fixtureDocument.content);

    expect(serialized).toEqual(fixtureDocument);
    expect(parseEditorDocument(serialized)).toEqual({
      ok: true,
      value: fixtureDocument
    });
  });

  it("drops values that JSON cannot represent instead of persisting them", () => {
    const serialized = serializeEditorDocument([
      { id: "block-1", type: "paragraph", content: [], children: [] },
      { id: "block-2", type: "paragraph", extra: undefined, content: [] }
    ]);

    expect(serialized).toEqual({
      schemaVersion: 1,
      content: [
        { id: "block-1", type: "paragraph", content: [], children: [] },
        { id: "block-2", type: "paragraph", content: [] }
      ]
    });
  });
});

describe("extractSearchableText", () => {
  it("collects text from nested blocks without structural noise", () => {
    const document: EditorDocument = {
      schemaVersion: 1,
      content: [
        {
          id: "heading-1",
          type: "heading",
          props: { level: 2 },
          content: [{ type: "text", text: "Trip plan", styles: {} }],
          children: []
        },
        {
          id: "quote-1",
          type: "paragraph",
          props: {},
          content: [
            { type: "text", text: "Pack light", styles: {} },
            { type: "link", href: "https://example.test", content: [] }
          ],
          children: [
            {
              id: "code-1",
              type: "codeBlock",
              props: { language: "text" },
              content: [{ type: "text", text: "const days = 3;", styles: {} }],
              children: []
            }
          ]
        }
      ]
    };

    const text = extractSearchableText(document);

    expect(text).toBe("Trip plan\nPack light\nconst days = 3;");
    expect(text).not.toContain("heading-1");
    expect(text).not.toContain("level");
  });

  it("collapses whitespace and ignores non-text values", () => {
    const document: EditorDocument = {
      schemaVersion: 1,
      content: [
        {
          id: "a",
          type: "paragraph",
          props: {},
          content: [
            { type: "text", text: "  spaced   words ", styles: {} },
            { type: "text", text: "", styles: {} }
          ],
          children: []
        },
        { id: "b", type: "divider", props: {} }
      ]
    };

    expect(extractSearchableText(document)).toBe("spaced words");
  });

  it("returns an empty string for an empty document", () => {
    expect(extractSearchableText({ schemaVersion: 1, content: [] })).toBe("");
  });
});

function fakeEditor(block: {
  id: string;
  type: string;
  content?: unknown;
  children?: unknown[];
}) {
  const editor: EditorCommandHost = {
    getTextCursorPosition: () => ({ block }),
    insertBlocks: vi.fn(),
    updateBlock: vi.fn(),
    moveBlocksUp: vi.fn(),
    moveBlocksDown: vi.fn(),
    undo: vi.fn(() => true),
    redo: vi.fn(() => true)
  };

  return { editor, block };
}

describe("editor commands", () => {
  it("maps every block command to a supported partial block", () => {
    expect(createEditorBlock("paragraph")).toEqual({ type: "paragraph" });
    expect(createEditorBlock("heading-1")).toEqual({
      type: "heading",
      props: { level: 1 }
    });
    expect(createEditorBlock("heading-2")).toHaveProperty("props.level", 2);
    expect(createEditorBlock("heading-3")).toHaveProperty("props.level", 3);
    expect(createEditorBlock("bullet-list")).toEqual({
      type: "bulletListItem"
    });
    expect(createEditorBlock("numbered-list")).toEqual({
      type: "numberedListItem"
    });
    expect(createEditorBlock("checklist")).toEqual({
      type: "checkListItem",
      props: { checked: false }
    });
    expect(createEditorBlock("quote")).toEqual({ type: "quote" });
    expect(createEditorBlock("divider")).toEqual({ type: "divider" });
    expect(createEditorBlock("code-block")).toEqual({
      type: "codeBlock",
      props: { language: "text" }
    });
  });

  it("builds a table with a header row and three columns", () => {
    const table = createEditorBlock("table") as unknown as {
      type: string;
      content: {
        type: string;
        headerRows: number;
        rows: { cells: unknown[] }[];
      };
    };

    expect(table.type).toBe("table");
    expect(table.content.type).toBe("tableContent");
    expect(table.content.headerRows).toBe(1);
    expect(table.content.rows).toHaveLength(3);
    expect(table.content.rows[0]?.cells).toHaveLength(3);
    expect(table.content.rows[2]?.cells).toEqual(["", "", ""]);
  });

  it("replaces a blank paragraph and inserts after a block with content", () => {
    const blank = fakeEditor({
      id: "blank",
      type: "paragraph",
      content: [],
      children: []
    });
    insertBlockCommand(blank.editor, "heading-2");

    expect(blank.editor.updateBlock).toHaveBeenCalledWith("blank", {
      type: "heading",
      props: { level: 2 }
    });
    expect(blank.editor.insertBlocks).not.toHaveBeenCalled();

    const filled = fakeEditor({
      id: "filled",
      type: "paragraph",
      content: [{ type: "text", text: "Keep me", styles: {} }],
      children: []
    });
    insertBlockCommand(filled.editor, "divider");

    expect(filled.editor.updateBlock).not.toHaveBeenCalled();
    expect(filled.editor.insertBlocks).toHaveBeenCalledWith(
      [{ type: "divider" }],
      "filled",
      "after"
    );
  });

  it("routes block, move, undo, and redo commands through the editor", () => {
    const { block, editor } = fakeEditor({
      id: "block-1",
      type: "paragraph",
      content: [],
      children: []
    });

    setBlockCommand(editor, "quote");
    expect(editor.updateBlock).toHaveBeenCalledWith("block-1", {
      type: "quote"
    });

    moveBlockCommand(editor, "up");
    moveBlockCommand(editor, "down");
    expect(editor.moveBlocksUp).toHaveBeenCalledTimes(1);
    expect(editor.moveBlocksDown).toHaveBeenCalledTimes(1);

    undoEditorChange(editor);
    redoEditorChange(editor);
    expect(editor.undo).toHaveBeenCalledTimes(1);
    expect(editor.redo).toHaveBeenCalledTimes(1);
    expect(block.id).toBe("block-1");
  });
});
