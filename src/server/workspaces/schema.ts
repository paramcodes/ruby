import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../db/schema";

// One private workspace per account. The unique user id is the database-level
// guarantee that concurrent first sign-ins cannot create a second workspace.
export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
