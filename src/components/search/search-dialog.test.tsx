import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { searchAction } = vi.hoisted(() => ({
  searchAction: vi.fn()
}));

vi.mock("@/app/actions/search", () => ({
  searchAction
}));

import { SearchDialog } from "./search-dialog";

afterEach(cleanup);

beforeEach(() => {
  searchAction.mockReset();
});

async function openDialogWith(query: string) {
  const user = userEvent.setup();
  render(<SearchDialog />);

  // The trigger renders an icon-only label, so it is found by role.
  await user.click(screen.getByRole("button"));

  const dialog = await screen.findByRole("dialog", { name: "Search pages" });
  await user.type(
    screen.getByRole("searchbox", { name: "Search pages" }),
    query
  );

  return dialog;
}

describe("SearchDialog failures", () => {
  it("shows an error and stops searching when the request is rejected", async () => {
    searchAction.mockRejectedValue(new Error("network down"));

    await openDialogWith("notes");

    expect(
      await screen.findByText("Search failed. Please try again.", undefined, {
        timeout: 3000
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("Searching…")).not.toBeInTheDocument();
    expect(screen.queryByText("No pages found.")).not.toBeInTheDocument();
  });

  it("shows a session-expired message when the session is gone", async () => {
    searchAction.mockResolvedValue({ ok: false, error: "unauthenticated" });

    await openDialogWith("notes");

    expect(
      await screen.findByText(
        "Your session has expired. Sign in again to search.",
        undefined,
        { timeout: 3000 }
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("No pages found.")).not.toBeInTheDocument();
  });

  it("keeps the results of a successful search", async () => {
    searchAction.mockResolvedValue({
      ok: true,
      results: [
        {
          id: "page-1",
          parentId: null,
          title: "Notes",
          favorited: false
        }
      ]
    });

    await openDialogWith("notes");

    await waitFor(
      () =>
        expect(screen.getByRole("link", { name: /Notes/ })).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
