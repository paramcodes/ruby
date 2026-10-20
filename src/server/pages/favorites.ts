import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toPageId, type PageId } from "@/server/ids";
import { workspace } from "@/server/workspaces/schema";

import { favorite } from "./favorites-schema";
import { page } from "./schema";
import type { PageSummary } from "./types";

// A favorite is an owned page pinned to the sidebar. The reads are scoped by
// `favorite.user_id`, so a user only ever sees their own favorites. The write
// in `addFavorite` additionally checks that the page belongs to the user
// through `workspace.user_id`.
export const listFavorites = cache(
  async (userId: UserId): Promise<PageSummary[]> => {
    const rows = await db
      .select(summaryColumns)
      .from(favorite)
      .innerJoin(page, eq(favorite.pageId, page.id))
      .where(and(eq(favorite.userId, userId), isNull(page.archivedAt)))
      .orderBy(desc(favorite.createdAt), asc(page.title));

    return rows.map(toSummary);
  }
);

export const listFavoritePageIds = cache(
  async (userId: UserId): Promise<string[]> => {
    const rows = await db
      .select({ pageId: favorite.pageId })
      .from(favorite)
      .where(eq(favorite.userId, userId));

    return rows.map((row) => row.pageId);
  }
);

export const isPageFavorited = cache(
  async (userId: UserId, pageId: PageId): Promise<boolean> => {
    const rows = await db
      .select({ pageId: favorite.pageId })
      .from(favorite)
      .where(and(eq(favorite.userId, userId), eq(favorite.pageId, pageId)))
      .limit(1);

    return rows.length > 0;
  }
);

// Re-favoriting a page is a no-op: the composite primary key makes a duplicate
// insert conflict out, and `onConflictDoNothing` swallows the conflict.
export async function addFavorite(
  userId: UserId,
  pageId: PageId
): Promise<void> {
  const owned = await ownsPage(userId, pageId);

  if (!owned) {
    return;
  }

  await db
    .insert(favorite)
    .values({ userId, pageId })
    .onConflictDoNothing({ target: [favorite.userId, favorite.pageId] });
}

export async function removeFavorite(
  userId: UserId,
  pageId: PageId
): Promise<void> {
  await db
    .delete(favorite)
    .where(and(eq(favorite.userId, userId), eq(favorite.pageId, pageId)));
}

async function ownsPage(userId: UserId, pageId: PageId): Promise<boolean> {
  const rows = await db
    .select({ id: page.id })
    .from(page)
    .innerJoin(workspace, eq(page.workspaceId, workspace.id))
    .where(and(eq(workspace.userId, userId), eq(page.id, pageId)))
    .limit(1);

  return rows.length > 0;
}

const summaryColumns = {
  id: page.id,
  parentId: page.parentId,
  title: page.title,
  sortOrder: page.sortOrder,
  archivedAt: page.archivedAt
};

type SummaryRow = {
  id: string;
  parentId: string | null;
  title: string;
  sortOrder: number;
  archivedAt: Date | null;
};

function toSummary(row: SummaryRow): PageSummary {
  return {
    id: parsePageId(row.id),
    parentId: row.parentId === null ? null : parsePageId(row.parentId),
    title: row.title,
    sortOrder: row.sortOrder,
    archivedAt: row.archivedAt
  };
}

function parsePageId(value: string): PageId {
  const pageId = toPageId(value);

  if (!pageId) {
    throw new Error(`Page id read from the database is invalid: ${value}`);
  }

  return pageId;
}
