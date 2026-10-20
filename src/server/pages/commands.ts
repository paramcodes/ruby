import { randomUUID } from "node:crypto";

import type { UserId } from "@/server/auth/types";
import { toPageId, type PageId } from "@/server/ids";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

import {
  withPageRepository,
  type PageLink,
  type PageRepository
} from "./repository";
import { MAX_SORT_ORDER } from "./types";
import type { CreatePageInput, MovePageInput, PageSummary } from "./types";
import {
  validateCreatePageInput,
  validateMovePageInput,
  validatePageId,
  validateTitle,
  type ValidationError
} from "./validation";

export type PageCommandError =
  "not-found" | "invalid-title" | "invalid-parent" | "cycle";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export async function createPage(
  userId: UserId,
  input: CreatePageInput
): Promise<Result<PageSummary, PageCommandError>> {
  const parsed = validateCreatePageInput(input);

  if (!parsed.ok) {
    return failure(mapValidationError(parsed.error));
  }

  await ensurePrivateWorkspace(userId);

  return withPageRepository(userId, async (repository) => {
    const links = await repository.listPageLinks();
    const parentId = parsed.value.parentId;

    if (parentId !== null && !links.some((link) => link.id === parentId)) {
      return failure("invalid-parent");
    }

    const newPageId = toPageId(randomUUID());

    if (!newPageId) {
      throw new Error("randomUUID produced an invalid page id");
    }

    const created = await repository.insertPage({
      id: newPageId,
      parentId,
      title: parsed.value.title,
      sortOrder: nextSiblingSortOrder(links, parentId)
    });

    return success(created);
  });
}

export async function renamePage(
  userId: UserId,
  pageId: PageId,
  title: string
): Promise<Result<PageSummary, PageCommandError>> {
  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  const parsedTitle = validateTitle(title);

  if (!parsedTitle.ok) {
    return failure("invalid-title");
  }

  return withPageRepository(userId, async (repository) => {
    const updated = await repository.updatePage(parsedId.value, {
      title: parsedTitle.value
    });

    return updated ? success(updated) : failure("not-found");
  });
}

export async function movePage(
  userId: UserId,
  input: MovePageInput
): Promise<Result<PageSummary, PageCommandError>> {
  const parsed = validateMovePageInput(input);

  if (!parsed.ok) {
    return failure(mapValidationError(parsed.error));
  }

  return withPageRepository(userId, async (repository) => {
    const links = await repository.listPageLinks();
    const pageById = indexById(links);

    if (!pageById.has(parsed.value.pageId)) {
      return failure("not-found");
    }

    const { parentId } = parsed.value;

    if (parentId !== null && !pageById.has(parentId)) {
      return failure("invalid-parent");
    }

    if (
      parentId !== null &&
      isSelfOrDescendant(parentId, parsed.value.pageId, pageById)
    ) {
      return failure("cycle");
    }

    const updated = await repository.updatePage(parsed.value.pageId, {
      parentId,
      sortOrder: parsed.value.sortOrder
    });

    return updated ? success(updated) : failure("not-found");
  });
}

export async function archivePage(
  userId: UserId,
  pageId: PageId
): Promise<Result<PageSummary, PageCommandError>> {
  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  return withPageRepository(userId, async (repository) => {
    const links = await repository.listPageLinks();
    const pageById = indexById(links);

    if (!pageById.has(parsedId.value)) {
      return failure("not-found");
    }

    const subtree = collectSubtree(parsedId.value, pageById);
    const toArchive = subtree.filter(
      (id) => pageById.get(id)?.archivedAt === null
    );

    if (toArchive.length > 0) {
      await repository.updatePages(toArchive, { archivedAt: new Date() });
    }

    return summarize(repository, parsedId.value);
  });
}

export async function restorePage(
  userId: UserId,
  pageId: PageId
): Promise<Result<PageSummary, PageCommandError>> {
  const parsedId = validatePageId(pageId);

  if (!parsedId.ok) {
    return failure("not-found");
  }

  return withPageRepository(userId, async (repository) => {
    const links = await repository.listPageLinks();
    const pageById = indexById(links);

    if (!pageById.has(parsedId.value)) {
      return failure("not-found");
    }

    // Project ruling: restoring a page also restores the archived subtree
    // below it and every archived ancestor above it. Without the ancestor
    // chain a restored page would stay unreachable from the active tree.
    const toRestore = new Set<PageId>(collectSubtree(parsedId.value, pageById));

    let ancestorId = pageById.get(parsedId.value)?.parentId ?? null;
    while (ancestorId !== null && !toRestore.has(ancestorId)) {
      toRestore.add(ancestorId);
      ancestorId = pageById.get(ancestorId)?.parentId ?? null;
    }

    const archivedToRestore = [...toRestore].filter(
      (id) => pageById.get(id)?.archivedAt !== null
    );

    if (archivedToRestore.length > 0) {
      await repository.updatePages(archivedToRestore, { archivedAt: null });
    }

    return summarize(repository, parsedId.value);
  });
}

async function summarize(
  repository: PageRepository,
  pageId: PageId
): Promise<Result<PageSummary, PageCommandError>> {
  const page = await repository.findPage(pageId);

  return page ? success(page) : failure("not-found");
}

function indexById(links: readonly PageLink[]): Map<PageId, PageLink> {
  return new Map(links.map((link) => [link.id, link]));
}

// Walks from the proposed parent towards the root. Crossing the moved page
// means the new parent is the page itself or one of its descendants.
function isSelfOrDescendant(
  parentId: PageId,
  pageId: PageId,
  pageById: ReadonlyMap<PageId, PageLink>
): boolean {
  const visited = new Set<PageId>();
  let current: PageId | null = parentId;

  while (current !== null) {
    if (current === pageId) {
      return true;
    }

    if (visited.has(current)) {
      return false;
    }

    visited.add(current);
    current = pageById.get(current)?.parentId ?? null;
  }

  return false;
}

function collectSubtree(
  rootId: PageId,
  pageById: ReadonlyMap<PageId, PageLink>
): PageId[] {
  const childrenByParent = new Map<PageId, PageId[]>();

  for (const link of pageById.values()) {
    if (link.parentId === null) {
      continue;
    }

    const children = childrenByParent.get(link.parentId) ?? [];
    children.push(link.id);
    childrenByParent.set(link.parentId, children);
  }

  const collected: PageId[] = [];
  const visited = new Set<PageId>();
  const stack: PageId[] = [rootId];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);
    collected.push(current);
    stack.push(...(childrenByParent.get(current) ?? []));
  }

  return collected;
}

function nextSiblingSortOrder(
  links: readonly PageLink[],
  parentId: PageId | null
): number {
  const highest = links
    .filter((link) => link.parentId === parentId)
    .reduce((max, link) => Math.max(max, link.sortOrder), -1);

  return Math.min(highest + 1, MAX_SORT_ORDER);
}

function mapValidationError(error: ValidationError): PageCommandError {
  switch (error) {
    case "invalid-title":
      return "invalid-title";
    case "invalid-parent-id":
      return "invalid-parent";
    case "invalid-page-id":
      return "not-found";
    // A malformed move target is a bad parent/position request, not a missing
    // page. The command error vocabulary has no sort-order member.
    case "invalid-sort-order":
      return "invalid-parent";
  }
}

function success<T>(value: T): Result<T, PageCommandError> {
  return { ok: true, value };
}

function failure(error: PageCommandError): Result<never, PageCommandError> {
  return { ok: false, error };
}
