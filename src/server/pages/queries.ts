import "server-only";

import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";

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

export async function listPagesForUser(userId: UserId): Promise<PageSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(page)
    .innerJoin(workspace, eq(page.workspaceId, workspace.id))
    .where(and(eq(workspace.userId, userId), isNull(page.archivedAt)))
    .orderBy(asc(page.sortOrder), asc(page.title), asc(page.id));

  return rows.map(toSummary);
}

export async function listArchivedPagesForUser(
  userId: UserId
): Promise<PageSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(page)
    .innerJoin(workspace, eq(page.workspaceId, workspace.id))
    .where(and(eq(workspace.userId, userId), isNotNull(page.archivedAt)))
    .orderBy(asc(page.sortOrder), asc(page.title), asc(page.id));

  return rows.map(toSummary);
}

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
