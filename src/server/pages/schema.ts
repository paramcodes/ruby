import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique
} from "drizzle-orm/pg-core";

import { workspace } from "../workspaces/schema";

export const page = pgTable(
  "page",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    // Required by the composite self-referencing foreign key below: PostgreSQL
    // can only reference a column set covered by a unique constraint.
    unique("page_workspace_id_id_unique").on(table.workspaceId, table.id),
    // A parent must belong to the same workspace as its child. This is enforced
    // by the database, not only by the Task 6 commands.
    foreignKey({
      columns: [table.workspaceId, table.parentId],
      foreignColumns: [table.workspaceId, table.id],
      name: "page_workspace_parent_fk"
    }).onDelete("restrict"),
    // Sibling order is mutable (Task 6 moves pages), so this is deliberately a
    // non-unique index: a unique (workspace, parent, sort_order) constraint
    // would reject the temporary duplicate that a swap creates and would not
    // constrain root pages because PostgreSQL treats NULL parents as distinct.
    index("page_workspace_parent_sort_idx").on(
      table.workspaceId,
      table.parentId,
      table.sortOrder
    ),
    // The title branch of the search query is backed by this expression
    // index. It has to be declared here so the migration snapshot and the
    // schema agree on the index.
    index("page_search_title_idx").using(
      "gin",
      sql`to_tsvector('english', ${table.title})`
    )
  ]
);
