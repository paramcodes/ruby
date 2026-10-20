// @vitest-environment node

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId, type PageId } from "@/server/ids";
import {
  getPageForUser,
  listArchivedPagesForUser,
  listPagesForUser
} from "@/server/pages/queries";
import { page } from "@/server/pages/schema";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";
import { workspace } from "@/server/workspaces/schema";

vi.mock("server-only", () => ({}));

const hasDatabase = Boolean(process.env.DATABASE_URL);

function asPageId(value: string): PageId {
  const pageId = toPageId(value);

  if (!pageId) {
    throw new Error(`Invalid page id in test: ${value}`);
  }

  return pageId;
}

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: `Test user ${id}`,
    email: `${id}@example.test`
  });
  return id;
}

describe.skipIf(!hasDatabase)("ensurePrivateWorkspace", () => {
  it("creates exactly one workspace and returns the same id on repeat calls", async () => {
    const userId = await createUser();

    try {
      const first = await ensurePrivateWorkspace(userId);
      const second = await ensurePrivateWorkspace(userId);

      expect(first).toBe(second);

      const workspaces = await db
        .select({ id: workspace.id, userId: workspace.userId })
        .from(workspace);

      const owned = workspaces.filter((row) => row.userId === userId);
      expect(owned).toHaveLength(1);
      expect(owned[0]?.id).toBe(first);
    } finally {
      await db.delete(user).where(inArray(user.id, [userId]));
    }
  });

  it("converges on one workspace under concurrent calls", async () => {
    const userId = await createUser();

    try {
      const ids = await Promise.all(
        Array.from({ length: 8 }, () => ensurePrivateWorkspace(userId))
      );

      expect(new Set(ids).size).toBe(1);

      const owned = await db
        .select({ id: workspace.id })
        .from(workspace)
        .where(eq(workspace.userId, userId));

      expect(owned).toHaveLength(1);
      expect(owned[0]?.id).toBe(ids[0]);
    } finally {
      await db.delete(user).where(inArray(user.id, [userId]));
    }
  });

  it("keeps one workspace per user at the database level", async () => {
    const userId = await createUser();

    try {
      await ensurePrivateWorkspace(userId);

      await expect(
        db.insert(workspace).values({ id: randomUUID(), userId })
      ).rejects.toMatchObject({ cause: { code: "23505" } });
    } finally {
      await db.delete(user).where(inArray(user.id, [userId]));
    }
  });
});

describe.skipIf(!hasDatabase)("page queries", () => {
  let userA: string;
  let userB: string;
  let workspaceA: string;
  let workspaceB: string;

  beforeAll(async () => {
    userA = await createUser();
    userB = await createUser();
    workspaceA = await ensurePrivateWorkspace(userA);
    workspaceB = await ensurePrivateWorkspace(userB);
  });

  afterAll(async () => {
    await db.delete(user).where(inArray(user.id, [userA, userB]));
  });

  async function resetPages(): Promise<void> {
    await db
      .delete(page)
      .where(inArray(page.workspaceId, [workspaceA, workspaceB]));
  }

  async function insertPage(
    workspaceId: string,
    overrides: Partial<{
      id: string;
      parentId: string | null;
      title: string;
      sortOrder: number;
      archivedAt: Date | null;
    }> = {}
  ): Promise<string> {
    const id = overrides.id ?? randomUUID();
    await db.insert(page).values({
      id,
      workspaceId,
      parentId: overrides.parentId ?? null,
      title: overrides.title ?? `Page ${id}`,
      sortOrder: overrides.sortOrder ?? 0,
      archivedAt: overrides.archivedAt ?? null
    });
    return id;
  }

  it("lists active pages only, ordered by sort order then title", async () => {
    await resetPages();

    const zeta = await insertPage(workspaceA, {
      title: "Zeta",
      sortOrder: 2
    });
    const beta = await insertPage(workspaceA, {
      title: "Beta",
      sortOrder: 1
    });
    const alpha = await insertPage(workspaceA, {
      title: "Alpha",
      sortOrder: 1
    });
    await insertPage(workspaceA, {
      title: "Archived",
      sortOrder: 0,
      archivedAt: new Date()
    });
    await insertPage(workspaceB, { title: "Other user's page", sortOrder: 0 });

    const pages = await listPagesForUser(userA);

    expect(pages.map((item) => item.title)).toEqual(["Alpha", "Beta", "Zeta"]);
    expect(pages.map((item) => item.id)).toEqual([alpha, beta, zeta]);
    expect(pages.every((item) => item.archivedAt === null)).toBe(true);
    expect(pages[0]).toEqual({
      id: asPageId(alpha),
      parentId: null,
      title: "Alpha",
      sortOrder: 1,
      archivedAt: null
    });
  });

  it("lists archived pages only, in the same order", async () => {
    await resetPages();

    const second = await insertPage(workspaceA, {
      title: "Second",
      sortOrder: 2,
      archivedAt: new Date()
    });
    const first = await insertPage(workspaceA, {
      title: "First",
      sortOrder: 1,
      archivedAt: new Date()
    });
    await insertPage(workspaceA, { title: "Active", sortOrder: 0 });
    await insertPage(workspaceB, {
      title: "Other user's archived page",
      sortOrder: 0,
      archivedAt: new Date()
    });

    const archived = await listArchivedPagesForUser(userA);

    expect(archived.map((item) => item.id)).toEqual([first, second]);
    expect(archived.every((item) => item.archivedAt instanceof Date)).toBe(
      true
    );
  });

  it("returns a page record for its owner", async () => {
    await resetPages();

    const pageId = await insertPage(workspaceA, {
      title: "Owned page",
      sortOrder: 4
    });

    const record = await getPageForUser(userA, asPageId(pageId));

    expect(record).toMatchObject({
      id: asPageId(pageId),
      workspaceId: workspaceA,
      parentId: null,
      title: "Owned page",
      sortOrder: 4,
      archivedAt: null
    });
    expect(record?.createdAt).toBeInstanceOf(Date);
    expect(record?.updatedAt).toBeInstanceOf(Date);
  });

  it("returns null for another user's page and for a missing page", async () => {
    await resetPages();

    const pageId = await insertPage(workspaceA, { title: "Private" });

    await expect(getPageForUser(userB, asPageId(pageId))).resolves.toBeNull();
    await expect(
      getPageForUser(userA, asPageId(randomUUID()))
    ).resolves.toBeNull();
  });

  it("rejects a parent page from another workspace", async () => {
    await resetPages();

    const parentInB = await insertPage(workspaceB, { title: "Parent in B" });

    await expect(
      db.insert(page).values({
        id: randomUUID(),
        workspaceId: workspaceA,
        parentId: parentInB,
        title: "Child in A",
        sortOrder: 0
      })
    ).rejects.toMatchObject({ cause: { code: "23503" } });

    const childInA = await insertPage(workspaceA, {
      parentId: await insertPage(workspaceA, { title: "Parent in A" }),
      title: "Valid child"
    });

    const pages = await listPagesForUser(userA);
    expect(pages.some((item) => item.id === asPageId(childInA))).toBe(true);
  });
});
