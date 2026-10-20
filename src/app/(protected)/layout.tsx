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

  // The workspace must exist before any protected page renders. Not wrapped in
  // cache(): every request verifies it, and a database failure must fail closed.
  try {
    await ensurePrivateWorkspace(user.id);
  } catch (error) {
    console.error("Failed to ensure private workspace for protected layout", {
      operation: "ensurePrivateWorkspace",
      userId: user.id,
      error
    });
    throw error;
  }

  return children;
}
