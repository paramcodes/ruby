"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createPageAction } from "@/app/actions/pages";
import type { PageSummary } from "@/server/pages/types";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { requestAppNavigation } from "../navigation-guard";
import { FavoritesList } from "./favorites-list";
import { PageActions, describePageActionError } from "./page-actions";
import { PageTree } from "./page-tree";
import { RecentPagesList } from "./recent-pages-list";
import styles from "./sidebar.module.css";

export type SidebarProps = {
  favorites?: readonly PageSummary[];
  /** Active and archived pages. Archived pages render in a separate section. */
  pages: readonly PageSummary[];
  recentPages?: readonly PageSummary[];
};

export function Sidebar({
  favorites = [],
  pages,
  recentPages = []
}: SidebarProps) {
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

      <div className={styles.sections}>
        <SearchPlaceholder />
        <FavoritesList favorites={[...favorites]} />
        <RecentPagesList recentPages={[...recentPages]} />
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

function SearchPlaceholder() {
  return (
    <section className={styles.placeholder}>
      <h2 className={styles.placeholderTitle}>
        Search
        <span className={styles.badge}>Coming soon</span>
      </h2>
      <p className={styles.placeholderText}>
        Full-text search is coming to this workspace.
      </p>
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
