import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { workspace } from "../workspaces/schema";
import { page } from "./schema";

// One versioned document per page. `revision` is the optimistic-concurrency
// token: every successful save increments it, and a save whose expected
// revision is stale is rejected rather than overwriting newer content.
//
// `search_text` is derived from `document` by the editor adapter and written in
// the same statement, so full-text search can never drift from the content it
// indexes.
export const pageContent = pgTable("page_content", {
  pageId: text("page_id")
    .primaryKey()
    .references(() => page.id, { onDelete: "cascade" }),
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
});
