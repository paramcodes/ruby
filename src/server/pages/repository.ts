import "server-only";

import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toPageId, type PageId } from "@/server/ids";
import { workspace } from "@/server/workspaces/schema";

import { page } from "./schema";
import type { PageSummary } from "./types";

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

export type PageLink = {
  id: PageId;
  parentId: PageId | null;
  sortOrder: number;
  archivedAt: Date | null;
};

export type InsertPageValues = {
  id: PageId;
  parentId: PageId | null;
  title: string;
  sortOrder: number;
};

export type PageChanges = {
  title?: string;
  parentId?: PageId | null;
  sortOrder?: number;
  archivedAt?: Date | null;
};

// The archive state a bulk update is allowed to touch. Archive only rewrites
// active rows and restore only rewrites archived rows, so a row whose state
// changed concurrently is never overwritten.
export type PageStateFilter = "active" | "archived";

// Commands only ever see this ownership-scoped view. Every method is bound to a
// user id and filters through workspace.user_id, so there is no way to read or
// mutate another user's page by passing a page id.
export type PageRepository = {
  findPage(pageId: PageId): Promise<PageSummary | null>;
  listPageLinks(): Promise<PageLink[]>;
  insertPage(values: InsertPageValues): Promise<PageSummary>;
  updatePage(pageId: PageId, changes: PageChanges): Promise<PageSummary | null>;
  updatePages(
    pageIds: readonly PageId[],
    changes: PageChanges,
    state?: PageStateFilter
  ): Promise<PageSummary[]>;
};

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withPageRepository<T>(
  userId: UserId,
  work: (repository: PageRepository) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Hierarchy commands read the page tree, check it, and then write. Two
    // concurrent moves could each pass the cycle check against the pre-move
    // tree and then write a cycle, so hierarchy mutations are serialized per
    // user. The lock is transaction scoped and released on commit/rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    return work(createRepository(tx, userId));
  });
}

function createRepository(tx: Transaction, userId: UserId): PageRepository {
  function ownedWorkspaceIds() {
    return tx
      .select({ id: workspace.id })
      .from(workspace)
      .where(eq(workspace.userId, userId));
  }

  return {
    async findPage(pageId) {
      const rows = await tx
        .select(summaryColumns)
        .from(page)
        .innerJoin(workspace, eq(page.workspaceId, workspace.id))
        .where(and(eq(workspace.userId, userId), eq(page.id, pageId)))
        .limit(1);

      const row = rows[0];
      return row ? toSummary(row) : null;
    },

    async listPageLinks() {
      const rows = await tx
        .select({
          id: page.id,
          parentId: page.parentId,
          sortOrder: page.sortOrder,
          archivedAt: page.archivedAt
        })
        .from(page)
        .innerJoin(workspace, eq(page.workspaceId, workspace.id))
        .where(eq(workspace.userId, userId));

      return rows.map((row) => ({
        id: parsePageId(row.id),
        parentId: row.parentId === null ? null : parsePageId(row.parentId),
        sortOrder: row.sortOrder,
        archivedAt: row.archivedAt
      }));
    },

    async insertPage(values) {
      // The workspace lookup carries the ownership check: a page can only be
      // inserted into a workspace that belongs to this user.
      const workspaces = await tx
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.userId, userId))
        .limit(1);

      const ownedWorkspace = workspaces[0];

      if (!ownedWorkspace) {
        throw new Error(`No private workspace for user ${userId}`);
      }

      const rows = await tx
        .insert(page)
        .values({
          id: values.id,
          workspaceId: ownedWorkspace.id,
          parentId: values.parentId,
          title: values.title,
          sortOrder: values.sortOrder
        })
        .returning(summaryColumns);

      const row = rows[0];

      if (!row) {
        throw new Error(`Page insert for user ${userId} returned no row`);
      }

      return toSummary(row);
    },

    async updatePage(pageId, changes) {
      const rows = await tx
        .update(page)
        .set(changes)
        .where(
          and(
            eq(page.id, pageId),
            inArray(page.workspaceId, ownedWorkspaceIds())
          )
        )
        .returning(summaryColumns);

      const row = rows[0];
      return row ? toSummary(row) : null;
    },

    async updatePages(pageIds, changes, state) {
      if (pageIds.length === 0) {
        return [];
      }

      const stateFilter =
        state === "active"
          ? isNull(page.archivedAt)
          : state === "archived"
            ? isNotNull(page.archivedAt)
            : undefined;

      const rows = await tx
        .update(page)
        .set(changes)
        .where(
          and(
            inArray(page.id, pageIds),
            inArray(page.workspaceId, ownedWorkspaceIds()),
            stateFilter
          )
        )
        .returning(summaryColumns);

      return rows.map(toSummary);
    }
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
