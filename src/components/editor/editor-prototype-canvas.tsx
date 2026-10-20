"use client";

import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react";
import { useCreateBlockNote } from "@blocknote/react";
import type { PartialBlock } from "@blocknote/core";
import { useMemo, useState } from "react";

import "@blocknote/react/style.css";

import styles from "./editor-prototype.module.css";
import { prototypeComponents } from "./editor-components";
import {
  extractSearchableText,
  parseEditorDocument,
  serializeEditorDocument,
  type EditorDocument
} from "./editor-adapter";

// Fixture data deliberately covers every block the writing flow must support.
// It is the starting point for the manual checklist in
// docs/editor-prototype-checklist.md.
const fixture: PartialBlock[] = [
  {
    type: "heading",
    props: { level: 1 },
    content: "Field notes from the reading room"
  },
  {
    type: "paragraph",
    content:
      "A wiki page starts as a thought and grows into a place. This fixture exercises the block types the writing flow depends on."
  },
  {
    type: "heading",
    props: { level: 2 },
    content: "What the page holds"
  },
  {
    type: "bulletListItem",
    content: "Headings frame a section",
    children: [
      {
        type: "bulletListItem",
        content: "Nested bullets keep detail out of the main line"
      }
    ]
  },
  {
    type: "bulletListItem",
    content: "Paragraphs carry the argument"
  },
  {
    type: "numberedListItem",
    content: "Draft the page in the editor"
  },
  {
    type: "numberedListItem",
    content: "Save it with a revision check"
  },
  {
    type: "checkListItem",
    props: { checked: true },
    content: "Confirm headings and lists render in product type"
  },
  {
    type: "checkListItem",
    props: { checked: false },
    content: "Confirm the slash menu opens on an empty block"
  },
  {
    type: "quote",
    content:
      "The page is the unit of memory; the editor is only the hand that writes it."
  },
  {
    type: "codeBlock",
    props: { language: "typescript" },
    content: "const revision = savePageContent(userId, pageId, document, 1);"
  },
  { type: "divider" },
  {
    type: "paragraph",
    content:
      "Try the slash menu here, reorder the blocks with the side menu, and use shift+enter for a soft break."
  }
];

export function EditorPrototypeCanvas() {
  const editor = useCreateBlockNote({
    initialContent: fixture,
    animations: false
  });

  const initialDocument = useMemo(() => serializeEditorDocument(fixture), []);
  const [document, setDocument] = useState<EditorDocument>(initialDocument);
  const [parseStatus, setParseStatus] = useState("valid");

  const searchableText = extractSearchableText(document);
  const blockCount = Array.isArray(document.content)
    ? document.content.length
    : 0;

  function handleChange() {
    try {
      const next = serializeEditorDocument(editor.document);
      setDocument(next);

      const parsed = parseEditorDocument(next);
      setParseStatus(parsed.ok ? "valid" : parsed.reason);
    } catch {
      setParseStatus("invalid");
    }
  }

  return (
    <div className={styles.prototype}>
      <div className={styles.editorFrame}>
        <ComponentsContext.Provider value={prototypeComponents}>
          <BlockNoteViewRaw
            // The default block schema in BlockNote's own types does not satisfy
            // its generic constraint under exactOptionalPropertyTypes. The cast
            // keeps the runtime shape intact and localises the mismatch here.
            editor={editor as never}
            onChange={handleChange}
            slashMenu
            sideMenu
            formattingToolbar={false}
            linkToolbar={false}
            emojiPicker={false}
            filePanel={false}
            tableHandles={false}
            comments={false}
          />
        </ComponentsContext.Provider>
      </div>

      <aside
        aria-labelledby="adapter-output-heading"
        className={styles.inspector}
      >
        <h2 className={styles.inspectorTitle} id="adapter-output-heading">
          Adapter output
        </h2>
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Schema version</dt>
            <dd>{document.schemaVersion}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Top-level blocks</dt>
            <dd>{blockCount}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Parse status</dt>
            <dd>{parseStatus}</dd>
          </div>
        </dl>
        <h3 className={styles.inspectorSubtitle}>Searchable text</h3>
        <p className={styles.searchText}>{searchableText || "No text yet."}</p>
      </aside>
    </div>
  );
}
