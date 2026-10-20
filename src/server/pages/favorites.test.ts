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
import {
  addFavorite,
  isPageFavorited,
  listFavoritePageIds,
  listFavorites,
  removeFavorite
} from "@/server/pages/favorites";
import { favorite } from "@/server/pages/favorites-schema";
import { page } from "@/server/pages/schema";
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

describe.skipIf(!hasDatabase)("favorites", () => {
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
    await db.delete(favorite).where(inArray(favorite.userId, [userA, userB]));
  });

  async function insertPage(
    userId: string,
    title: string,
    parentId: PageId | null = null
  ): Promise<PageId> {
    const workspaceId = userId === userA ? workspaceA : workspaceB;
    const id = randomUUID();
    await db.insert(page).values({
      id,
      workspaceId,
      parentId,
      title,
      sortOrder: 0
    });
    return asPageId(id);
  }

  describe("addFavorite", () => {
    it("favorites a page and lists it", async () => {
      const pageId = await insertPage(userA, "Pinned");

      await addFavorite(userA, pageId);

      const favorites = await listFavorites(userA);
      expect(favorites.map((item) => item.title)).toEqual(["Pinned"]);
      expect(favorites[0]?.id).toEqual(pageId);
    });

    it("does not error and does not create a second row on a duplicate", async () => {
      const pageId = await insertPage(userA, "Duplicated");

      await addFavorite(userA, pageId);
      await addFavorite(userA, pageId);

      const ids = await listFavoritePageIds(userA);
      expect(ids).toEqual([pageId]);
      expect(await isPageFavorited(userA, pageId)).toBe(true);

      const rows = await db
        .select()
        .from(favorite)
        .where(eq(favorite.pageId, pageId));
      expect(rows).toHaveLength(1);
    });

    it("is a no-op for a page owned by another user", async () => {
      const pageId = await insertPage(userB, "Someone else");

      await addFavorite(userA, pageId);

      await expect(listFavorites(userA)).resolves.toEqual([]);
      await expect(isPageFavorited(userA, pageId)).resolves.toBe(false);
    });
  });

  describe("removeFavorite", () => {
    it("removes a favorite", async () => {
      const pageId = await insertPage(userA, "Removable");

      await addFavorite(userA, pageId);
      await removeFavorite(userA, pageId);

      await expect(listFavorites(userA)).resolves.toEqual([]);
      await expect(isPageFavorited(userA, pageId)).resolves.toBe(false);
    });

    it("does not error when the page is not favorited", async () => {
      const pageId = await insertPage(userA, "Unfavored");

      await expect(removeFavorite(userA, pageId)).resolves.toBeUndefined();
      await expect(listFavorites(userA)).resolves.toEqual([]);
    });
  });

  describe("listFavorites", () => {
    it("excludes archived pages from the active list", async () => {
      const active = await insertPage(userA, "Active favorite");
      const archived = await insertPage(userA, "Archived favorite");

      await addFavorite(userA, active);
      await addFavorite(userA, archived);

      await db
        .update(page)
        .set({ archivedAt: new Date() })
        .where(eq(page.id, archived));

      const favorites = await listFavorites(userA);
      expect(favorites.map((item) => item.title)).toEqual(["Active favorite"]);
    });

    it("keeps each user's favorites isolated", async () => {
      const pageA = await insertPage(userA, "A favorite");
      const pageB = await insertPage(userB, "B favorite");

      await addFavorite(userA, pageA);
      await addFavorite(userB, pageB);

      expect((await listFavorites(userA)).map((item) => item.title)).toEqual([
        "A favorite"
      ]);
      expect((await listFavorites(userB)).map((item) => item.title)).toEqual([
        "B favorite"
      ]);
    });
  });
});
