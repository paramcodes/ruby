import { redirect } from "next/navigation";

import { RequireSession } from "@/components/workspace/require-session";
import { Sidebar } from "@/components/workspace/sidebar";
import { getCurrentUser } from "@/server/auth/current-user";
import {
  listArchivedPagesForUser,
  listPagesForUser
} from "@/server/pages/queries";

import styles from "./layout.module.css";

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

  const [activePages, archivedPages] = await Promise.all([
    listPagesForUser(user.id),
    listArchivedPagesForUser(user.id)
  ]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <Sidebar pages={[...activePages, ...archivedPages]} />
      <main className={styles.main} id="main-content">
        {children}
      </main>
    </div>
  );
}
