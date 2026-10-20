import { redirect } from "next/navigation";

import { CreatePageForm } from "@/components/workspace/sidebar";
import { PageTree } from "@/components/workspace/page-tree";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  listArchivedPagesForUser,
  listPagesForUser
} from "@/server/pages/queries";

import styles from "./page.module.css";

export default async function WorkspaceHomePage() {
  // Request-cached: shares the layout's session lookup.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [activePages, archivedPages] = await Promise.all([
    listPagesForUser(user.id),
    listArchivedPagesForUser(user.id)
  ]);

  const pages = [...activePages, ...archivedPages];

  return (
    <div className={styles.home}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Private workspace</p>
        <h1 className={styles.title}>Your workspace</h1>
        <p className={styles.lead}>
          Collect notes in pages, nest them into a shape that matches your
          thinking, and return to them later.
        </p>
      </header>

      {activePages.length === 0 ? (
        <section
          aria-labelledby="empty-workspace-heading"
          className={styles.empty}
        >
          <h2 className={styles.sectionTitle} id="empty-workspace-heading">
            Start with one page
          </h2>
          <p className={styles.prose}>
            Give the page a short title. You can rename it, move it, or archive
            it at any time.
          </p>
          <CreatePageForm submitLabel="Create your first page" />
        </section>
      ) : (
        <section aria-labelledby="all-pages-heading" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle} id="all-pages-heading">
              All pages
            </h2>
            <p className={styles.count}>
              {activePages.length === 1
                ? "1 active page"
                : `${activePages.length} active pages`}
            </p>
          </div>
          <PageTree pages={pages} />
        </section>
      )}
    </div>
  );
}
