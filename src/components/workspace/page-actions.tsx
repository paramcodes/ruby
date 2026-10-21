"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  archivePageAction,
  movePageAction,
  renamePageAction,
  restorePageAction,
  type PageActionError
} from "@/app/actions/pages";
import type { PageSummary } from "@/server/pages/types";

import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Menu, MenuItem, MenuSeparator } from "../ui/menu";
import { EllipsisIcon } from "./icons";
import styles from "./page-actions.module.css";

export type PageActionsProps = {
  page: PageSummary;
  /** Active pages, used for the move destination list. */
  pages: readonly PageSummary[];
};

export function describePageActionError(error: PageActionError): string {
  switch (error) {
    case "not-found":
      return "That page could not be found.";
    case "invalid-title":
      return "Enter a title between 1 and 255 characters.";
    case "invalid-parent":
      return "Choose a valid destination page.";
    case "cycle":
      return "A page cannot be moved inside itself.";
    case "unauthenticated":
      return "Your session ended. Sign in again to continue.";
    case "invalid-input":
      return "Check the form and try again.";
  }
}

export function PageActions({ page, pages }: PageActionsProps) {
  const router = useRouter();
  const parentSelectId = useId();
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [titleDraft, setTitleDraft] = useState(page.title);
  const [parentDraft, setParentDraft] = useState(page.parentId ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const isArchived = page.archivedAt !== null;
  const activePages = pages.filter(
    (candidate) => candidate.archivedAt === null
  );
  const excludedParents = collectSubtreeIds(page.id, activePages);
  const parentOptions = activePages
    .filter((candidate) => !excludedParents.has(candidate.id))
    .sort((left, right) => left.title.localeCompare(right.title));

  function openRename(nextOpen: boolean) {
    setRenameOpen(nextOpen);
    setFormError(null);

    if (nextOpen) {
      setTitleDraft(page.title);
    }
  }

  function openMove(nextOpen: boolean) {
    setMoveOpen(nextOpen);
    setFormError(null);

    if (nextOpen) {
      setParentDraft(page.parentId ?? "");
    }
  }

  async function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    const result = await renamePageAction(page.id, titleDraft);
    setPending(false);

    if (!result.ok) {
      setFormError(describePageActionError(result.error));
      return;
    }

    setRenameOpen(false);
    router.refresh();
  }

  async function submitMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    const result = await movePageAction({
      pageId: page.id,
      parentId: parentDraft === "" ? null : parentDraft,
      sortOrder: page.sortOrder
    });
    setPending(false);

    if (!result.ok) {
      setFormError(describePageActionError(result.error));
      return;
    }

    setMoveOpen(false);
    router.refresh();
  }

  async function archive() {
    setPending(true);
    setError(null);
    setAnnouncement("");
    const result = await archivePageAction(page.id);
    setPending(false);

    if (!result.ok) {
      setError(describePageActionError(result.error));
      return;
    }

    setAnnouncement(`Page "${page.title}" archived.`);
    router.refresh();
  }

  async function restore() {
    setPending(true);
    setError(null);
    setAnnouncement("");
    const result = await restorePageAction(page.id);
    setPending(false);

    if (!result.ok) {
      setError(describePageActionError(result.error));
      return;
    }

    setAnnouncement(`Page "${page.title}" restored.`);
    router.refresh();
  }

  return (
    <div className={styles.actions}>
      <Menu
        label={`Actions for ${page.title}`}
        trigger={
          <Button
            aria-label={`Actions for ${page.title}`}
            className={styles.trigger}
            size="sm"
            title="Page actions"
            variant="ghost"
          >
            <EllipsisIcon />
          </Button>
        }
      >
        {isArchived ? (
          <MenuItem disabled={pending} onSelect={() => void restore()}>
            Restore
          </MenuItem>
        ) : (
          <>
            <MenuItem onSelect={() => openRename(true)}>Rename</MenuItem>
            <MenuItem disabled={pending} onSelect={() => openMove(true)}>
              Move
            </MenuItem>
            <MenuSeparator />
            <MenuItem disabled={pending} onSelect={() => void archive()}>
              Archive
            </MenuItem>
          </>
        )}
      </Menu>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className={styles.announcement} role="status">
        {announcement}
      </p>

      <Dialog
        description="The new title appears everywhere this page is listed."
        onOpenChange={openRename}
        open={renameOpen}
        title="Rename page"
      >
        <form className={styles.form} onSubmit={submitRename}>
          <Input
            label="Page title"
            onChange={(event) => setTitleDraft(event.target.value)}
            required
            value={titleDraft}
            {...(formError ? { error: formError } : {})}
          />
          <Button disabled={pending} type="submit">
            {pending ? "Saving..." : "Save title"}
          </Button>
        </form>
      </Dialog>

      <Dialog
        description="Choose a parent page, or keep this page at the top level."
        onOpenChange={openMove}
        open={moveOpen}
        title="Move page"
      >
        <form className={styles.form} onSubmit={submitMove}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={parentSelectId}>
              Destination
            </label>
            <select
              className={styles.select}
              id={parentSelectId}
              onChange={(event) => setParentDraft(event.target.value)}
              value={parentDraft}
            >
              <option value="">Top level</option>
              {parentOptions.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.title}
                </option>
              ))}
            </select>
          </div>
          {formError ? (
            <p className={styles.error} role="alert">
              {formError}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Moving..." : "Move page"}
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

function collectSubtreeIds(
  rootId: string,
  pages: readonly PageSummary[]
): Set<string> {
  const childrenByParent = new Map<string, PageSummary[]>();

  for (const page of pages) {
    if (page.parentId === null) {
      continue;
    }

    const siblings = childrenByParent.get(page.parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(page.parentId, siblings);
  }

  const collected = new Set<string>();
  const stack = [rootId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || collected.has(current)) {
      continue;
    }

    collected.add(current);
    for (const child of childrenByParent.get(current) ?? []) {
      stack.push(child.id);
    }
  }

  return collected;
}
