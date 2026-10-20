"use client";

import { Button } from "@/components/ui/button";

import styles from "./page-editor.module.css";

export type SaveStatusState =
  | { status: "saving" }
  | { status: "saved"; savedAt?: string }
  | { status: "error"; message: string }
  | { status: "conflict"; currentRevision: number };

export type SaveStatusProps = {
  state: SaveStatusState;
  onRetry?: () => void;
};

const messages: Record<SaveStatusState["status"], string> = {
  saving: "Saving…",
  saved: "All changes saved.",
  error: "Couldn’t save.",
  conflict: "Couldn’t save: this page changed in another tab."
};

export function SaveStatus({ onRetry, state }: SaveStatusProps) {
  const message =
    state.status === "error"
      ? `${messages.error} ${state.message}`
      : messages[state.status];

  return (
    <p
      aria-live="polite"
      className={styles.saveStatus}
      data-status={state.status}
      data-testid="save-status"
      role="status"
    >
      <span>{message}</span>
      {state.status === "error" && onRetry ? (
        <Button onClick={onRetry} size="sm" variant="secondary">
          Retry
        </Button>
      ) : null}
    </p>
  );
}
