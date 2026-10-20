"use client";

import dynamic from "next/dynamic";

import styles from "./editor-prototype.module.css";

// BlockNote builds a ProseMirror view, which needs a DOM. Loading the canvas
// only in the browser keeps server rendering free of editor internals.
const EditorPrototypeCanvas = dynamic(
  () =>
    import("./editor-prototype-canvas").then(
      (module) => module.EditorPrototypeCanvas
    ),
  {
    ssr: false,
    loading: () => (
      <p className={styles.loading} role="status">
        Loading editor prototype…
      </p>
    )
  }
);

export function EditorPrototype() {
  return <EditorPrototypeCanvas />;
}
