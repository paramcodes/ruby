import { redirect } from "next/navigation";

import { getCurrentUser } from "@/server/auth/current-user";
import { ensurePrivateWorkspace } from "@/server/workspaces/queries";

/**
 * The single session guard for protected route groups.
 *
 * It redirects visitors without a session and makes sure the user's private
 * workspace exists before any page renders. The workspace check is deliberately
 * not cached: every request verifies it, and a database failure must fail
 * closed.
 */
export async function RequireSession({
  children
}: Readonly<React.PropsWithChildren>): Promise<React.ReactNode> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

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
