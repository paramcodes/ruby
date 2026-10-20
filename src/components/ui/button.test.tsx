import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

afterEach(cleanup);

const buttonCss = readFileSync(
  path.join(process.cwd(), "src/components/ui/button.module.css"),
  "utf8"
);

describe("Button", () => {
  it("exposes its visible text as the accessible name", () => {
    render(<Button>Create page</Button>);

    expect(
      screen.getByRole("button", { name: "Create page" })
    ).toBeInTheDocument();
  });

  it("defaults to type button so it never submits a surrounding form", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button"
    );
  });

  it("keeps an explicit submit type when the caller asks for it", () => {
    render(<Button type="submit">Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "submit"
    );
  });

  it("activates with the keyboard and with a pointer", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish</Button>);

    const button = screen.getByRole("button", { name: "Publish" });
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("does not activate while disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Publish
      </Button>
    );

    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("is reachable by Tab and paints the focus ring token", async () => {
    const user = userEvent.setup();
    render(<Button>Focus me</Button>);

    await user.tab();

    expect(screen.getByRole("button", { name: "Focus me" })).toHaveFocus();
    expect(buttonCss).toContain(":focus-visible");
    expect(buttonCss).toContain(
      "outline: var(--focus-ring-width) solid var(--focus-ring-color)"
    );
    expect(buttonCss).toContain("outline-offset: var(--focus-ring-offset)");
  });

  it("renders its child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/pages/example">Open page</a>
      </Button>
    );

    expect(screen.getByRole("link", { name: "Open page" })).toHaveAttribute(
      "href",
      "/pages/example"
    );
  });
});
