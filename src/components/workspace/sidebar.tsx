"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createPageAction } from "@/app/actions/pages";
import type { PageSummary } from "@/server/pages/types";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { requestAppNavigation } from "../navigation-guard";
import { PageActions, describePageActionError } from "./page-actions";
import { PageTree } from "./page-tree";
import styles from "./sidebar.module.css";

export type SidebarProps = {
  pages: readonly PageSummary[];
};

export function Sidebar({ pages }: SidebarProps) {
  const pathname = usePathname();
  const activePageId = pageIdFromPathname(pathname);
  const activePages = pages.filter((page) => page.archivedAt === null);

  return (
    <aside aria-label="Workspace navigation" className={styles.sidebar}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          Individual Wiki
        </Link>
        <p className={styles.workspace}>Private workspace</p>
      </header>

      <CreatePageForm />

      <PageTree
        activePageId={activePageId}
        pages={pages}
        renderPageActions={(page) => (
          <PageActions page={page} pages={activePages} />
        )}
      />

      <div className={styles.placeholders}>
        <Placeholder
          description="Pinned pages will sit at the top of the sidebar."
          title="Favorites"
        />
        <Placeholder
          description="Pages you visited lately will appear here."
          title="Recent"
        />
        <Placeholder
          description="Full-text search is planned for this workspace."
          title="Search"
        />
      </div>
    </aside>
  );
}

export type CreatePageFormProps = {
  fieldLabel?: string;
  parentId?: string | null;
  submitLabel?: string;
};

export function CreatePageForm({
  fieldLabel = "New page title",
  parentId = null,
  submitLabel = "Create page"
}: CreatePageFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await createPageAction({ title, parentId });
    setPending(false);

    if (!result.ok) {
      setError(describePageActionError(result.error));
      return;
    }

    setTitle("");

    if (!requestAppNavigation(`/pages/${result.page.id}`)) {
      return;
    }

    router.push(`/pages/${result.page.id}`);
    router.refresh();
  }

  return (
    <form className={styles.createForm} onSubmit={submit}>
      <Input
        label={fieldLabel}
        onChange={(event) => setTitle(event.target.value)}
        required
        value={title}
        {...(error ? { error } : {})}
      />
      <Button disabled={pending} size="sm" type="submit">
        {pending ? "Creating..." : submitLabel}
      </Button>
    </form>
  );
}

function Placeholder({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <section className={styles.placeholder}>
      <h2 className={styles.placeholderTitle}>
        {title}
        <span className={styles.badge}>Coming soon</span>
      </h2>
      <p className={styles.placeholderText}>{description}</p>
    </section>
  );
}

function pageIdFromPathname(pathname: string): string | null {
  const prefix = "/pages/";

  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const [pageId] = pathname.slice(prefix.length).split("/");
  return pageId ?? null;
}
