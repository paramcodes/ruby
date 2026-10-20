import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp
} from "drizzle-orm/pg-core";

import { user } from "@/server/db/schema";

import { page } from "./schema";

// The most recently viewed pages. The primary key is the (user, page) pair, so a
// page can appear once per user; visiting it again upserts and refreshes the
// viewed timestamp instead of inserting a second row.
export const pageView = pgTable(
  "page_view",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    pageId: text("page_id")
      .notNull()
      .references(() => page.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at").defaultNow().notNull()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.pageId] }),
    index("page_view_user_id_idx").on(table.userId)
  ]
);
