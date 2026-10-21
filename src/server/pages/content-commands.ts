import "server-only";

import { and, eq } from "drizzle-orm";

import {
  extractSearchableText,
  parseEditorDocument,
  type EditorDocument
} from "@/components/editor/editor-adapter";
import type { UserId } from "@/server/auth/types";
import { db } from "@/server/db/client";
import { toPageId, type PageId } from "@/server/ids";
import { workspace } from "@/server/workspaces/schema";

import { pageContent } from "./content-schema";
import { page } from "./schema";

export type SaveContentResult =
  | { status: "saved"; revision: number; updatedAt: string }
  | { status: "conflict"; currentRevision: number }
  | { status: "invalid" | "failed"; message: string };

export type GetPageContentResult =
  | {
      status: "ok";
      document: EditorDocument;
      revision: number;
      updatedAt: string | null;
    }
  | {
      status: "not-found" | "invalid" | "unsupported-version" | "failed";
      message: string;
    };

// A page that has never been saved is served as revision 0. The first save
// therefore writes revision 1 from a non-existent row, and two tabs that both
// hold revision 0 cannot both replace it: the loser sees a conflict.
const emptyDocument: EditorDocument = { schemaVersion: 1, content: [] };
const noRevision = 0;
const initialRevision = 1;

const notFoundMessage = "Page not found.";
const failedMessage = "Could not save page content.";

export async function savePageContent(
  userId: UserId,
  pageId: PageId,
  document: EditorDocument,
  expectedRevision: number
): Promise<SaveContentResult> {
  const parsedId = toPageId(pageId);

  if (!parsedId) {
    return notFound();
  }

  const parsed = parseEditorDocument(document);

  if (!parsed.ok) {
    return {
      status: "invalid",
      message:
        parsed.reason === "unsupported-version"
          ? "The document uses an unsupported schema version."
          : "The document is malformed."
    };
  }

  if (!Number.isInteger(expectedRevision) || expectedRevision < noRevision) {
    return {
      status: "invalid",
      message: "The expected revision must be a non-negative integer."
    };
  }

  const searchText = extractSearchableText(parsed.value);

  try {
    return await db.transaction(
      async (tx) => {
        // The workspace join is the ownership check. A page that does not exist
        // and a page owned by someone else produce the same empty result, so the
        // caller cannot tell the two apart.
        const rows = await tx
          .select({
            workspaceId: page.workspaceId,
            revision: pageContent.revision,
            archivedAt: page.archivedAt
          })
          .from(page)
          .innerJoin(workspace, eq(page.workspaceId, workspace.id))
          .leftJoin(pageContent, eq(pageContent.pageId, page.id))
          .where(and(eq(workspace.userId, userId), eq(page.id, parsedId)))
          .limit(1);

        const row = rows[0];

        if (!row) {
          return notFound();
        }

        if (row.archivedAt !== null) {
          return {
            status: "invalid",
            message: "Archived pages cannot be edited."
          };
        }

        const currentRevision = row.revision ?? noRevision;

        if (currentRevision !== expectedRevision) {
          return { status: "conflict" as const, currentRevision };
        }

        if (row.revision === null) {
          // `onConflictDoNothing` resolves the race between two tabs both
          // inserting the first revision: the loser reports a conflict instead of
          // overwriting the winner's document.
          const inserted = await tx
            .insert(pageContent)
            .values({
              pageId: parsedId,
              workspaceId: row.workspaceId,
              document: parsed.value,
              revision: initialRevision,
              searchText
            })
            .onConflictDoNothing()
            .returning({
              revision: pageContent.revision,
              updatedAt: pageContent.updatedAt
            });

          const created = inserted[0];

          if (!created) {
            return {
              status: "conflict" as const,
              currentRevision: await readRevision(tx, parsedId)
            };
          }

          return saved(created.revision, created.updatedAt);
        }

        // The revision predicate is the concurrency check: a writer that read a
        // stale revision updates no rows and receives a conflict below.
        const updated = await tx
          .update(pageContent)
          .set({
            document: parsed.value,
            searchText,
            revision: currentRevision + 1
          })
          .where(
            and(
              eq(pageContent.pageId, parsedId),
              eq(pageContent.revision, expectedRevision)
            )
          )
          .returning({
            revision: pageContent.revision,
            updatedAt: pageContent.updatedAt
          });

        const updatedRow = updated[0];

        if (!updatedRow) {
          return {
            status: "conflict" as const,
            currentRevision: await readRevision(tx, parsedId)
          };
        }

        return saved(updatedRow.revision, updatedRow.updatedAt);
      },
      // The conflict path reads the row a concurrent save committed after this
      // transaction started. Read committed makes that read see the new revision,
      // so the caller receives the right currentRevision instead of a stale one.
      { isolationLevel: "read committed" }
    );
  } catch {
    return { status: "failed", message: failedMessage };
  }
}

export async function getPageContent(
  userId: UserId,
  pageId: PageId
): Promise<GetPageContentResult> {
  const parsedId = toPageId(pageId);

  if (!parsedId) {
    return { status: "not-found", message: notFoundMessage };
  }

  try {
    const rows = await db
      .select({
        document: pageContent.document,
        revision: pageContent.revision,
        updatedAt: pageContent.updatedAt
      })
      .from(page)
      .innerJoin(workspace, eq(page.workspaceId, workspace.id))
      .leftJoin(pageContent, eq(pageContent.pageId, page.id))
      .where(and(eq(workspace.userId, userId), eq(page.id, parsedId)))
      .limit(1);

    const row = rows[0];

    if (!row) {
      return { status: "not-found", message: notFoundMessage };
    }

    if (row.revision === null || row.updatedAt === null) {
      return {
        status: "ok",
        document: emptyDocument,
        revision: noRevision,
        updatedAt: null
      };
    }

    const parsed = parseEditorDocument(row.document);

    if (!parsed.ok) {
      return parsed.reason === "unsupported-version"
        ? {
            status: "unsupported-version",
            message: "The stored document uses an unsupported schema version."
          }
        : { status: "invalid", message: "The stored document is malformed." };
    }

    return {
      status: "ok",
      document: parsed.value,
      revision: row.revision,
      updatedAt: row.updatedAt.toISOString()
    };
  } catch {
    return { status: "failed", message: "Could not read page content." };
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function readRevision(tx: Transaction, pageId: PageId): Promise<number> {
  const rows = await tx
    .select({ revision: pageContent.revision })
    .from(pageContent)
    .where(eq(pageContent.pageId, pageId))
    .limit(1);

  return rows[0]?.revision ?? noRevision;
}

function saved(revision: number, updatedAt: Date): SaveContentResult {
  return { status: "saved", revision, updatedAt: updatedAt.toISOString() };
}

function notFound(): SaveContentResult {
  // `SaveContentResult` has no separate not-found member, so a missing page and
  // another user's page share this invalid outcome. The message is identical in
  // both cases.
  return { status: "invalid", message: notFoundMessage };
}
