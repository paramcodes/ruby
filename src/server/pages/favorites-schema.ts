import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp
} from "drizzle-orm/pg-core";

import { user } from "@/server/db/schema";

import { page } from "./schema";

// A page pinned to the sidebar. The primary key is the (user, page) pair, so a
// user can favorite a page at most once and re-favoriting is a no-op. The
// `updated_at` timestamp is bumped when a previously unfavorited page is
// re-favorited, which keeps the sort-by-recent-favorite order stable.
export const favorite = pgTable(
  "favorite",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.pageId] }),
    index("favorite_page_id_idx").on(table.pageId)
  ]
);
