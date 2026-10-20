import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { savePageContentAction } from "@/app/actions/page-content";
import { PageEditor } from "@/components/editor/page-editor";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/current-user";
import { toPageId } from "@/server/ids";
import { getPageContent } from "@/server/pages/content-commands";
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

  const content = await getPageContent(user.id, parsedId);

  if (content.status === "not-found") {
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
        {content.status === "ok" ? (
          <PageEditor
            initialDocument={content.document}
            initialRevision={content.revision}
            pageId={page.id}
            saveContent={savePageContentAction}
          />
        ) : (
          <div className={styles.loadError} role="alert">
            <h3 className={styles.loadErrorTitle}>
              This page could not be loaded
            </h3>
            <p className={styles.loadErrorText}>
              {content.message} Your stored content is unchanged. Try loading
              the page again, or return to the workspace.
            </p>
            <div className={styles.loadErrorActions}>
              <Button asChild size="sm" variant="secondary">
                <Link href={`/pages/${page.id}`}>Try again</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/">Back to workspace</Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
