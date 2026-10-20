import { describe, expect, it } from "vitest";

import {
  extractSearchableText,
  parseEditorDocument,
  serializeEditorDocument,
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
