import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { toPageId } from "@/server/ids";
import type { PageSummary } from "@/server/pages/types";

import { PageTree } from "./page-tree";

afterEach(cleanup);

function page(
  id: string,
  title: string,
  parentId: string | null,
  options: { sortOrder?: number; archived?: boolean } = {}
): PageSummary {
  const parsedId = toPageId(id);

  if (!parsedId) {
    throw new Error(`Invalid test page id: ${id}`);
  }

  const parsedParentId = parentId === null ? null : toPageId(parentId);

  if (parentId !== null && !parsedParentId) {
    throw new Error(`Invalid test parent id: ${parentId}`);
  }

  return {
    id: parsedId,
    parentId: parsedParentId,
    title,
    sortOrder: options.sortOrder ?? 0,
    archivedAt: options.archived ? new Date("2026-10-20T12:00:00Z") : null
  };
}

const notes = page("notes", "Notes", null, { sortOrder: 1 });
const reading = page("reading", "Reading list", "notes", {
  sortOrder: 1
});
const projects = page("projects", "Projects", null, { sortOrder: 2 });
const archived = page("archive", "Old scratchpad", null, {
  sortOrder: 3,
  archived: true
});

describe("PageTree", () => {
  it("renders top-level pages in sort order", () => {
    render(<PageTree pages={[projects, reading, notes]} />);

    const navigation = screen.getByRole("navigation", { name: "Pages" });

    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Notes", "Reading list", "Projects"]);
  });

  it("nests child pages inside their parent", () => {
    render(<PageTree pages={[reading, notes, projects]} />);

    const parentItem = screen
      .getByRole("link", { name: "Notes" })
      .closest("li");

    expect(parentItem).not.toBeNull();
    expect(
      within(parentItem as HTMLElement).getByRole("link", {
        name: "Reading list"
      })
    ).toHaveAttribute("href", "/pages/reading");
  });

  it("collapses and expands a branch from the keyboard", async () => {
    const user = userEvent.setup();
    render(<PageTree pages={[notes, reading]} />);

    const toggle = screen.getByRole("button", { name: "Collapse Notes" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    toggle.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("link", { name: "Reading list" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand Notes" })
    ).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("link", { name: "Reading list" })
    ).toBeInTheDocument();
  });

  it("marks only the current page as the current link", () => {
    render(
      <PageTree activePageId="reading" pages={[notes, reading, projects]} />
    );

    expect(screen.getByRole("link", { name: "Reading list" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Notes" })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("keeps archived pages out of the active tree", () => {
    render(<PageTree pages={[notes, reading, archived]} />);

    const navigation = screen.getByRole("navigation", { name: "Pages" });
    const archive = screen.getByRole("region", { name: "Archived" });

    expect(
      within(navigation).queryByRole("link", { name: "Old scratchpad" })
    ).toBeNull();
    expect(
      within(archive).getByRole("link", { name: "Old scratchpad" })
    ).toHaveAttribute("href", "/pages/archive");
  });

  it("renders no archive section when nothing is archived", () => {
    render(<PageTree pages={[notes, reading]} />);

    expect(screen.queryByRole("region", { name: "Archived" })).toBeNull();
  });
});
