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

import {
  extractSearchableText,
  type EditorDocument
} from "@/components/editor/editor-adapter";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId, type PageId } from "@/server/ids";
import { createPage } from "@/server/pages/commands";
import {
  getPageContent,
  savePageContent
} from "@/server/pages/content-commands";
import { pageContent } from "@/server/pages/content-schema";
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

async function createUser(): Promise<string> {
  const id = randomUUID();
  await db.insert(user).values({
    id,
    name: `Test user ${id}`,
    email: `${id}@example.test`
  });
  return id;
}

describe.skipIf(!hasDatabase)("page content commands", () => {
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

  async function createPageFor(userId: string, title: string) {
    const result = await createPage(userId, { title, parentId: null });

    if (!result.ok) {
      throw new Error(`Could not create page: ${result.error}`);
    }

    return result.value.id;
  }

  it("saves a document and reloads it with its revision", async () => {
    const pageId = await createPageFor(userA, "Persisted");
    const first = documentWith("First draft");

    await expect(
      savePageContent(userA, pageId, first, 1)
    ).resolves.toMatchObject({
      status: "saved",
      revision: 1
    });

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "ok",
      document: first,
      revision: 1
    });

    const second = documentWith("Second draft");

    await expect(
      savePageContent(userA, pageId, second, 1)
    ).resolves.toMatchObject({
      status: "saved",
      revision: 2
    });

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "ok",
      document: second,
      revision: 2
    });
  });

  it("returns the empty document at revision 1 before the first save", async () => {
    const pageId = await createPageFor(userA, "Untouched");

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "ok",
      document: { schemaVersion: 1, content: [] },
      revision: 1
    });
  });

  it("rejects a malformed document without writing anything", async () => {
    const pageId = await createPageFor(userA, "Malformed");
    const malformed = {
      schemaVersion: 1,
      content: undefined
    } as unknown as EditorDocument;

    const result = await savePageContent(userA, pageId, malformed, 1);

    expect(result.status).toBe("invalid");
    expect(result).toMatchObject({ status: "invalid" });

    const rows = await db
      .select()
      .from(pageContent)
      .where(eq(pageContent.pageId, pageId));

    expect(rows).toHaveLength(0);
  });

  it("treats another user's page exactly like a missing page", async () => {
    const pageId = await createPageFor(userA, "Private page");
    const missingPageId = asPageId(randomUUID());
    const document = documentWith("Should not land");

    const ownerSave = await savePageContent(userA, pageId, document, 1);
    expect(ownerSave.status).toBe("saved");

    const crossUserSave = await savePageContent(userB, pageId, document, 2);
    const missingSave = await savePageContent(
      userB,
      missingPageId,
      document,
      1
    );

    expect(crossUserSave).toEqual(missingSave);
    expect(crossUserSave).toMatchObject({
      status: "invalid",
      message: "Page not found."
    });

    const crossUserRead = await getPageContent(userB, pageId);
    const missingRead = await getPageContent(userB, missingPageId);

    expect(crossUserRead).toEqual(missingRead);
    expect(crossUserRead).toMatchObject({ status: "not-found" });

    const ownerContent = await getPageContent(userA, pageId);
    expect(ownerContent).toMatchObject({
      status: "ok",
      document,
      revision: 1
    });
  });

  it("rejects a stale revision and keeps the stored document", async () => {
    const pageId = await createPageFor(userA, "Revisioned");
    const first = documentWith("Tab one");
    const second = documentWith("Tab two");
    const stale = documentWith("Stale tab");

    await savePageContent(userA, pageId, first, 1);
    await savePageContent(userA, pageId, second, 1);

    await expect(savePageContent(userA, pageId, stale, 1)).resolves.toEqual({
      status: "conflict",
      currentRevision: 2
    });

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "ok",
      document: second,
      revision: 2
    });
  });

  it("writes search text derived from the whole nested document", async () => {
    const pageId = await createPageFor(userA, "Searchable");
    const document: EditorDocument = {
      schemaVersion: 1,
      content: [
        {
          id: "a",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Reading list", styles: {} }],
          children: []
        },
        {
          id: "b",
          type: "bulletListItem",
          props: {},
          content: [{ type: "text", text: "Ursula Le Guin", styles: {} }],
          children: [
            {
              id: "c",
              type: "bulletListItem",
              props: {},
              content: [{ type: "text", text: "The Dispossessed", styles: {} }],
              children: []
            }
          ]
        }
      ]
    };

    await savePageContent(userA, pageId, document, 1);

    const rows = await db
      .select({ searchText: pageContent.searchText })
      .from(pageContent)
      .where(eq(pageContent.pageId, pageId));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.searchText).toBe(extractSearchableText(document));
    expect(rows[0]?.searchText).toContain("The Dispossessed");
  });

  it("reports an invalid or unsupported stored document instead of throwing", async () => {
    const pageId = await createPageFor(userA, "Corrupt");

    await savePageContent(userA, pageId, documentWith("Good"), 1);

    await db
      .update(pageContent)
      .set({ document: { schemaVersion: 1, content: undefined } })
      .where(eq(pageContent.pageId, pageId));

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "invalid"
    });

    await db
      .update(pageContent)
      .set({ document: { schemaVersion: 99, content: [] } })
      .where(eq(pageContent.pageId, pageId));

    await expect(getPageContent(userA, pageId)).resolves.toMatchObject({
      status: "unsupported-version"
    });
  });

  it("stores the workspace that owns the page", async () => {
    const pageId = await createPageFor(userA, "Owned");
    await savePageContent(userA, pageId, documentWith("Body"), 1);

    const rows = await db
      .select({ workspaceId: pageContent.workspaceId })
      .from(pageContent)
      .innerJoin(workspace, eq(workspace.id, pageContent.workspaceId))
      .where(eq(pageContent.pageId, pageId));

    expect(rows[0]?.workspaceId).toBe(workspaceA);
  });
});
