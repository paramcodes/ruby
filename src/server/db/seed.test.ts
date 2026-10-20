// @vitest-environment node

import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { pageContent } from "@/server/pages/content-schema";
import { page } from "@/server/pages/schema";
import { pageView } from "@/server/pages/recent-pages-schema";
import { favorite } from "@/server/pages/favorites-schema";

import { runSeed, type SeedIdentity } from "./seed";

vi.mock("server-only", () => ({}));

// The seed creates its user through Better Auth, which refuses to run
// without a secret. The test only needs a value that is stable within this
// process.
process.env.BETTER_AUTH_SECRET ??=
  "seed-test-secret-32-characters-minimum-length";

type PageRow = {
  id: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
};

type ContentRow = {
  pageId: string;
  revision: number;
  searchText: string;
};

async function readPages(workspaceIds: string[]): Promise<PageRow[]> {
  const rows = await db
    .select({
      id: page.id,
      title: page.title,
      parentId: page.parentId,
      sortOrder: page.sortOrder
    })
    .from(page)
    .where(inArray(page.workspaceId, workspaceIds))
    .orderBy(page.id);

  return rows;
}

async function readContent(workspaceIds: string[]): Promise<ContentRow[]> {
  const rows = await db
    .select({
      pageId: pageContent.pageId,
      revision: pageContent.revision,
      searchText: pageContent.searchText
    })
    .from(pageContent)
    .where(inArray(pageContent.workspaceId, workspaceIds))
    .orderBy(pageContent.pageId);

  return rows;
}

describe.skipIf(!process.env.DATABASE_URL)("seed", () => {
  // A scratch identity keeps the seeded rows out of the development data.
  const identity: SeedIdentity = {
    email: `seed-test-${randomUUID()}@example.test`,
    name: "Seed Test",
    password: "password1234"
  };

  afterAll(async () => {
    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, identity.email));

    if (rows[0]) {
      await db.delete(user).where(eq(user.id, rows[0].id));
    }
  });

  it("creates the same pages, ids, and content on a second run", async () => {
    const first = await runSeed(identity);

    const workspaceIds = await db
      .select({ id: page.workspaceId })
      .from(page)
      .where(eq(page.id, first.pageIds[0] ?? ""));

    const pagesAfterFirstRun = await readPages(
      workspaceIds.map((row) => row.id)
    );
    const contentAfterFirstRun = await readContent(
      workspaceIds.map((row) => row.id)
    );

    const second = await runSeed(identity);

    const pagesAfterSecondRun = await readPages(
      workspaceIds.map((row) => row.id)
    );
    const contentAfterSecondRun = await readContent(
      workspaceIds.map((row) => row.id)
    );

    expect(second.userId).toBe(first.userId);
    expect(second.pageIds).toEqual(first.pageIds);
    expect(pagesAfterFirstRun.length).toBe(5);
    expect(pagesAfterFirstRun.map((row) => row.id).sort()).toEqual(
      [...first.pageIds].sort()
    );
    expect(pagesAfterSecondRun).toEqual(pagesAfterFirstRun);
    expect(contentAfterSecondRun).toEqual(contentAfterFirstRun);
    expect(contentAfterFirstRun.length).toBe(5);
    expect(contentAfterFirstRun.every((row) => row.revision === 1)).toBe(true);
  });

  it("does not create a second user for the same identity", async () => {
    await runSeed(identity);
    await runSeed(identity);

    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, identity.email));

    expect(rows).toHaveLength(1);
  });

  it("leaves no favorite or recent-view rows behind", async () => {
    const result = await runSeed(identity);

    const favorites = await db
      .select({ pageId: favorite.pageId })
      .from(favorite)
      .where(eq(favorite.userId, result.userId));

    const views = await db
      .select({ pageId: pageView.pageId })
      .from(pageView)
      .where(eq(pageView.userId, result.userId));

    expect(favorites).toEqual([]);
    expect(views).toEqual([]);
  });
});
