"use client";

import { useCallback, useEffect, useState } from "react";

import type { PageSummary } from "@/server/pages/types";

import { Sidebar } from "./sidebar";
import { ExpandSidebarIcon } from "./icons";
import styles from "./workspace-shell.module.css";

const SIDEBAR_COOKIE = "wiki-sidebar";

// Persists the collapsed state in a cookie, not localStorage: the cookie is
// readable on the server, so the first render after a reload already has the
// stored width and no layout flash collapses and reopens the rail.
function persistSidebar(state: "open" | "closed") {
  document.cookie = `${SIDEBAR_COOKIE}=${state}; path=/; max-age=31536000; samesite=lax`;
}

export type WorkspaceShellProps = {
  favorites: readonly PageSummary[];
  /** Server snapshot of the persisted preference. */
  initialCollapsed: boolean;
  pages: readonly PageSummary[];
  recentPages: readonly PageSummary[];
  children: React.ReactNode;
};

export function WorkspaceShell({
  favorites,
  initialCollapsed,
  pages,
  recentPages,
  children
}: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      persistSidebar(next ? "closed" : "open");
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Notion's binding: Cmd/Ctrl+\ toggles the sidebar.
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <div className={styles.shell} data-collapsed={collapsed ? "" : undefined}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      {collapsed ? (
        <button
          aria-controls="workspace-sidebar"
          aria-expanded={false}
          aria-label="Expand sidebar"
          className={styles.expandFab}
          onClick={toggle}
          title="Open sidebar (⌘\)"
          type="button"
        >
          <ExpandSidebarIcon />
        </button>
      ) : null}
      <aside
        aria-label="Workspace navigation"
        className={styles.sidebarRail}
        id="workspace-sidebar"
        inert={collapsed || undefined}
      >
        <Sidebar
          favorites={favorites}
          onCollapse={toggle}
          pages={pages}
          recentPages={recentPages}
        />
      </aside>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
