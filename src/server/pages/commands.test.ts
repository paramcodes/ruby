// @vitest-environment node

import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
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
  archivePage,
  createPage,
  movePage,
  renamePage,
  restorePage,
  type PageCommandError,
  type Result
} from "@/server/pages/commands";
import {
  getPageForUser,
  listArchivedPagesForUser,
  listPagesForUser
} from "@/server/pages/queries";
import { page } from "@/server/pages/schema";
import {
  MAX_TITLE_LENGTH,
  type CreatePageInput,
  type PageSummary
} from "@/server/pages/types";
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

function unwrap<T>(result: Result<T, PageCommandError>): T {
  if (!result.ok) {
    throw new Error(`Expected success, received ${result.error}`);
  }

  return result.value;
}

// Walks every page's parent chain and reports whether a page repeats. A cycle
// would make this return false.
function isAcyclic(pages: readonly PageSummary[]): boolean {
  const parentById = new Map(pages.map((item) => [item.id, item.parentId]));

  for (const item of pages) {
    const visited = new Set<PageId>();
    let current: PageId | null = item.id;

    while (current !== null) {
      if (visited.has(current)) {
        return false;
      }

      visited.add(current);
      current = parentById.get(current) ?? null;
    }
  }

  return true;
}

describe.skipIf(!hasDatabase)("page commands", () => {
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
  });

  async function create(
    userId: string,
    title: string,
    parentId: PageId | null = null
  ): Promise<PageSummary> {
    return unwrap(await createPage(userId, { title, parentId }));
  }

  describe("createPage", () => {
    it("creates a trimmed root page with the next sibling sort order", async () => {
      const first = await create(userA, "  First page  ");
      const second = await create(userA, "Second page");

      expect(first).toMatchObject({
        parentId: null,
        title: "First page",
        sortOrder: 0,
        archivedAt: null
      });
      expect(second.sortOrder).toBe(1);
      expect(second.id).not.toBe(first.id);
    });

    it("creates a child with the next sibling sort order under its parent", async () => {
      const parent = await create(userA, "Parent");
      const firstChild = await create(userA, "Child one", parent.id);
      const secondChild = await create(userA, "Child two", parent.id);
      const otherParent = await create(userA, "Other parent");
      const otherChild = await create(userA, "Other child", otherParent.id);

      expect(firstChild).toMatchObject({
        parentId: parent.id,
        sortOrder: 0
      });
      expect(secondChild).toMatchObject({
        parentId: parent.id,
        sortOrder: 1
      });
      expect(otherChild.sortOrder).toBe(0);
    });

    it("rejects an invalid title", async () => {
      await expect(
        createPage(userA, { title: "   ", parentId: null })
      ).resolves.toEqual({ ok: false, error: "invalid-title" });
      await expect(
        createPage(userA, {
          title: "a".repeat(MAX_TITLE_LENGTH + 1),
          parentId: null
        })
      ).resolves.toEqual({ ok: false, error: "invalid-title" });
      await expect(
        createPage(userA, {
          title: 42 as unknown as string,
          parentId: null
        } satisfies CreatePageInput)
      ).resolves.toEqual({ ok: false, error: "invalid-title" });
    });

    it("rejects a missing parent and a parent owned by another user", async () => {
      await expect(
        createPage(userA, { title: "Orphan", parentId: asPageId(randomUUID()) })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      const otherUsersPage = await create(userB, "Private parent");

      await expect(
        createPage(userA, { title: "Orphan", parentId: otherUsersPage.id })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });
    });

    it("rejects an archived parent", async () => {
      const parent = await create(userA, "Parent");
      unwrap(await archivePage(userA, parent.id));

      await expect(
        createPage(userA, { title: "Child", parentId: parent.id })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      expect(await listPagesForUser(userA)).toEqual([]);
      expect(
        (await listArchivedPagesForUser(userA)).map((item) => item.id)
      ).toEqual([parent.id]);
    });

    it("creates a page with an explicit id and keeps the ownership rules", async () => {
      const id = asPageId(randomUUID());

      const created = unwrap(
        await createPage(userA, { id, title: "Seeded page", parentId: null })
      );

      expect(created.id).toBe(id);

      await expect(
        createPage(userA, {
          id: " padded id " as PageId,
          title: "Bad id",
          parentId: null
        })
      ).resolves.toEqual({ ok: false, error: "not-found" });

      const otherUsersPage = await create(userB, "Private parent");

      await expect(
        createPage(userA, {
          id,
          title: "Stolen parent",
          parentId: otherUsersPage.id
        })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });
    });
  });

  describe("renamePage", () => {
    it("renames an owned page and trims the title", async () => {
      const created = await create(userA, "Old title");

      const renamed = unwrap(
        await renamePage(userA, created.id, "  New title  ")
      );

      expect(renamed).toMatchObject({
        id: created.id,
        title: "New title",
        parentId: null,
        sortOrder: created.sortOrder
      });

      const stored = await getPageForUser(userA, created.id);
      expect(stored?.title).toBe("New title");
    });

    it("rejects an invalid title", async () => {
      const created = await create(userA, "Valid");

      await expect(renamePage(userA, created.id, "")).resolves.toEqual({
        ok: false,
        error: "invalid-title"
      });
      await expect(
        renamePage(userA, created.id, "a".repeat(MAX_TITLE_LENGTH + 1))
      ).resolves.toEqual({ ok: false, error: "invalid-title" });
    });

    it("returns not-found for a missing page and for another user's page", async () => {
      const otherUsersPage = await create(userB, "Private");

      await expect(
        renamePage(userA, otherUsersPage.id, "Stolen")
      ).resolves.toEqual({ ok: false, error: "not-found" });
      await expect(
        renamePage(userA, asPageId(randomUUID()), "Missing")
      ).resolves.toEqual({ ok: false, error: "not-found" });
    });
  });

  describe("movePage", () => {
    it("moves a page under a new parent with the requested sort order", async () => {
      const parent = await create(userA, "Parent");
      const moving = await create(userA, "Moving");
      const sibling = await create(userA, "Sibling", parent.id);

      const moved = unwrap(
        await movePage(userA, {
          pageId: moving.id,
          parentId: parent.id,
          sortOrder: 5
        })
      );

      expect(moved).toMatchObject({
        id: moving.id,
        parentId: parent.id,
        sortOrder: 5
      });

      const stored = await getPageForUser(userA, moving.id);
      expect(stored).toMatchObject({ parentId: parent.id, sortOrder: 5 });
      expect((await getPageForUser(userA, sibling.id))?.sortOrder).toBe(0);
    });

    it("moves a page back to the root", async () => {
      const parent = await create(userA, "Parent");
      const child = await create(userA, "Child", parent.id);

      const moved = unwrap(
        await movePage(userA, {
          pageId: child.id,
          parentId: null,
          sortOrder: 2
        })
      );

      expect(moved).toMatchObject({ parentId: null, sortOrder: 2 });
    });

    it("rejects making a page its own parent or a descendant's child", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      const grandchild = await create(userA, "Grandchild", child.id);

      await expect(
        movePage(userA, {
          pageId: root.id,
          parentId: root.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "cycle" });

      await expect(
        movePage(userA, {
          pageId: root.id,
          parentId: grandchild.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "cycle" });

      await expect(
        movePage(userA, {
          pageId: child.id,
          parentId: grandchild.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "cycle" });
    });

    it("leaves the tree unchanged when a move is rejected", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      const grandchild = await create(userA, "Grandchild", child.id);

      const before = await listPagesForUser(userA);

      await expect(
        movePage(userA, {
          pageId: root.id,
          parentId: grandchild.id,
          sortOrder: 9
        })
      ).resolves.toEqual({ ok: false, error: "cycle" });

      await expect(
        movePage(userA, {
          pageId: root.id,
          parentId: asPageId(randomUUID()),
          sortOrder: 9
        })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      const after = await listPagesForUser(userA);

      expect(after).toEqual(before);
      expect(await getPageForUser(userA, root.id)).toMatchObject({
        parentId: null,
        sortOrder: 0
      });
    });

    it("rejects a missing parent and a parent owned by another user", async () => {
      const moving = await create(userA, "Moving");
      const otherUsersPage = await create(userB, "Private parent");

      await expect(
        movePage(userA, {
          pageId: moving.id,
          parentId: asPageId(randomUUID()),
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      await expect(
        movePage(userA, {
          pageId: moving.id,
          parentId: otherUsersPage.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      expect((await getPageForUser(userA, moving.id))?.parentId).toBeNull();
    });

    it("rejects an archived parent", async () => {
      const moving = await create(userA, "Moving");
      const parent = await create(userA, "Parent");
      unwrap(await archivePage(userA, parent.id));

      await expect(
        movePage(userA, {
          pageId: moving.id,
          parentId: parent.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "invalid-parent" });

      expect((await getPageForUser(userA, moving.id))?.parentId).toBeNull();
    });

    it("serializes concurrent moves so they cannot create a cycle", async () => {
      const first = await create(userA, "A");
      const second = await create(userA, "B");

      // Warm up a second pooled connection. Otherwise postgres.js spends the
      // first move's whole duration opening one, the two transactions never
      // overlap, and the test would pass even without the per-user lock.
      await Promise.all([
        db.execute(sql`select pg_sleep(0.05)`),
        db.execute(sql`select pg_sleep(0.05)`)
      ]);

      const results = await Promise.all([
        movePage(userA, {
          pageId: first.id,
          parentId: second.id,
          sortOrder: 0
        }),
        movePage(userA, {
          pageId: second.id,
          parentId: first.id,
          sortOrder: 0
        })
      ]);

      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toEqual({
        ok: false,
        error: "cycle"
      });

      const pages = await listPagesForUser(userA);
      expect(isAcyclic(pages)).toBe(true);
      // Exactly one of the two pages was reparented under the other.
      expect(pages.filter((item) => item.parentId !== null)).toHaveLength(1);
    });

    it("returns not-found for a missing page and for another user's page", async () => {
      const otherUsersPage = await create(userB, "Private");
      const parent = await create(userA, "Parent");

      await expect(
        movePage(userA, {
          pageId: otherUsersPage.id,
          parentId: parent.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "not-found" });

      await expect(
        movePage(userA, {
          pageId: asPageId(randomUUID()),
          parentId: parent.id,
          sortOrder: 0
        })
      ).resolves.toEqual({ ok: false, error: "not-found" });

      expect((await getPageForUser(userB, otherUsersPage.id))?.parentId).toBe(
        null
      );
    });
  });

  describe("archivePage", () => {
    it("archives a page and its descendants as one subtree", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      const grandchild = await create(userA, "Grandchild", child.id);
      const sibling = await create(userA, "Sibling", root.id);
      const unrelated = await create(userA, "Unrelated");

      const archived = unwrap(await archivePage(userA, root.id));

      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(archived.id).toBe(root.id);

      const active = await listPagesForUser(userA);
      const archivedPages = await listArchivedPagesForUser(userA);

      expect(active.map((item) => item.id).sort()).toEqual(
        [unrelated.id].sort()
      );
      expect(archivedPages.map((item) => item.id).sort()).toEqual(
        [root.id, child.id, grandchild.id, sibling.id].sort()
      );
      expect(archivedPages.every((item) => item.archivedAt !== null)).toBe(
        true
      );
    });

    it("returns not-found for a missing page and for another user's page", async () => {
      const otherUsersPage = await create(userB, "Private");

      await expect(archivePage(userA, otherUsersPage.id)).resolves.toEqual({
        ok: false,
        error: "not-found"
      });
      await expect(archivePage(userA, asPageId(randomUUID()))).resolves.toEqual(
        { ok: false, error: "not-found" }
      );

      expect((await getPageForUser(userB, otherUsersPage.id))?.archivedAt).toBe(
        null
      );
    });
  });

  describe("restorePage", () => {
    it("restores an archived page and its archived descendants", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      const grandchild = await create(userA, "Grandchild", child.id);
      const unrelated = await create(userA, "Unrelated");

      unwrap(await archivePage(userA, root.id));
      unwrap(await archivePage(userA, unrelated.id));

      const restored = unwrap(await restorePage(userA, root.id));

      expect(restored.archivedAt).toBeNull();

      const active = await listPagesForUser(userA);
      const archivedPages = await listArchivedPagesForUser(userA);

      expect(active.map((item) => item.id).sort()).toEqual(
        [root.id, child.id, grandchild.id].sort()
      );
      expect(archivedPages.map((item) => item.id)).toEqual([unrelated.id]);
    });

    it("restores archived ancestors so the restored page is reachable", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      const grandchild = await create(userA, "Grandchild", child.id);

      unwrap(await archivePage(userA, root.id));

      const restored = unwrap(await restorePage(userA, grandchild.id));

      expect(restored.archivedAt).toBeNull();

      const active = await listPagesForUser(userA);
      expect(active.map((item) => item.id).sort()).toEqual(
        [root.id, child.id, grandchild.id].sort()
      );
      expect(await listArchivedPagesForUser(userA)).toEqual([]);
    });

    it("is a no-op for an already-active page and leaves archived descendants alone", async () => {
      const root = await create(userA, "Root");
      const child = await create(userA, "Child", root.id);
      unwrap(await archivePage(userA, child.id));

      const childBeforeRestore = await getPageForUser(userA, child.id);
      const childArchivedAt = childBeforeRestore?.archivedAt;

      if (!childArchivedAt) {
        throw new Error("Expected the archived child to have an archivedAt");
      }

      const restored = unwrap(await restorePage(userA, root.id));

      expect(restored).toMatchObject({ id: root.id, archivedAt: null });
      // Restoring the active root must not touch the child's archive timestamp.
      expect(
        (await getPageForUser(userA, child.id))?.archivedAt?.getTime()
      ).toBe(childArchivedAt.getTime());
      expect(
        (await listArchivedPagesForUser(userA)).map((item) => item.id)
      ).toEqual([child.id]);
    });

    it("returns not-found for a missing page and for another user's page", async () => {
      const otherUsersPage = await create(userB, "Private");
      unwrap(await archivePage(userB, otherUsersPage.id));

      await expect(restorePage(userA, otherUsersPage.id)).resolves.toEqual({
        ok: false,
        error: "not-found"
      });
      await expect(restorePage(userA, asPageId(randomUUID()))).resolves.toEqual(
        { ok: false, error: "not-found" }
      );

      expect(
        (await getPageForUser(userB, otherUsersPage.id))?.archivedAt
      ).not.toBeNull();
    });
  });
});
