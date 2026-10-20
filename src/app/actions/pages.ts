"use server";

import { getCurrentUser } from "@/server/auth/current-user";
import {
  archivePage,
  createPage,
  movePage,
  renamePage,
  restorePage,
  type PageCommandError,
  type Result
} from "@/server/pages/commands";
import type { PageSummary } from "@/server/pages/types";
import {
  validateCreatePageInput,
  validateMovePageInput,
  validatePageId,
  validateTitle,
  type ValidationError
} from "@/server/pages/validation";

export type PageActionPage = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  archivedAt: string | null;
};

export type PageActionError =
  PageCommandError | "unauthenticated" | "invalid-input";

export type PageActionResult =
  { ok: true; page: PageActionPage } | { ok: false; error: PageActionError };

export type CreatePageActionInput = {
  title: string;
  parentId: string | null;
};

export type MovePageActionInput = {
  pageId: string;
  parentId: string | null;
  sortOrder: number;
};

export async function createPageAction(
  input: CreatePageActionInput
): Promise<PageActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return failure("unauthenticated");
  }

  const parsed = validateCreatePageInput(input);

  if (!parsed.ok) {
    return failure(
      parsed.error === "invalid-title" ? "invalid-title" : "invalid-input"
    );
  }

  return respond(await createPage(user.id, parsed.value));
}

export async function renamePageAction(
  pageId: string,
  title: string
): Promise<PageActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return failure("unauthenticated");
  }

  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  const parsedTitle = validateTitle(title);

  if (!parsedTitle.ok) {
    return failure("invalid-title");
  }

  return respond(await renamePage(user.id, parsedId.value, parsedTitle.value));
}

export async function movePageAction(
  input: MovePageActionInput
): Promise<PageActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return failure("unauthenticated");
  }

  const parsed = validateMovePageInput(input);

  if (!parsed.ok) {
    return failure(mapValidationError(parsed.error));
  }

  return respond(await movePage(user.id, parsed.value));
}

export async function archivePageAction(
  pageId: string
): Promise<PageActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return failure("unauthenticated");
  }

  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  return respond(await archivePage(user.id, parsedId.value));
}

export async function restorePageAction(
  pageId: string
): Promise<PageActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return failure("unauthenticated");
  }

  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  return respond(await restorePage(user.id, parsedId.value));
}

function respond(
  result: Result<PageSummary, PageCommandError>
): PageActionResult {
  if (!result.ok) {
    return failure(result.error);
  }

  return {
    ok: true,
    page: {
      id: result.value.id,
      parentId: result.value.parentId,
      title: result.value.title,
      sortOrder: result.value.sortOrder,
      archivedAt: result.value.archivedAt
        ? result.value.archivedAt.toISOString()
        : null
    }
  };
}

function failure(error: PageActionError): PageActionResult {
  return { ok: false, error };
}

function mapValidationError(error: ValidationError): PageActionError {
  switch (error) {
    case "invalid-page-id":
      return "not-found";
    case "invalid-parent-id":
      return "invalid-parent";
    case "invalid-sort-order":
      return "invalid-parent";
    case "invalid-title":
      return "invalid-title";
  }
}
