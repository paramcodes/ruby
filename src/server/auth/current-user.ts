import { headers } from "next/headers";

import { auth } from "@/server/auth/auth";
import type { UserId } from "@/server/auth/types";

export async function getCurrentUser(): Promise<{ id: UserId } | null> {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) {
    return null;
  }
  return { id: session.user.id };
}
