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

// Stored content is a block list: an array whose elements are block objects.
// A bare string or number is valid JSON but not a document, so it must not be
// accepted and written to the database.
function isBlockList(value: unknown): value is JsonValue[] {
  return Array.isArray(value) && value.every((item) => isRecord(item));
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
