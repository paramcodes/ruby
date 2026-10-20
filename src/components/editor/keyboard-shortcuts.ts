"use client";

import { useEffect } from "react";

import {
  moveBlockCommand,
  redoEditorChange,
  setBlockCommand,
  undoEditorChange,
  type EditorBlockKind,
  type EditorCommandHost
} from "./editor-adapter";

const blockByDigit: Record<string, EditorBlockKind> = {
  "0": "paragraph",
  "1": "heading-1",
  "2": "heading-2",
  "3": "heading-3"
};

// Returns true when the shortcut was handled, so the caller can prevent the
// browser default and stop ProseMirror from applying the same command twice.
export function handleEditorShortcut(
  event: KeyboardEvent,
  editor: EditorCommandHost
): boolean {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && !event.altKey && key === "z") {
    if (event.shiftKey) {
      redoEditorChange(editor);
    } else {
      undoEditorChange(editor);
    }

    return true;
  }

  if (modifier && !event.altKey && key === "y") {
    redoEditorChange(editor);
    return true;
  }

  if (!modifier && event.altKey && (key === "arrowup" || key === "arrowdown")) {
    moveBlockCommand(editor, key === "arrowup" ? "up" : "down");
    return true;
  }

  if (modifier && event.altKey) {
    const kind = blockByDigit[event.key];

    if (kind) {
      setBlockCommand(editor, kind);
      return true;
    }
  }

  return false;
}

export function useEditorKeyboardShortcuts(editor: EditorCommandHost): void {
  useEffect(() => {
    const element = editor.domElement;

    if (!element) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!handleEditorShortcut(event, editor)) {
        return;
      }

      event.preventDefault();
      // Capture runs before ProseMirror, so stopping propagation keeps a
      // handled undo or redo from running a second time.
      event.stopPropagation();
    }

    element.addEventListener("keydown", handleKeyDown, true);

    return () => {
      element.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [editor]);
}
