// @vitest-environment node

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId, type PageId } from "@/server/ids";
import { page } from "@/server/pages/schema";
import { listRecentPages, recordRecentPage } from "@/server/pages/recent-pages";
import { pageView } from "@/server/pages/recent-pages-schema";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

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

describe.skipIf(!hasDatabase)("recent pages", () => {
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

  beforeEach(async () => {
    await db
      .delete(page)
      .where(inArray(page.workspaceId, [workspaceA, workspaceB]));
    await db.delete(pageView).where(inArray(pageView.userId, [userA, userB]));
  });

  async function insertPage(userId: string, title: string): Promise<PageId> {
    const workspaceId = userId === userA ? workspaceA : workspaceB;
    const id = randomUUID();
    await db.insert(page).values({
      id,
      workspaceId,
      parentId: null,
      title,
      sortOrder: 0
    });
    return asPageId(id);
  }

  describe("recordRecentPage", () => {
    it("records a view and lists it most-recent-first", async () => {
      const first = await insertPage(userA, "First");
      const second = await insertPage(userA, "Second");

      await recordRecentPage(userA, second);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await recordRecentPage(userA, first);

      const recent = await listRecentPages(userA);
      expect(recent.map((item) => item.title)).toEqual(["First", "Second"]);
    });

    it("upserts on repeat views instead of adding a second row", async () => {
      const pageId = await insertPage(userA, "Replayed");

      await recordRecentPage(userA, pageId);
      await recordRecentPage(userA, pageId);

      const rows = await db
        .select()
        .from(pageView)
        .where(eq(pageView.pageId, pageId));
      expect(rows).toHaveLength(1);

      const recent = await listRecentPages(userA);
      expect(recent.map((item) => item.id)).toEqual([pageId]);
    });

    it("is a no-op for a page owned by another user", async () => {
      const pageId = await insertPage(userB, "Foreign");

      await recordRecentPage(userA, pageId);

      await expect(listRecentPages(userA)).resolves.toEqual([]);
      await expect(listRecentPages(userB)).resolves.toEqual([]);
    });
  });

  describe("listRecentPages", () => {
    it("excludes archived pages", async () => {
      const active = await insertPage(userA, "Active view");
      const archived = await insertPage(userA, "Archived view");

      await recordRecentPage(userA, active);
      await recordRecentPage(userA, archived);
      await db
        .update(page)
        .set({ archivedAt: new Date() })
        .where(eq(page.id, archived));

      const recent = await listRecentPages(userA);
      expect(recent.map((item) => item.title)).toEqual(["Active view"]);
    });

    it("keeps each user's recents isolated", async () => {
      const pageA = await insertPage(userA, "A view");
      const pageB = await insertPage(userB, "B view");

      await recordRecentPage(userA, pageA);
      await recordRecentPage(userB, pageB);

      expect((await listRecentPages(userA)).map((item) => item.title)).toEqual([
        "A view"
      ]);
      expect((await listRecentPages(userB)).map((item) => item.title)).toEqual([
        "B view"
      ]);
    });

    it("bounds the list to about ten entries", async () => {
      const created: PageId[] = [];

      for (let index = 0; index < 12; index += 1) {
        created.push(await insertPage(userA, `Page ${index}`));
      }

      // Visit oldest first so the ordering is deterministic.
      for (const pageId of created) {
        await recordRecentPage(userA, pageId);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const recent = await listRecentPages(userA);
      expect(recent).toHaveLength(10);
      // The most recently viewed page is the last one inserted.
      expect(recent[0]?.title).toBe("Page 11");
      expect(recent[9]?.title).toBe("Page 2");
    });
  });
});
