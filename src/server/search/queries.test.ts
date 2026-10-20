// @vitest-environment node

import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import {
  extractSearchableText,
  type EditorDocument
} from "@/components/editor/editor-adapter";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId, type PageId } from "@/server/ids";
import { favorite } from "@/server/pages/favorites-schema";
import { pageContent } from "@/server/pages/content-schema";
import { page } from "@/server/pages/schema";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

import { buildSearchQuery, searchPages } from "./queries";

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

function documentWith(text: string): EditorDocument {
  return {
    schemaVersion: 1,
    content: [
      {
        id: "paragraph-1",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text, styles: {} }],
        children: []
      }
    ]
  };
}

describe.skipIf(!hasDatabase)("searchPages", () => {
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
    await db
      .delete(pageContent)
      .where(inArray(pageContent.workspaceId, [workspaceA, workspaceB]));
    await db.delete(favorite).where(inArray(favorite.userId, [userA, userB]));
  });

  async function insertPage(
    userId: string,
    title: string,
    text: string | null
  ): Promise<PageId> {
    const workspaceId = userId === userA ? workspaceA : workspaceB;
    const id = randomUUID();

    await db.insert(page).values({
      id,
      workspaceId,
      parentId: null,
      title,
      sortOrder: 0
    });

    if (text !== null) {
      const doc = documentWith(text);
      await db.insert(pageContent).values({
        pageId: id,
        workspaceId,
        document: doc,
        revision: 1,
        searchText: extractSearchableText(doc)
      });
    }

    return asPageId(id);
  }

  it("matches a page by title", async () => {
    await insertPage(userA, "Getting Started Guide", null);

    const results = await searchPages(userA, "getting");

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Getting Started Guide");
  });

  it("matches a page by body text", async () => {
    await insertPage(userA, "Empty Page", "Welcome to the wiki");

    const results = await searchPages(userA, "welcome");

    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Empty Page");
  });

  it("returns no results for a query with no matches", async () => {
    await insertPage(userA, "Getting Started", null);

    const results = await searchPages(userA, "nonexistent");

    expect(results).toEqual([]);
  });

  it("excludes archived pages from results", async () => {
    const active = await insertPage(userA, "Active Page", null);
    const archived = await insertPage(userA, "Archived Page", null);

    await db
      .update(page)
      .set({ archivedAt: new Date() })
      .where(eq(page.id, archived));

    const results = await searchPages(userA, "page");

    const titles = results.map((r) => r.title);
    expect(titles).toEqual(["Active Page"]);
    expect(results[0]?.id).toBe(active);
  });

  it("scopes results to the requesting user", async () => {
    const pageA = await insertPage(userA, "Shared Title", null);
    await insertPage(userB, "Shared Title", null);

    const results = await searchPages(userA, "shared");

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe(pageA);
  });

  it("marks favorited pages in results", async () => {
    const pageId = await insertPage(userA, "Favorited Page", null);

    await db.insert(favorite).values({
      userId: userA,
      pageId
    });

    const results = await searchPages(userA, "favorited");

    expect(results[0]?.favorited).toBe(true);
  });

  it("marks non-favorited pages as not favorited", async () => {
    await insertPage(userA, "Normal Page", null);

    const results = await searchPages(userA, "normal");

    expect(results[0]?.favorited).toBe(false);
  });

  it("plans the search query with both full-text GIN indexes", async () => {
    // Enough rows for the planner to weigh the GIN index against a
    // sequential scan, and a term only these rows contain.
    const inserted = await db
      .insert(page)
      .values(
        Array.from({ length: 300 }, (_unused, index) => ({
          id: randomUUID(),
          workspaceId: workspaceA,
          parentId: null,
          title: `Indexed Field Note ${index}`,
          sortOrder: index
        }))
      )
      .returning({ id: page.id });

    await db.insert(pageContent).values(
      inserted.map((row) => ({
        pageId: row.id,
        workspaceId: workspaceA,
        document: documentWith("Indexed body text"),
        revision: 1,
        searchText: "Indexed body text"
      }))
    );

    // Fresh statistics so the planner costs the index scan against the real
    // table size.
    await db.execute(sql`analyze page`);
    await db.execute(sql`analyze page_content`);

    const planText = await db.transaction(async (tx) => {
      // A sequential scan is disabled so the assertion is about which index
      // the query can use, not about how large the table happens to be.
      await tx.execute(sql`set local enable_seqscan = off`);

      const plan = await tx.execute<{ "QUERY PLAN": string }>(
        sql`EXPLAIN ${buildSearchQuery(userA, "indexed")}`
      );

      return plan.map((row) => row["QUERY PLAN"]).join("\n");
    });

    expect(planText).toContain("page_search_title_idx");
    expect(planText).toContain("page_search_content_idx");
  });
});
