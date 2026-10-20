import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toPageId } from "@/server/ids";
import type { PageSummary } from "@/server/pages/types";

const {
  archivePageAction,
  movePageAction,
  renamePageAction,
  restorePageAction,
  refresh
} = vi.hoisted(() => ({
  archivePageAction: vi.fn(),
  movePageAction: vi.fn(),
  renamePageAction: vi.fn(),
  restorePageAction: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("@/app/actions/pages", () => ({
  archivePageAction,
  movePageAction,
  renamePageAction,
  restorePageAction
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh })
}));

import { PageActions } from "./page-actions";

afterEach(cleanup);

beforeEach(() => {
  archivePageAction.mockReset();
  movePageAction.mockReset();
  renamePageAction.mockReset();
  restorePageAction.mockReset();
  refresh.mockReset();
});

function summary(options: { archived?: boolean } = {}): PageSummary {
  const id = toPageId("notes");

  if (!id) {
    throw new Error("Invalid test page id");
  }

  return {
    id,
    parentId: null,
    title: "Notes",
    sortOrder: 0,
    archivedAt: options.archived ? new Date("2026-10-20T12:00:00Z") : null
  };
}

function actionResult(page: PageSummary) {
  return {
    ok: true as const,
    page: {
      id: page.id,
      parentId: page.parentId,
      title: page.title,
      sortOrder: page.sortOrder,
      archivedAt: page.archivedAt ? page.archivedAt.toISOString() : null
    }
  };
}

describe("PageActions announcements", () => {
  it("announces that a page was archived", async () => {
    const user = userEvent.setup();
    const page = summary();
    archivePageAction.mockResolvedValue(actionResult(page));
    render(<PageActions page={page} pages={[page]} />);

    await user.click(screen.getByRole("button", { name: "Actions for Notes" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      'Page "Notes" archived.'
    );
  });

  it("announces that a page was restored", async () => {
    const user = userEvent.setup();
    const page = summary({ archived: true });
    restorePageAction.mockResolvedValue(actionResult(page));
    render(<PageActions page={page} pages={[page]} />);

    await user.click(screen.getByRole("button", { name: "Actions for Notes" }));
    await user.click(screen.getByRole("menuitem", { name: "Restore" }));

    expect(screen.getByRole("status")).toHaveTextContent(
      'Page "Notes" restored.'
    );
  });
});
