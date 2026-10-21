import "server-only";

import { cache } from "react";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import {
  toPageId,
  toWorkspaceId,
  type PageId,
  type WorkspaceId
} from "@/server/ids";
import { workspace } from "@/server/workspaces/schema";

import { page } from "./schema";
import type { PageRecord, PageSummary } from "./types";

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

// `cache()` deduplicates each list within a single request, so a workspace
// layout and its page share one query per list instead of querying twice.
export const listPagesForUser = cache(
  async (userId: UserId): Promise<PageSummary[]> => {
    const rows = await db
      .select(summaryColumns)
      .from(page)
      .innerJoin(workspace, eq(page.workspaceId, workspace.id))
      .where(and(eq(workspace.userId, userId), isNull(page.archivedAt)))
      .orderBy(asc(page.sortOrder), asc(page.title), asc(page.id));

    return rows.map(toSummary);
  }
);

export const listArchivedPagesForUser = cache(
  async (userId: UserId): Promise<PageSummary[]> => {
    const rows = await db
      .select(summaryColumns)
      .from(page)
      .innerJoin(workspace, eq(page.workspaceId, workspace.id))
      .where(and(eq(workspace.userId, userId), isNotNull(page.archivedAt)))
      .orderBy(asc(page.sortOrder), asc(page.title), asc(page.id));

    return rows.map(toSummary);
  }
);

export async function getPageForUser(
  userId: UserId,
  pageId: PageId
): Promise<PageRecord | null> {
  const rows = await db
    .select({
      ...summaryColumns,
      workspaceId: page.workspaceId,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt
    })
    .from(page)
    .innerJoin(workspace, eq(page.workspaceId, workspace.id))
    .where(and(eq(workspace.userId, userId), eq(page.id, pageId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    ...toSummary(row),
    workspaceId: parseWorkspaceId(row.workspaceId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

type AncestorRow = {
  id: string;
  parent_id: string | null;
  title: string;
  sort_order: number;
  archived_at: Date | null;
  depth: number;
};

// The chain of parents above a page, ordered from the root down to the
// immediate parent. A recursive query keeps this to one round trip no matter
// how deep the page tree runs.
export const listPageAncestors = cache(
  async (userId: UserId, pageId: PageId): Promise<PageSummary[]> => {
    const rows = await db.execute<AncestorRow>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT
          p.id,
          p.parent_id,
          p.title,
          p.sort_order,
          p.archived_at,
          0 AS depth
        FROM page p
        INNER JOIN workspace w ON w.id = p.workspace_id
        WHERE p.id = ${pageId} AND w.user_id = ${userId}
        UNION ALL
        SELECT
          parent.id,
          parent.parent_id,
          parent.title,
          parent.sort_order,
          parent.archived_at,
          ancestors.depth + 1
        FROM page parent
        INNER JOIN ancestors ON parent.id = ancestors.parent_id
      )
      SELECT id, parent_id, title, sort_order, archived_at, depth
      FROM ancestors
      ORDER BY depth DESC
    `);

    // Depth 0 is the page itself; its ancestors are the rows above it.
    return rows
      .filter((row) => row.depth > 0)
      .map((row) =>
        toSummary({
          id: row.id,
          parentId: row.parent_id,
          title: row.title,
          sortOrder: row.sort_order,
          archivedAt: row.archived_at
        })
      );
  }
);

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

function parseWorkspaceId(value: string): WorkspaceId {
  const workspaceId = toWorkspaceId(value);

  if (!workspaceId) {
    throw new Error(`Workspace id read from the database is invalid: ${value}`);
  }

  return workspaceId;
}
