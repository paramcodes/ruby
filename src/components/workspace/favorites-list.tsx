"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { unfavoritePageAction } from "@/app/actions/favorites";
import type { PageSummary } from "@/server/pages/types";

import { Button } from "../ui/button";
import styles from "./favorites-list.module.css";

export type FavoritesListProps = {
  favorites: readonly PageSummary[];
};

export function FavoritesList({ favorites }: FavoritesListProps) {
  const router = useRouter();
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  async function unfavorite(pageId: string): Promise<void> {
    setRemoving((current) => {
      const next = new Set(current);
      next.add(pageId);
      return next;
    });

    await unfavoritePageAction(pageId);
    router.refresh();
  }

  if (favorites.length === 0) {
    return (
      <section aria-label="Favorites" className={styles.empty}>
        <p className={styles.hint}>No favorited pages yet.</p>
        <p className={styles.tip}>Star a page to pin it here.</p>
      </section>
    );
  }

  return (
    <section aria-label="Favorites" className={styles.list}>
      <h2 className={styles.heading}>Favorites</h2>
      <ul className={styles.items}>
        {favorites.map((favorite) => (
          <li className={styles.item} key={favorite.id}>
            <Link className={styles.link} href={`/pages/${favorite.id}`}>
              {favorite.title}
            </Link>
            <Button
              aria-label={`Remove ${favorite.title} from favorites`}
              disabled={removing.has(favorite.id)}
              onClick={() => void unfavorite(favorite.id)}
              size="sm"
              variant="ghost"
            >
              ✕
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
