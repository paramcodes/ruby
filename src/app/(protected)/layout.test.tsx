import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, ensurePrivateWorkspace } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  ensurePrivateWorkspace: vi.fn()
}));

vi.mock("@/server/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/server/workspaces/queries", () => ({ ensurePrivateWorkspace }));

import ProtectedLayout from "./layout";

describe("protected layout", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    ensurePrivateWorkspace.mockReset();
  });

  it("ensures the private workspace once for the current user", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-123" });
    ensurePrivateWorkspace.mockResolvedValue("workspace-123");

    render(await ProtectedLayout({ children: <p>protected content</p> }));

    expect(ensurePrivateWorkspace).toHaveBeenCalledTimes(1);
    expect(ensurePrivateWorkspace).toHaveBeenCalledWith("user-123");
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("fails closed when the workspace cannot be ensured", async () => {
    const failure = new Error("database unavailable");
    getCurrentUser.mockResolvedValue({ id: "user-123" });
    ensurePrivateWorkspace.mockRejectedValue(failure);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      ProtectedLayout({ children: <p>protected content</p> })
    ).rejects.toBe(failure);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to ensure private workspace for protected layout",
      expect.objectContaining({
        operation: "ensurePrivateWorkspace",
        userId: "user-123"
      })
    );

    consoleError.mockRestore();
  });
});
