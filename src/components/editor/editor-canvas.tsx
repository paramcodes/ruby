"use client";

import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react";
import { useCreateBlockNote } from "@blocknote/react";

import "@blocknote/react/style.css";

import { prototypeComponents } from "./editor-components";
import editorStyles from "./editor-prototype.module.css";
import {
  serializeEditorDocument,
  toEditorBlocks,
  type EditorDocument
} from "./editor-adapter";
import styles from "./page-editor.module.css";

export type EditorCanvasProps = {
  initialDocument: EditorDocument;
  onChange: (document: EditorDocument) => void;
};

export function EditorCanvas({ initialDocument, onChange }: EditorCanvasProps) {
  const initialBlocks = toEditorBlocks(initialDocument);
  const editor = useCreateBlockNote({
    ...(initialBlocks.length > 0 ? { initialContent: initialBlocks } : {}),
    animations: false
  });

  function handleEditorChange() {
    onChange(serializeEditorDocument(editor.document));
  }

  return (
    <div className={styles.editorCanvas}>
      <div className={editorStyles.prototype}>
        <div className={editorStyles.editorFrame}>
          <ComponentsContext.Provider value={prototypeComponents}>
            <BlockNoteViewRaw
              // The default block schema in BlockNote's own types does not
              // satisfy its generic constraint under exactOptionalPropertyTypes.
              // The cast keeps the runtime shape intact and localises the
              // mismatch here.
              editor={editor as never}
              emojiPicker={false}
              filePanel={false}
              formattingToolbar={false}
              linkToolbar={false}
              onChange={handleEditorChange}
              sideMenu
              slashMenu
              tableHandles={false}
              comments={false}
            />
          </ComponentsContext.Provider>
        </div>
      </div>
    </div>
  );
}
