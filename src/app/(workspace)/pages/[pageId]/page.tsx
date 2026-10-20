import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { toPageId } from "@/server/ids";
import { getPageForUser } from "@/server/pages/queries";

import styles from "./page.module.css";

type PageRouteProps = {
  params: Promise<{ pageId: string }>;
};

export default async function PageRoute({ params }: PageRouteProps) {
  // Request-cached: shares the layout's session lookup.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { pageId } = await params;
  const parsedId = toPageId(pageId);

  if (!parsedId) {
    notFound();
  }

  const page = await getPageForUser(user.id, parsedId);

  if (!page) {
    notFound();
  }

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Page</p>
        <h1 className={styles.title}>{page.title}</h1>
        {page.archivedAt ? (
          <p className={styles.archived} role="status">
            This page is archived. Restore it from the Archived section in the
            sidebar to bring it back into the active tree.
          </p>
        ) : null}
      </header>
      <section aria-labelledby="page-content-heading" className={styles.body}>
        <h2 className={styles.sectionTitle} id="page-content-heading">
          Page content
        </h2>
        <p className={styles.placeholder}>
          Writing and formatting arrive in a later task. For now this page holds
          its title and its place in the page tree.
        </p>
      </section>
    </article>
  );
}
