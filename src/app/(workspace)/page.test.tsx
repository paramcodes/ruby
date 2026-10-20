import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toPageId } from "@/server/ids";
import type { PageSummary } from "@/server/pages/types";

const {
  getCurrentUser,
  listArchivedPagesForUser,
  listPagesForUser,
  push,
  refresh
} = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listArchivedPagesForUser: vi.fn(),
  listPagesForUser: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("@/app/actions/pages", () => ({
  archivePageAction: vi.fn(),
  createPageAction: vi.fn(),
  movePageAction: vi.fn(),
  renamePageAction: vi.fn(),
  restorePageAction: vi.fn()
}));
vi.mock("@/app/actions/favorites", () => ({
  unfavoritePageAction: vi.fn()
}));
vi.mock("@/app/actions/search", () => ({
  searchAction: vi.fn()
}));
vi.mock("@/server/auth/current-user", () => ({ getCurrentUser }));
vi.mock("@/server/pages/queries", () => ({
  listArchivedPagesForUser,
  listPagesForUser
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  usePathname: () => "/",
  useRouter: () => ({ push, refresh })
}));

import { Sidebar } from "@/components/workspace/sidebar";

import WorkspaceHomePage from "./page";

afterEach(cleanup);

beforeEach(() => {
  getCurrentUser.mockReset();
  listArchivedPagesForUser.mockReset();
  listPagesForUser.mockReset();
  push.mockReset();
  refresh.mockReset();
  getCurrentUser.mockResolvedValue({ id: "user-123" });
});

function summary(id: string, title: string): PageSummary {
  const parsedId = toPageId(id);

  if (!parsedId) {
    throw new Error(`Invalid test page id: ${id}`);
  }

  return {
    id: parsedId,
    parentId: null,
    title,
    sortOrder: 0,
    archivedAt: null
  };
}

describe("workspace home page", () => {
  it("gives the sidebar tree and the body tree distinct navigation names", async () => {
    const pages = [summary("notes", "Notes")];
    listPagesForUser.mockResolvedValue(pages);
    listArchivedPagesForUser.mockResolvedValue([]);

    const home = await WorkspaceHomePage();
    render(
      <>
        <Sidebar pages={pages} />
        {home}
      </>
    );

    const names = screen
      .getAllByRole("navigation")
      .map((navigation) => navigation.getAttribute("aria-label"));

    expect(names.sort()).toEqual(["All pages", "Pages"]);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives the sidebar create field and the empty-state field distinct names", async () => {
    listPagesForUser.mockResolvedValue([]);
    listArchivedPagesForUser.mockResolvedValue([]);

    const home = await WorkspaceHomePage();
    render(
      <>
        <Sidebar pages={[]} />
        {home}
      </>
    );

    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(
      screen.getByRole("textbox", { name: "New page title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "First page title" })
    ).toBeInTheDocument();
  });
});
