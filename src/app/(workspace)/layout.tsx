import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { RequireSession } from "@/components/workspace/require-session";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  listArchivedPagesForUser,
  listPagesForUser
} from "@/server/pages/queries";
import { listFavorites } from "@/server/pages/favorites";
import { listRecentPages } from "@/server/pages/recent-pages";

export default async function WorkspaceLayout({
  children
}: Readonly<React.PropsWithChildren>) {
  return RequireSession({
    children: <WorkspaceFrame>{children}</WorkspaceFrame>
  });
}

async function WorkspaceFrame({ children }: Readonly<React.PropsWithChildren>) {
  // Request-cached: this is the same session lookup the guard already made.
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [activePages, archivedPages, favorites, recentPages] =
    await Promise.all([
      listPagesForUser(user.id),
      listArchivedPagesForUser(user.id),
      listFavorites(user.id),
      listRecentPages(user.id)
    ]);

  // Sidebar preference lives in a cookie so the server renders the same
  // collapsed state the visitor last used; no post-hydration flash.
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("wiki-sidebar")?.value === "closed";

  return (
    <WorkspaceShell
      favorites={favorites}
      initialCollapsed={initialCollapsed}
      pages={[...activePages, ...archivedPages]}
      recentPages={recentPages}
    >
      {children}
    </WorkspaceShell>
  );
}
