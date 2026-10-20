import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

export default async function ProtectedLayout({
  children
}: Readonly<React.PropsWithChildren>) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  await ensurePrivateWorkspace(user.id);

  return children;
}
