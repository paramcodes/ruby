import "server-only";

import { cache } from "react";
import { sql } from "drizzle-orm";

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

// Full-text search scoped to one user's active pages. Two GIN expression
// indexes back the query: one on `to_tsvector('english', page.title)` and one
// on `to_tsvector('english', page_content.search_text)`. The `EXISTS` subquery
// attaches the favorited flag so the caller renders star state without a
// second round-trip. Only active (non-archived) pages are returned.
export const searchPages = cache(
  async (userId: UserId, query: string): Promise<SearchResult[]> => {
    const rows = await db.execute<SearchRow>(sql`
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
      JOIN workspace w ON p.workspace_id = w.id
      LEFT JOIN page_content pc ON pc.page_id = p.id
      WHERE w.user_id = ${userId}
        AND p.archived_at IS NULL
        AND (
          to_tsvector('english', p.title) @@ plainto_tsquery('english', ${query})
          OR to_tsvector('english', pc.search_text) @@ plainto_tsquery('english', ${query})
        )
      ORDER BY p.title ASC, p.id ASC
      LIMIT ${SEARCH_RESULT_LIMIT}
    `);

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
