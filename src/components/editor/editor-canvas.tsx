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
import { useEditorKeyboardShortcuts } from "./keyboard-shortcuts";
import { EditorFormattingToolbar } from "./formatting-toolbar";
import styles from "./page-editor.module.css";
import { EditorSlashMenu } from "./slash-menu";

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

  useEditorKeyboardShortcuts(editor);

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
              // The formatting toolbar owns link editing, so BlockNote's own
              // link toolbar stays off.
              linkToolbar={false}
              onChange={handleEditorChange}
              sideMenu
              slashMenu={false}
              comments={false}
            >
              <EditorSlashMenu editor={editor} />
              <EditorFormattingToolbar />
            </BlockNoteViewRaw>
          </ComponentsContext.Provider>
        </div>
      </div>
    </div>
  );
}
