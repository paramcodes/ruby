import "server-only";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toWorkspaceId, type WorkspaceId } from "@/server/ids";

import { workspace } from "./schema";

// Safe under repeated and concurrent first sign-ins: the unique constraint on
// workspace.user_id makes the insert idempotent, and the follow-up select reads
// the workspace created by whichever call won the race.
export async function ensurePrivateWorkspace(
  userId: UserId
): Promise<WorkspaceId> {
  const created = await db
    .insert(workspace)
    .values({ id: randomUUID(), userId })
    .onConflictDoNothing({ target: workspace.userId })
    .returning({ id: workspace.id });

  const createdRow = created[0];
  if (createdRow) {
    return parseWorkspaceId(createdRow.id);
  }

  const existing = await db
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.userId, userId))
    .limit(1);

  const existingRow = existing[0];
  if (!existingRow) {
    throw new Error(
      `Could not create or find a private workspace for user ${userId}`
    );
  }

  return parseWorkspaceId(existingRow.id);
}

function parseWorkspaceId(value: string): WorkspaceId {
  const workspaceId = toWorkspaceId(value);

  if (!workspaceId) {
    throw new Error(`Workspace id read from the database is invalid: ${value}`);
  }

  return workspaceId;
}
