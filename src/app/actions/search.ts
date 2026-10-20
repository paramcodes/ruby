"use server";

import { getCurrentUser } from "@/server/auth/current-user";
import { searchPages } from "@/server/search/queries";
import type { SearchResult } from "@/server/search/queries";
import { validateSearchQuery } from "@/server/search/validation";

// Re-exported for client components that consume the search action result.
export type { SearchResult };

export type SearchActionError = "unauthenticated" | "empty" | "too-long";

export type SearchActionResult =
  | { ok: true; results: SearchResult[] }
  | { ok: false; error: SearchActionError };

// Server action entry point for the search dialog. Validates the query,
// scopes it to the current user, and returns results with their favorited
// state so the UI can render a star toggle without an extra fetch.
export async function searchAction(query: string): Promise<SearchActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const validated = validateSearchQuery(query);

  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const results = await searchPages(user.id, validated.value);

  return { ok: true, results };
}
