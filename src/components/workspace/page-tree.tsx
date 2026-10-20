"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { type PageId } from "@/server/ids";
import type { PageSummary } from "@/server/pages/types";

import styles from "./page-tree.module.css";

export type PageTreeProps = {
  /** Active and archived pages. Archived pages render in a separate section. */
  pages: readonly PageSummary[];
  activePageId?: string | null;
  renderPageActions?: (page: PageSummary) => React.ReactNode;
};

export function PageTree({
  activePageId = null,
  pages,
  renderPageActions
}: PageTreeProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<PageId>>(new Set());
  const archiveHeadingId = useId();

  const activePages = pages.filter((page) => page.archivedAt === null);
  const archivedPages = pages
    .filter((page) => page.archivedAt !== null)
    .sort((left, right) => left.title.localeCompare(right.title));

  const childrenByParent = new Map<PageId | null, PageSummary[]>();

  for (const page of activePages) {
    const siblings = childrenByParent.get(page.parentId) ?? [];
    siblings.push(page);
    childrenByParent.set(page.parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort(comparePages);
  }

  function toggle(pageId: PageId) {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }

      return next;
    });
  }

  function renderItems(parentId: PageId | null): React.ReactNode {
    const siblings = childrenByParent.get(parentId) ?? [];

    if (siblings.length === 0) {
      return null;
    }

    return (
      <ul
        className={
          parentId === null ? styles.list : `${styles.list} ${styles.nested}`
        }
      >
        {siblings.map((page) => {
          const children = childrenByParent.get(page.id) ?? [];
          const hasChildren = children.length > 0;
          const isExpanded = !collapsed.has(page.id);

          return (
            <li className={styles.item} key={page.id}>
              <div className={styles.row}>
                {hasChildren ? (
                  <button
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${
                      page.title
                    }`}
                    className={styles.toggle}
                    onClick={() => toggle(page.id)}
                    type="button"
                  >
                    <span aria-hidden="true">
                      {isExpanded ? "\u25be" : "\u25b8"}
                    </span>
                  </button>
                ) : (
                  <span aria-hidden="true" className={styles.toggleSpacer} />
                )}
                <Link
                  aria-current={activePageId === page.id ? "page" : undefined}
                  className={styles.link}
                  href={`/pages/${page.id}`}
                >
                  {page.title}
                </Link>
                {renderPageActions ? (
                  <div className={styles.actions}>
                    {renderPageActions(page)}
                  </div>
                ) : null}
              </div>
              {hasChildren && isExpanded ? renderItems(page.id) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={styles.tree}>
      <nav aria-label="Pages">{renderItems(null)}</nav>
      {archivedPages.length > 0 ? (
        <section aria-labelledby={archiveHeadingId} className={styles.archive}>
          <h2 className={styles.archiveHeading} id={archiveHeadingId}>
            Archived
          </h2>
          <ul className={styles.archiveList}>
            {archivedPages.map((page) => (
              <li className={styles.archiveItem} key={page.id}>
                <Link
                  aria-current={activePageId === page.id ? "page" : undefined}
                  className={styles.link}
                  href={`/pages/${page.id}`}
                >
                  {page.title}
                </Link>
                {renderPageActions ? (
                  <div className={styles.actions}>
                    {renderPageActions(page)}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function comparePages(left: PageSummary, right: PageSummary): number {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.title.localeCompare(right.title);
}
