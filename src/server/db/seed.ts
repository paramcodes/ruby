import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";

import {
  CURRENT_SCHEMA_VERSION,
  extractSearchableText,
  type EditorDocument
} from "@/components/editor/editor-adapter";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId, type PageId } from "@/server/ids";
import { createPage, movePage, renamePage } from "@/server/pages/commands";
import {
  savePageContent,
  getPageContent
} from "@/server/pages/content-commands";
import { getPageForUser } from "@/server/pages/queries";

// Deterministic seed data for local development. Re-running `pnpm db:seed`
// is idempotent: pages are created through the page domain commands with
// deterministic ids, so a second run finds the same rows instead of creating
// duplicates, and content is overwritten only when the stored document differs
// from the expected one.

export type SeedIdentity = {
  email: string;
  name: string;
  password: string;
};

export type SeedResult = {
  userId: string;
  /** The seeded page ids, in seed definition order. */
  pageIds: PageId[];
};

const DEFAULT_IDENTITY: SeedIdentity = {
  email: "wiki@example.com",
  name: "Wiki",
  password: "password1234"
};

// DNS namespace UUID (RFC 4122) used as the base for deterministic page ids.
const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

type SeedPageDef = {
  key: string;
  title: string;
  parentKey: string | null;
  body: string;
};

const seedPages: SeedPageDef[] = [
  {
    key: "welcome",
    title: "Welcome to Individual Wiki",
    parentKey: null,
    body: "Welcome to your individual wiki. Organize notes into pages, nest them into a hierarchy, and search across titles and content."
  },
  {
    key: "getting-started",
    title: "Getting Started",
    parentKey: "welcome",
    body: "To create a page, type a title in the sidebar and press Create. You can rename, move, archive, and favorite pages at any time."
  },
  {
    key: "first-steps",
    title: "First Steps",
    parentKey: "getting-started",
    body: "Each page holds editor content. Try typing here changes save automatically as you type."
  },
  {
    key: "creating-pages",
    title: "Creating Pages",
    parentKey: "welcome",
    body: "Pages can be nested. Move a page onto another to make it a child page or reorganize your workspace."
  },
  {
    key: "search-discovery",
    title: "Search and Discovery",
    parentKey: "welcome",
    body: "Use the search dialog or Cmd+K to find pages by title or content. Search matches both page titles and page body text."
  }
];

// UUID v5: SHA-1(namespace_bytes + name_bytes), formatted to RFC 4122.
function uuidv5(userId: string, key: string): string {
  const namespace = Buffer.from(NAMESPACE_DNS.replace(/-/g, ""), "hex");
  const name = Buffer.from(`${userId}:${key}`, "utf8");
  const hash = createHash("sha1")
    .update(Buffer.concat([namespace, name]))
    .digest();

  // Set version (5) and variant bits per RFC 4122.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  return formatUuid(hash.subarray(0, 16));
}

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join("")
  ].join("-");
}

function pageDocument(body: string): EditorDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    content: [
      {
        id: "paragraph-1",
        type: "paragraph",
        props: {},
        content: [{ type: "text", text: body, styles: {} }],
        children: []
      }
    ]
  };
}

// Creates or finds the seed user via Better Auth's server-side API. If the
// email already exists (a second seed run), the sign-up call throws and we
// fall back to a direct lookup by email.
async function ensureUser(identity: SeedIdentity): Promise<string> {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: identity.email,
        password: identity.password,
        name: identity.name
      }
    });
    return result.user.id;
  } catch {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, identity.email));

    const row = existing[0];
    if (!row) {
      throw new Error("Could not create or find seed user");
    }
    return row.id;
  }
}

// Creates every seed page with a deterministic id and a stable hierarchy.
// The pages are created through the page domain commands, so title validation,
// the archived-parent check, and workspace ownership all apply. Pages are
// created in definition order so parent rows always exist before their
// children, satisfying the foreign-key constraint on (workspace, parent).
async function upsertPages(userId: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const def of seedPages) {
    const id = toPageId(uuidv5(userId, def.key));

    if (!id) {
      throw new Error(`Could not build a page id for seed page ${def.key}`);
    }

    ids.set(def.key, id);

    const parentId = def.parentKey
      ? toPageId(ids.get(def.parentKey) ?? "")
      : null;

    if (def.parentKey !== null && parentId === null) {
      throw new Error(`Missing parent page: ${def.parentKey}`);
    }

    const existing = await getPageForUser(userId, id);

    if (existing) {
      // An earlier run already created this page. Keep it in sync with the
      // seed definition instead of creating a second row.
      await syncExistingPage(userId, id, def, parentId, existing);
      continue;
    }

    const created = await createPage(userId, {
      id,
      title: def.title,
      parentId
    });

    if (!created.ok) {
      throw new Error(
        `Could not create seed page ${def.key}: ${created.error}`
      );
    }
  }

  return ids;
}

// Brings an already seeded page back in line with the seed definition.
async function syncExistingPage(
  userId: string,
  id: PageId,
  def: SeedPageDef,
  parentId: PageId | null,
  existing: { title: string; parentId: PageId | null; sortOrder: number }
): Promise<void> {
  if (existing.title !== def.title) {
    const renamed = await renamePage(userId, id, def.title);

    if (!renamed.ok) {
      throw new Error(
        `Could not rename seed page ${def.key}: ${renamed.error}`
      );
    }
  }

  if (existing.parentId !== parentId) {
    const moved = await movePage(userId, {
      pageId: id,
      parentId,
      sortOrder: existing.sortOrder
    });

    if (!moved.ok) {
      throw new Error(`Could not move seed page ${def.key}: ${moved.error}`);
    }
  }
}

// Saves editor content for each seed page, but only when the stored document
// differs from the expected one. This keeps repeated seed runs idempotent:
// revision numbers are not bumped and user edits to seeded pages are
// overwritten only when the seed definition has changed.
async function seedContent(
  userId: string,
  ids: Map<string, string>
): Promise<void> {
  for (const def of seedPages) {
    const id = toPageId(ids.get(def.key) ?? "");
    if (!id) continue;

    const expected = pageDocument(def.body);
    const expectedText = extractSearchableText(expected);

    const current = await getPageContent(userId, id);

    if (current.status !== "ok") {
      // Page not found or not owned — skip; upsertPages should have created it.
      continue;
    }

    if (current.revision === 0) {
      // No content yet — insert the initial revision.
      await savePageContent(userId, id, expected, 0);
      continue;
    }

    const currentText = extractSearchableText(current.document);
    if (currentText !== expectedText) {
      // Stored content differs from the seed — overwrite.
      await savePageContent(userId, id, expected, current.revision);
    }
  }
}

// Seeds the workspace of the given identity. Safe to call repeatedly: the
// pages, their ids, and their content revisions stay the same.
export async function runSeed(identity: SeedIdentity): Promise<SeedResult> {
  const userId = await ensureUser(identity);
  const ids = await upsertPages(userId);
  await seedContent(userId, ids);

  const pageIds: PageId[] = [];

  for (const def of seedPages) {
    const id = toPageId(ids.get(def.key) ?? "");

    if (!id) {
      throw new Error(`Missing seeded page id for ${def.key}`);
    }

    pageIds.push(id);
  }

  return { userId, pageIds };
}

async function main(): Promise<void> {
  const result = await runSeed(DEFAULT_IDENTITY);
  console.log(`Seed complete: ${result.pageIds.length} pages`);
  // The db proxy binds function values, which strips methods like `.end()`
  // from the postgres client. Access the raw client through the session,
  // which is an internal property not surfaced by Drizzle's types.
  await (
    db as unknown as { session: { client: { end: () => Promise<void> } } }
  ).session.client.end();
}

// The seed is also imported by its test, so it only runs as a script.
const entryPoint = process.argv[1];
const runsAsScript =
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href;

if (runsAsScript) {
  main().catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });
}
