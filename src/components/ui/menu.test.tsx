import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { Menu, MenuItem } from "./menu";

afterEach(cleanup);

function renderMenu(onRename = vi.fn(), onArchive = vi.fn()) {
  render(
    <Menu trigger={<Button>Page actions</Button>} label="Page actions">
      <MenuItem onSelect={onRename}>Rename</MenuItem>
      <MenuItem onSelect={onArchive}>Archive</MenuItem>
    </Menu>
  );
}

describe("Menu", () => {
  it("opens a named menu with menuitem children", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Page actions" }));

    expect(
      await screen.findByRole("menu", { name: "Page actions" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });

  it("opens from the keyboard and focuses the first item", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Page actions" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const items = await screen.findAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
  });

  it("moves between items with the arrow keys", async () => {
    const user = userEvent.setup();
    renderMenu();

    screen.getByRole("button", { name: "Page actions" }).focus();
    await user.keyboard("{ArrowDown}");
    const items = await screen.findAllByRole("menuitem");

    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(items[0]).toHaveFocus();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole("button", { name: "Page actions" });
    await user.click(trigger);
    await screen.findByRole("menu", { name: "Page actions" });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });

  it("activates an item with Enter", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderMenu(onRename);

    screen.getByRole("button", { name: "Page actions" }).focus();
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onRename).toHaveBeenCalledTimes(1);
  });

  it("activates an item with a pointer click", async () => {
    const user = userEvent.setup();
    const onArchive = vi.fn();
    renderMenu(vi.fn(), onArchive);

    await user.click(screen.getByRole("button", { name: "Page actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Archive" }));

    expect(onArchive).toHaveBeenCalledTimes(1);
  });
});
