"use server";

import { parseEditorDocument } from "@/components/editor/editor-adapter";
import { getCurrentUser } from "@/server/auth/current-user";
import { toPageId } from "@/server/ids";
import { savePageContent } from "@/server/pages/content-commands";

export type SavePageContentActionResult =
  | { status: "saved"; revision: number; updatedAt: string }
  | { status: "conflict"; currentRevision: number }
  | {
      status: "invalid" | "failed" | "unauthenticated";
      message: string;
    };

export async function savePageContentAction(
  pageId: string,
  document: unknown,
  expectedRevision: number
): Promise<SavePageContentActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      status: "unauthenticated",
      message: "Sign in again to save this page."
    };
  }

  const parsedId = toPageId(pageId);

  if (!parsedId) {
    return { status: "invalid", message: "Page not found." };
  }

  const parsedDocument = parseEditorDocument(document);

  if (!parsedDocument.ok) {
    return {
      status: "invalid",
      message:
        parsedDocument.reason === "unsupported-version"
          ? "This editor version is not supported."
          : "The page content is malformed."
    };
  }

  return savePageContent(
    user.id,
    parsedId,
    parsedDocument.value,
    expectedRevision
  );
}
