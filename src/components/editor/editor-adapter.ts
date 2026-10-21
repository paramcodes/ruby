import type { Block, PartialBlock } from "@blocknote/core";

// Public shape of a persisted editor document. `JsonValue` deliberately mirrors
// JSON itself so the stored payload is portable to any editor implementation.
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export const CURRENT_SCHEMA_VERSION = 1;

export type EditorDocument = {
  schemaVersion: 1;
  content: JsonValue;
};

export type ParseEditorDocumentResult =
  | { ok: true; value: EditorDocument }
  | { ok: false; reason: "invalid" | "unsupported-version" };

// The only application module allowed to name BlockNote document types. The
// import is type-only, so server code that imports this adapter does not pull
// the editor (or ProseMirror) into the server bundle.
type EditorBlockList = Block[];

// Editor seeds do not carry generated ids or defaults, so the initial content
// of a new editor is a partial block list.
export type EditorPartialBlockList = PartialBlock[];

export function parseEditorDocument(input: unknown): ParseEditorDocumentResult {
  if (!isRecord(input)) {
    return { ok: false, reason: "invalid" };
  }

  const version = input["schemaVersion"];

  if (typeof version !== "number" || !Number.isInteger(version)) {
    return { ok: false, reason: "invalid" };
  }

  if (version !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, reason: "unsupported-version" };
  }

  const content = input["content"];

  if (!isBlockList(content)) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    value: { schemaVersion: CURRENT_SCHEMA_VERSION, content }
  };
}

// Editor state is converted through JSON so only values that survive a
// database round-trip are persisted. A document that cannot be represented in
// JSON (functions, cycles, BigInt) is a programming error, not user input, so
// it throws instead of silently losing the user's work.
export function serializeEditorDocument(editorState: unknown): EditorDocument {
  const blocks = editorState as EditorBlockList;
  let content: unknown;

  try {
    content = JSON.parse(JSON.stringify(blocks));
  } catch {
    throw new TypeError("Editor state cannot be serialized as JSON");
  }

  if (!isJsonValue(content)) {
    throw new TypeError("Editor state cannot be serialized as JSON");
  }

  return { schemaVersion: CURRENT_SCHEMA_VERSION, content };
}

// Editor commands live here so UI components never reach into a document's
// JSON. Each command is a small editor operation; the editor owns ids, undo
// history, and the shape of the blocks it creates.
export type EditorBlockKind =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "bullet-list"
  | "numbered-list"
  | "checklist"
  | "quote"
  | "divider"
  | "code-block"
  | "table";

export type EditorCommandBlock = {
  id: string;
  type: string;
  content?: unknown;
  children?: readonly unknown[];
};

// Structural view of the editor commands this application uses. It keeps the
// adapter usable without importing the editor at runtime, and makes command
// tests possible with a small fake.
export type EditorCommandHost = {
  domElement?: HTMLElement | undefined;
  getTextCursorPosition(): { block: EditorCommandBlock };
  insertBlocks(
    blocksToInsert: EditorPartialBlockList,
    referenceBlock: string,
    placement?: "before" | "after" | "first-child" | "last-child"
  ): unknown;
  updateBlock(
    blockToUpdate: string,
    update: EditorPartialBlockList[number]
  ): unknown;
  moveBlocksUp(blockIdentifier?: string): void;
  moveBlocksDown(blockIdentifier?: string): void;
  undo(): boolean;
  redo(): boolean;
};

// A table carries its shape in its content, not in props: one header row and
// three columns of empty cells. The editor fills the cells as the user types.
function createTableBlock(
  rows: number,
  columns: number
): EditorPartialBlockList[number] {
  return {
    type: "table",
    content: {
      type: "tableContent",
      headerRows: 1,
      headerCols: 0,
      rows: Array.from({ length: rows }, () => ({
        cells: Array.from({ length: columns }, () => "")
      }))
    }
  } as unknown as EditorPartialBlockList[number];
}

const blockCommands: Record<EditorBlockKind, EditorPartialBlockList[number]> = {
  paragraph: { type: "paragraph" },
  "heading-1": { type: "heading", props: { level: 1 } },
  "heading-2": { type: "heading", props: { level: 2 } },
  "heading-3": { type: "heading", props: { level: 3 } },
  "bullet-list": { type: "bulletListItem" },
  "numbered-list": { type: "numberedListItem" },
  checklist: { type: "checkListItem", props: { checked: false } },
  quote: { type: "quote" },
  divider: { type: "divider" },
  "code-block": { type: "codeBlock", props: { language: "text" } },
  table: createTableBlock(3, 3)
};

export function createEditorBlock(
  kind: EditorBlockKind
): EditorPartialBlockList[number] {
  return blockCommands[kind];
}

// Slash-menu insertion replaces the empty paragraph that holds the trigger and
// otherwise inserts a new sibling after the current block.
export function insertBlockCommand(
  editor: EditorCommandHost,
  kind: EditorBlockKind
): void {
  const current = editor.getTextCursorPosition().block;
  const block = createEditorBlock(kind);

  if (isBlankParagraph(current)) {
    editor.updateBlock(current.id, block);
    return;
  }

  editor.insertBlocks([block], current.id, "after");
}

// Keyboard block-type commands always convert the current block.
export function setBlockCommand(
  editor: EditorCommandHost,
  kind: EditorBlockKind
): void {
  const current = editor.getTextCursorPosition().block;
  editor.updateBlock(current.id, createEditorBlock(kind));
}

export function moveBlockCommand(
  editor: EditorCommandHost,
  direction: "up" | "down"
): void {
  if (direction === "up") {
    editor.moveBlocksUp();
    return;
  }

  editor.moveBlocksDown();
}

export function undoEditorChange(editor: EditorCommandHost): void {
  editor.undo();
}

export function redoEditorChange(editor: EditorCommandHost): void {
  editor.redo();
}

function isBlankParagraph(block: EditorCommandBlock): boolean {
  const content = block.content;
  const hasContent = Array.isArray(content) && content.length > 0;
  const hasChildren =
    Array.isArray(block.children) && block.children.length > 0;

  return block.type === "paragraph" && !hasContent && !hasChildren;
}

// Parsed content is a list of plain JSON objects. BlockNote accepts those as
// partial blocks and fills in ids, props, and children that a stored document
// already carries.
export function toEditorBlocks(
  document: EditorDocument
): EditorPartialBlockList {
  return document.content as unknown as EditorPartialBlockList;
}

export function extractSearchableText(document: EditorDocument): string {
  const blocks = document.content;

  if (!Array.isArray(blocks)) {
    return "";
  }

  return blocks
    .flatMap(blockLines)
    .map((line) => line.replace(/\s+/gu, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

// A block contributes its own inline text and then the text of its descendants.
// Inline nodes are joined with a space and later collapsed, so styled text
// fragments read as one sentence and an empty link does not add a gap.
function blockLines(node: JsonValue): string[] {
  if (typeof node === "string") {
    return [node];
  }

  if (!isRecord(node)) {
    return [];
  }

  const ownText = inlineText(node["content"]);
  const children = node["children"];
  const childLines = Array.isArray(children)
    ? children.flatMap(blockLines)
    : [];

  return ownText.length > 0 ? [ownText, ...childLines] : childLines;
}

function inlineText(node: JsonValue | unknown): string {
  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node)) {
    return node
      .map((child) => inlineText(child))
      .filter((text) => text.length > 0)
      .join(" ");
  }

  if (!isRecord(node)) {
    return "";
  }

  const text = node["text"];

  if (typeof text === "string") {
    return text;
  }

  return inlineText(node["content"]);
}

// Stored content is a block list: an array of plain objects, each containing
// only values that survive a JSON round-trip. A bare string or number is valid
// JSON but not a document, and a nested function, undefined, Date, or BigInt
// would either be dropped or fail to store, so neither may be accepted.
function isBlockList(value: unknown): value is JsonValue[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && isJsonValue(item))
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item));
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}
