"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  favoritePageAction,
  unfavoritePageAction,
  type FavoriteActionResult
} from "@/app/actions/favorites";

import { Button } from "../ui/button";

export type FavoriteToggleProps = {
  initial: boolean;
  pageId: string;
};

// A star-toggle that calls the server action and then refreshes the workspace
// shell so the favorites list in the sidebar stays in sync.
export function FavoriteToggle({ initial, pageId }: FavoriteToggleProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initial);
  const [pending, setPending] = useState(false);

  async function toggle(): Promise<void> {
    const action = favorited ? unfavoritePageAction : favoritePageAction;
    setPending(true);

    const result: FavoriteActionResult = await action(pageId);
    setPending(false);

    if (result.ok) {
      setFavorited(!favorited);
      router.refresh();
    }
  }

  return (
    <Button
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={favorited}
      disabled={pending}
      onClick={() => void toggle()}
      size="sm"
      variant={favorited ? "primary" : "ghost"}
    >
      {favorited ? "★" : "☆"}
    </Button>
  );
}
