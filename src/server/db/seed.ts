import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";

import {
  CURRENT_SCHEMA_VERSION,
  extractSearchableText,
  type EditorDocument
} from "@/components/editor/editor-adapter";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db/client";
import { user } from "@/server/db/schema";
import { toPageId } from "@/server/ids";
import {
  savePageContent,
  getPageContent
} from "@/server/pages/content-commands";
import { page } from "@/server/pages/schema";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

// Deterministic seed data for local development. Re-running `pnpm db:seed`
// is idempotent: pages are upserted and content is overwritten only when the
// stored document differs from the expected one.

const SEED_EMAIL = "wiki@example.com";
const SEED_NAME = "Wiki";
const SEED_PASSWORD = "password1234";

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
async function ensureUser(): Promise<string> {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: SEED_EMAIL,
        password: SEED_PASSWORD,
        name: SEED_NAME
      }
    });
    return result.user.id;
  } catch {
    const existing = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, SEED_EMAIL));

    const row = existing[0];
    if (!row) {
      throw new Error("Could not create or find seed user");
    }
    return row.id;
  }
}

// Upserts every seed page with a deterministic id and stable hierarchy.
// Pages are inserted in definition order so parent rows always exist before
// their children, satisfying the foreign-key constraint on (workspace, parent).
async function upsertPages(userId: string): Promise<Map<string, string>> {
  const workspaceId = await ensurePrivateWorkspace(userId);
  const ids = new Map<string, string>();

  for (const def of seedPages) {
    const id = uuidv5(userId, def.key);
    ids.set(def.key, id);

    const parentId = def.parentKey
      ? toPageId(ids.get(def.parentKey) ?? "")
      : null;

    if (def.parentKey !== null && parentId === null) {
      throw new Error(`Missing parent page: ${def.parentKey}`);
    }

    const precedingSiblings = seedPages
      .slice(0, seedPages.indexOf(def))
      .filter((p) => p.parentKey === def.parentKey).length;

    await db
      .insert(page)
      .values({
        id,
        workspaceId,
        parentId,
        title: def.title,
        sortOrder: precedingSiblings
      })
      .onConflictDoUpdate({
        target: [page.id],
        set: {
          title: def.title,
          parentId,
          sortOrder: precedingSiblings
        }
      });
  }

  return ids;
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

async function main(): Promise<void> {
  const userId = await ensureUser();
  const ids = await upsertPages(userId);
  await seedContent(userId, ids);
  console.log("Seed complete");
  // The db proxy binds function values, which strips methods like `.end()`
  // from the postgres client. Access the raw client through the session,
  // which is an internal property not surfaced by Drizzle's types.
  await (
    db as unknown as { session: { client: { end: () => Promise<void> } } }
  ).session.client.end();
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
