import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp
} from "drizzle-orm/pg-core";

import { workspace } from "../workspaces/schema";
import { page } from "./schema";

// One versioned document per page. `revision` is the optimistic-concurrency
// token: every successful save increments it, and a save whose expected
// revision is stale is rejected rather than overwriting newer content.
//
// `search_text` is derived from `document` by the editor adapter and written in
// the same statement, so full-text search can never drift from the content it
// indexes.
export const pageContent = pgTable(
  "page_content",
  {
    pageId: text("page_id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    document: jsonb("document").notNull(),
    revision: integer("revision").notNull().default(1),
    searchText: text("search_text").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    // The page reference carries the workspace too, so a content row cannot
    // name a workspace that does not own its page. This reuses the unique
    // constraint on page(workspace_id, id) and makes the single-column page_id
    // foreign key redundant.
    foreignKey({
      columns: [table.workspaceId, table.pageId],
      foreignColumns: [page.workspaceId, page.id],
      name: "page_content_workspace_page_fk"
    }).onDelete("cascade"),
    // The content branch of the search query is backed by this expression
    // index. It has to be declared here so the migration snapshot and the
    // schema agree on the index.
    index("page_search_content_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.searchText})`
    )
  ]
);
