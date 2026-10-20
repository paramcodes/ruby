// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
const requestHeaders = new Headers({
  cookie: "better-auth.session_token=test-session"
});

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession
    }
  }
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => requestHeaders)
}));

import { getCurrentUser } from "@/server/auth/current-user";

describe("getCurrentUser", () => {
  beforeEach(() => {
    getSession.mockReset();
  });

  it("returns null when there is no session", async () => {
    getSession.mockResolvedValue(null);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(getSession).toHaveBeenCalledWith({ headers: requestHeaders });
  });

  it("returns the current user when a session exists", async () => {
    getSession.mockResolvedValue({ user: { id: "user-123" } });

    const user = await getCurrentUser();

    expect(user).toEqual({ id: "user-123" });
    expect(getSession).toHaveBeenCalledWith({ headers: requestHeaders });
  });
});
