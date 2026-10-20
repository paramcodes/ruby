import "server-only";

import { cache } from "react";
import { sql, type SQL } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toPageId, type PageId } from "@/server/ids";

export type SearchResult = {
  id: PageId;
  parentId: PageId | null;
  title: string;
  favorited: boolean;
};

type SearchRow = {
  id: string;
  parent_id: string | null;
  title: string;
  favorited: boolean;
};

const SEARCH_RESULT_LIMIT = 50;

// Full-text search scoped to one user's active pages.
//
// The query runs as two branches joined with UNION: one matches the page
// title, the other matches the page body. PostgreSQL cannot use a GIN index
// for a predicate that ORs two tsvector matches across a join, so the OR form
// fell back to a sequential scan. Each branch is backed by its own GIN
// expression index — `page_search_title_idx` on
// `to_tsvector('english', page.title)` and `page_search_content_idx` on
// `to_tsvector('english', page_content.search_text)` — and both branches
// repeat the ownership filter and the archived-page exclusion.
//
// The ownership filter is written as a correlated subquery on purpose. It
// stays a filter, so the tsvector predicate remains the only index condition
// of the page scan and the GIN index is its access path. A join to `workspace`
// lets the planner drive the scan from the workspace index instead, which
// drops the GIN index from the plan.
//
// The `EXISTS` subquery attaches the favorited flag so the caller renders star
// state without a second round-trip. Only active (non-archived) pages are
// returned.
export function buildSearchQuery(userId: UserId, query: string): SQL {
  return sql`
    SELECT id, parent_id, title, favorited
    FROM (
      (
        SELECT
          p.id AS id,
          p.parent_id AS parent_id,
          p.title AS title,
          EXISTS (
            SELECT 1
            FROM favorite f
            WHERE f.user_id = ${userId}
              AND f.page_id = p.id
          ) AS favorited
        FROM page p
        WHERE p.archived_at IS NULL
          AND to_tsvector('english', p.title) @@ plainto_tsquery('english', ${query})
          AND (
            SELECT w.user_id FROM workspace w WHERE w.id = p.workspace_id
          ) = ${userId}
      )
      UNION
      (
        SELECT
          p.id AS id,
          p.parent_id AS parent_id,
          p.title AS title,
          EXISTS (
            SELECT 1
            FROM favorite f
            WHERE f.user_id = ${userId}
              AND f.page_id = p.id
          ) AS favorited
        FROM page_content pc
        JOIN page p ON p.id = pc.page_id
        WHERE p.archived_at IS NULL
          AND to_tsvector('english', pc.search_text) @@ plainto_tsquery('english', ${query})
          AND (
            SELECT w.user_id FROM workspace w WHERE w.id = p.workspace_id
          ) = ${userId}
      )
    ) AS search_results
    ORDER BY title ASC, id ASC
    LIMIT ${SEARCH_RESULT_LIMIT}
  `;
}

export const searchPages = cache(
  async (userId: UserId, query: string): Promise<SearchResult[]> => {
    const rows = await db.execute<SearchRow>(buildSearchQuery(userId, query));

    return rows.map((row) => ({
      id: parsePageId(row.id),
      parentId: row.parent_id === null ? null : parsePageId(row.parent_id),
      title: row.title,
      favorited: Boolean(row.favorited)
    }));
  }
);

function parsePageId(value: string): PageId {
  const pageId = toPageId(value);

  if (!pageId) {
    throw new Error(`Page id read from the database is invalid: ${value}`);
  }

  return pageId;
}
