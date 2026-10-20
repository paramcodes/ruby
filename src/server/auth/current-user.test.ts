// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => null)
    }
  }
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers())
}));

import { getCurrentUser } from "@/server/auth/current-user";

describe("getCurrentUser", () => {
  it("returns null when there is no session", async () => {
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});