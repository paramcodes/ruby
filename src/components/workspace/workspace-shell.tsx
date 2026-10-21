"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import type { PageSummary } from "@/server/pages/types";

import { Sidebar } from "./sidebar";
import { ExpandSidebarIcon, MenuIcon } from "./icons";
import styles from "./workspace-shell.module.css";

const SIDEBAR_COOKIE = "wiki-sidebar";
const NARROW_QUERY = "(max-width: 48rem)";

// Persists the collapsed state in a cookie, not localStorage: the cookie is
// readable on the server, so the first render after a reload already has the
// stored width and no layout flash collapses and reopens the rail.
function persistSidebar(state: "open" | "closed") {
  document.cookie = `${SIDEBAR_COOKIE}=${state}; path=/; max-age=31536000; samesite=lax`;
}

// Narrow screens turn the rail into an overlay drawer, so the shell needs to
// know the viewport. The subscription keeps this out of an effect, and the
// server snapshot keeps the first render stable.
function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getNarrow() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function getNarrowServer() {
  return false;
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
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNarrow = useSyncExternalStore(
    subscribeNarrow,
    getNarrow,
    getNarrowServer
  );

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      persistSidebar(next ? "closed" : "open");
      return next;
    });
  }, []);

  // Navigating away closes the drawer, the way a mobile menu behaves. The
  // reset happens during render (React's documented pattern for state that
  // depends on a changing input) rather than in an effect.
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }

      // Notion's binding: Cmd/Ctrl+\ toggles the sidebar.
      if ((event.metaKey || event.ctrlKey) && event.key === "\\") {
        event.preventDefault();
        toggle();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  // The rail is out of the way on narrow screens until the drawer opens, so
  // it must not hold focus while it is closed.
  const railHidden = collapsed || (isNarrow && !drawerOpen);

  return (
    <div
      className={styles.shell}
      data-collapsed={collapsed ? "" : undefined}
      data-drawer={drawerOpen ? "open" : undefined}
    >
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
      {drawerOpen ? (
        <button
          aria-label="Close navigation"
          className={styles.scrim}
          onClick={() => setDrawerOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        aria-label="Workspace navigation"
        className={styles.sidebarRail}
        id="workspace-sidebar"
        inert={railHidden || undefined}
      >
        <Sidebar
          favorites={favorites}
          onCollapse={toggle}
          pages={pages}
          recentPages={recentPages}
        />
      </aside>
      <div className={styles.mobileBar}>
        <button
          aria-controls="workspace-sidebar"
          aria-expanded={drawerOpen}
          aria-label="Open navigation"
          className={styles.mobileMenuButton}
          onClick={() => setDrawerOpen((open) => !open)}
          type="button"
        >
          <MenuIcon />
        </button>
      </div>
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
