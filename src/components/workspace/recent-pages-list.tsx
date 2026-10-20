"use client";

import Link from "next/link";

import type { PageSummary } from "@/server/pages/types";

import styles from "./recent-pages-list.module.css";

export type RecentPagesListProps = {
  recentPages: readonly PageSummary[];
};

export function RecentPagesList({ recentPages }: RecentPagesListProps) {
  if (recentPages.length === 0) {
    return (
      <section aria-label="Recent" className={styles.empty}>
        <p className={styles.hint}>No recent pages.</p>
        <p className={styles.tip}>
          Pages you open appear here, most recent first.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Recent" className={styles.list}>
      <h2 className={styles.heading}>Recent</h2>
      <ul className={styles.items}>
        {recentPages.map((page) => (
          <li className={styles.item} key={page.id}>
            <Link className={styles.link} href={`/pages/${page.id}`}>
              {page.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
