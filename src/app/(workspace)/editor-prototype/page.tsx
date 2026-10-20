import type { Metadata } from "next";

import { EditorPrototype } from "@/components/editor/editor-prototype";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Editor prototype — Individual Wiki",
  description: "Manual validation prototype for the writing editor."
};

export default function EditorPrototypePage() {
  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Prototype</p>
        <h1 className={styles.title}>Block editor tryout</h1>
        <p className={styles.lead}>
          This page is a validation surface, not a product route. Edit the
          fixture, open the slash menu, reorder blocks, and compare what you see
          with the token-based design system. The panel reports what the adapter
          would persist and search.
        </p>
        <p className={styles.note}>
          The go/no-go decision lives in{" "}
          <code>docs/editor-prototype-checklist.md</code>.
        </p>
      </header>
      <EditorPrototype />
    </article>
  );
}
