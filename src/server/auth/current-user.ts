import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/server/auth/auth";
import type { UserId } from "@/server/auth/types";

// `cache()` deduplicates the session lookup within a single request, so a layout
// and its page resolve the session once instead of querying the database twice.
export const getCurrentUser = cache(
  async (): Promise<{ id: UserId } | null> => {
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user?.id) {
      return null;
    }
    return { id: session.user.id };
  }
);
