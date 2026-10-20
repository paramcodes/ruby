"use server";

import { getCurrentUser } from "@/server/auth/current-user";
import { toPageId } from "@/server/ids";
import { addFavorite, removeFavorite } from "@/server/pages/favorites";

export type FavoriteActionResult =
  { ok: true } | { ok: false; error: "unauthenticated" | "not-found" };

export async function favoritePageAction(
  pageId: string
): Promise<FavoriteActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const parsedId = toPageId(pageId);

  if (!parsedId) {
    return { ok: false, error: "not-found" };
  }

  await addFavorite(user.id, parsedId);
  return { ok: true };
}

export async function unfavoritePageAction(
  pageId: string
): Promise<FavoriteActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const parsedId = toPageId(pageId);

  if (!parsedId) {
    return { ok: false, error: "not-found" };
  }

  await removeFavorite(user.id, parsedId);
  return { ok: true };
}
