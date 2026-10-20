"use client";

import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react";
import { useCreateBlockNote } from "@blocknote/react";

import "@blocknote/react/style.css";

import { Button } from "@/components/ui/button";

import { prototypeComponents } from "./editor-components";
import editorStyles from "./editor-prototype.module.css";
import {
  moveBlockCommand,
  redoEditorChange,
  serializeEditorDocument,
  toEditorBlocks,
  undoEditorChange,
  type EditorDocument
} from "./editor-adapter";
import { useEditorKeyboardShortcuts } from "./keyboard-shortcuts";
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

  function runCommand(command: () => void) {
    command();
    editor.focus();
  }

  return (
    <div className={styles.editorCanvas}>
      <div
        aria-label="Editor commands"
        className={styles.toolbar}
        role="toolbar"
      >
        <Button
          onClick={() => runCommand(() => undoEditorChange(editor))}
          size="sm"
          variant="secondary"
        >
          Undo
        </Button>
        <Button
          onClick={() => runCommand(() => redoEditorChange(editor))}
          size="sm"
          variant="secondary"
        >
          Redo
        </Button>
        <Button
          onClick={() => runCommand(() => moveBlockCommand(editor, "up"))}
          size="sm"
          variant="secondary"
        >
          Move block up
        </Button>
        <Button
          onClick={() => runCommand(() => moveBlockCommand(editor, "down"))}
          size="sm"
          variant="secondary"
        >
          Move block down
        </Button>
      </div>
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
              slashMenu={false}
              tableHandles={false}
              comments={false}
            >
              <EditorSlashMenu editor={editor} />
            </BlockNoteViewRaw>
          </ComponentsContext.Provider>
        </div>
      </div>
    </div>
  );
}
