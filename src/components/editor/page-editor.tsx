"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  APP_NAVIGATION_EVENT,
  type AppNavigationDetail
} from "@/components/navigation-guard";

import type { EditorDocument } from "./editor-adapter";
import styles from "./page-editor.module.css";
import { SaveStatus, type SaveStatusState } from "./save-status";

const EditorCanvas = dynamic(
  () => import("./editor-canvas").then((module) => module.EditorCanvas),
  {
    ssr: false,
    loading: () => (
      <p className={styles.loading} role="status">
        Loading editor…
      </p>
    )
  }
);

export type EditorSaveResult =
  | { status: "saved"; revision: number; updatedAt: string }
  | { status: "conflict"; currentRevision: number }
  | { status: "invalid" | "failed" | "unauthenticated"; message: string };

export type SavePageContent = (
  pageId: string,
  document: EditorDocument,
  expectedRevision: number
) => Promise<EditorSaveResult>;

export type PageEditorProps = {
  pageId: string;
  initialDocument: EditorDocument;
  initialRevision: number;
  saveContent: SavePageContent;
  /**
   * Overridable for component tests. Production autosave waits 800 ms after the
   * last change so a burst of typing produces one request.
   */
  autosaveDelayMs?: number;
};

type ConflictResolution = "reload" | "overwrite";

const defaultAutosaveDelayMs = 800;

export function PageEditor({
  autosaveDelayMs = defaultAutosaveDelayMs,
  initialDocument,
  initialRevision,
  pageId,
  saveContent
}: PageEditorProps) {
  const router = useRouter();
  const [document, setDocument] = useState(initialDocument);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveStatusState>({
    status: "saved"
  });
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [pendingResolution, setPendingResolution] =
    useState<ConflictResolution | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const latestDocument = useRef(initialDocument);
  const expectedRevision = useRef(initialRevision);
  const conflict = useRef<number | null>(null);
  const inFlight = useRef(false);
  const pendingRequest = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const mounted = useRef(true);

  const saveLatest = useCallback(
    async function saveLatest(): Promise<void> {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      if (conflict.current !== null) {
        return;
      }

      if (inFlight.current) {
        pendingRequest.current = true;
        return;
      }

      const snapshot = latestDocument.current;
      inFlight.current = true;
      let continueWithNewerDraft = false;
      setSaveState({ status: "saving" });

      try {
        const result = await saveContent(
          pageId,
          snapshot,
          expectedRevision.current
        );

        if (!mounted.current) {
          return;
        }

        if (result.status === "saved") {
          expectedRevision.current = result.revision;

          if (latestDocument.current === snapshot) {
            dirtyRef.current = false;
            setDirty(false);
            setSaveState({ status: "saved", savedAt: result.updatedAt });
          } else {
            // A newer edit arrived while this request was in flight. The
            // acknowledged revision is kept, but the newer document is not
            // marked saved.
            pendingRequest.current = true;
            continueWithNewerDraft = true;
            setSaveState({ status: "saving" });
          }
        } else if (result.status === "conflict") {
          pendingRequest.current = false;
          conflict.current = result.currentRevision;
          setConflictRevision(result.currentRevision);
          setSaveState({
            status: "conflict",
            currentRevision: result.currentRevision
          });
        } else {
          pendingRequest.current = false;
          setSaveState({ status: "error", message: result.message });
        }
      } catch {
        pendingRequest.current = false;

        if (mounted.current) {
          setSaveState({
            status: "error",
            message:
              "Could not reach the server. Check your connection and retry."
          });
        }
      } finally {
        inFlight.current = false;

        if (
          mounted.current &&
          continueWithNewerDraft &&
          pendingRequest.current &&
          dirtyRef.current &&
          conflict.current === null
        ) {
          pendingRequest.current = false;
          void saveLatest();
        }
      }
    },
    [pageId, saveContent]
  );

  const saveLatestRef = useRef(saveLatest);

  useEffect(() => {
    saveLatestRef.current = saveLatest;
  }, [saveLatest]);

  const scheduleSave = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => {
      timer.current = null;
      void saveLatestRef.current();
    }, autosaveDelayMs);
  }, [autosaveDelayMs]);

  const handleChange = useCallback(
    (next: EditorDocument) => {
      latestDocument.current = next;
      setDocument(next);
      dirtyRef.current = true;
      setDirty(true);

      if (conflict.current !== null) {
        // Autosave stays paused until the user chooses a resolution. The local
        // draft remains visible and editable.
        setSaveState({
          status: "conflict",
          currentRevision: conflict.current
        });
        return;
      }

      setSaveState({ status: "saving" });
      scheduleSave();
    },
    [scheduleSave]
  );

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }

      if (dirtyRef.current && conflict.current === null && !inFlight.current) {
        void saveLatestRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (!dirty) {
      return;
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [dirty]);

  useEffect(() => {
    function interceptNavigation(event: MouseEvent) {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[href]");

      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (
        (anchor.target !== "" && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const href = anchor.getAttribute("href");

      if (!href || href.startsWith("#")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin) {
        return;
      }

      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash === window.location.hash
      ) {
        return;
      }

      event.preventDefault();
      setPendingHref(
        `${destination.pathname}${destination.search}${destination.hash}`
      );
    }

    window.document.addEventListener("click", interceptNavigation, true);

    return () => {
      window.document.removeEventListener("click", interceptNavigation, true);
    };
  }, []);

  useEffect(() => {
    function interceptProgrammaticNavigation(event: Event) {
      if (!dirtyRef.current) {
        return;
      }

      const detail = (event as CustomEvent<AppNavigationDetail>).detail;

      if (!detail?.href) {
        return;
      }

      event.preventDefault();
      setPendingHref(detail.href);
    }

    window.addEventListener(
      APP_NAVIGATION_EVENT,
      interceptProgrammaticNavigation
    );

    return () => {
      window.removeEventListener(
        APP_NAVIGATION_EVENT,
        interceptProgrammaticNavigation
      );
    };
  }, []);

  const retry = useCallback(() => {
    void saveLatestRef.current();
  }, []);

  function leaveWithoutSaving() {
    const destination = pendingHref;
    setPendingHref(null);

    if (destination) {
      router.push(destination);
    }
  }

  function confirmConflictResolution() {
    if (pendingResolution === "reload") {
      // The reload is the explicit discard, so do not ask a second time
      // through the browser unload prompt.
      dirtyRef.current = false;
      setDirty(false);
      window.location.reload();
      return;
    }

    if (pendingResolution === "overwrite") {
      const revision = conflict.current;

      if (revision === null) {
        return;
      }

      conflict.current = null;
      expectedRevision.current = revision;
      pendingRequest.current = false;
      setConflictRevision(null);
      setPendingResolution(null);
      void saveLatestRef.current();
    }
  }

  return (
    <div className={styles.editor}>
      <SaveStatus onRetry={retry} state={saveState} />

      {conflictRevision !== null ? (
        <div className={styles.conflict} role="alert">
          <p className={styles.conflictTitle}>
            This page changed in another tab.
          </p>
          <p className={styles.conflictText}>
            Your draft is still here and has not been discarded. Reload the
            latest version, or overwrite it with this draft.
          </p>
          <div className={styles.actions}>
            <Button
              onClick={() => setPendingResolution("reload")}
              size="sm"
              variant="secondary"
            >
              Reload latest
            </Button>
            <Button
              onClick={() => setPendingResolution("overwrite")}
              size="sm"
              variant="danger"
            >
              Overwrite saved version
            </Button>
          </div>
        </div>
      ) : null}

      <EditorCanvas initialDocument={document} onChange={handleChange} />

      <Dialog
        description="If you leave this page now, your unsaved edits will be lost."
        onOpenChange={(open) => {
          if (!open) {
            setPendingHref(null);
          }
        }}
        open={pendingHref !== null}
        title="Leave with unsaved edits?"
      >
        <div className={styles.actions}>
          <Button onClick={() => setPendingHref(null)} variant="secondary">
            Stay on this page
          </Button>
          <Button onClick={leaveWithoutSaving} variant="danger">
            Leave and discard edits
          </Button>
        </div>
      </Dialog>

      <Dialog
        description={
          pendingResolution === "reload"
            ? "Reloading fetches the saved version and discards this draft."
            : "Overwriting replaces the saved version with this draft. The other tab’s changes will be lost."
        }
        onOpenChange={(open) => {
          if (!open) {
            setPendingResolution(null);
          }
        }}
        open={pendingResolution !== null}
        title={
          pendingResolution === "reload"
            ? "Reload the saved version?"
            : "Overwrite the saved version?"
        }
      >
        <div className={styles.actions}>
          <Button
            onClick={() => setPendingResolution(null)}
            variant="secondary"
          >
            Keep draft
          </Button>
          <Button
            onClick={confirmConflictResolution}
            variant={pendingResolution === "reload" ? "primary" : "danger"}
          >
            {pendingResolution === "reload"
              ? "Discard draft and reload"
              : "Overwrite saved version"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
