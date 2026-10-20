import "server-only";

import { cache } from "react";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toPageId, type PageId } from "@/server/ids";
import { workspace } from "@/server/workspaces/schema";

import { pageView } from "./recent-pages-schema";
import { page } from "./schema";
import type { PageSummary } from "./types";

const RECENT_LIMIT = 10;

// Only the signed-in user's own, currently active pages can be recorded or
// listed: `recordRecentPage` guards on ownership, and the listing joins through
// `workspace.user_id` and filters out archived pages.
export const listRecentPages = cache(
  async (userId: UserId): Promise<PageSummary[]> => {
    const rows = await db
      .select(summaryColumns)
      .from(pageView)
      .innerJoin(page, eq(pageView.pageId, page.id))
      .where(and(eq(pageView.userId, userId), isNull(page.archivedAt)))
      .orderBy(desc(pageView.viewedAt), asc(page.title))
      .limit(RECENT_LIMIT);

    return rows.map(toSummary);
  }
);

// Upserts a view row: the first view inserts, and every later view updates the
// `viewed_at` timestamp in place rather than adding a second row. A foreign or
// missing page is ignored so a recent list can never surface another user's page.
export async function recordRecentPage(
  userId: UserId,
  pageId: PageId
): Promise<void> {
  const owned = await ownsPage(userId, pageId);

  if (!owned) {
    return;
  }

  await db
    .insert(pageView)
    .values({ userId, pageId })
    .onConflictDoUpdate({
      target: [pageView.userId, pageView.pageId],
      set: { viewedAt: new Date() }
    });
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
