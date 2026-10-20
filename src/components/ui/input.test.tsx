import { readFileSync } from "node:fs";
import path from "node:path";

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "./input";

afterEach(cleanup);

const inputCss = readFileSync(
  path.join(process.cwd(), "src/components/ui/input.module.css"),
  "utf8"
);

describe("Input", () => {
  it("associates the label with the generated input id", () => {
    render(<Input label="Page title" defaultValue="Notes" />);

    const input = screen.getByLabelText("Page title");
    expect(input).toHaveValue("Notes");
    expect(input.id).not.toBe("");
  });

  it("generates a distinct id for every instance", () => {
    render(
      <>
        <Input label="First title" />
        <Input label="Second title" />
      </>
    );

    expect(screen.getByLabelText("First title").id).not.toBe(
      screen.getByLabelText("Second title").id
    );
  });

  it("accepts typed text", async () => {
    const user = userEvent.setup();
    render(<Input label="Page title" />);

    await user.type(screen.getByLabelText("Page title"), "Field notes");

    expect(screen.getByLabelText("Page title")).toHaveValue("Field notes");
  });

  it("links a description through aria-describedby", () => {
    render(
      <Input label="Page title" description="Keep it short and specific." />
    );

    const input = screen.getByLabelText("Page title");
    const description = screen.getByText("Keep it short and specific.");

    expect(input).toHaveAccessibleDescription("Keep it short and specific.");
    expect(input).toHaveAttribute("aria-describedby", description.id);
  });

  it("marks an error invalid and links the message", () => {
    render(<Input label="Page title" error="Enter a title." required />);

    const input = screen.getByLabelText("Page title");
    const message = screen.getByRole("alert");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", message.id);
    expect(message).toHaveTextContent("Enter a title.");
    expect(input).toBeRequired();
  });

  it("links both the description and the error when both are present", () => {
    render(
      <Input
        label="Page title"
        description="Keep it short."
        error="Enter a title."
      />
    );

    const input = screen.getByLabelText("Page title");
    const describedBy = input.getAttribute("aria-describedby")?.split(" ");

    expect(describedBy).toHaveLength(2);
    expect(input).toHaveAccessibleDescription("Keep it short. Enter a title.");
  });

  it("paints the focus ring with the focus tokens", () => {
    expect(inputCss).toContain(":focus-visible");
    expect(inputCss).toContain(
      "outline: var(--focus-ring-width) solid var(--focus-ring-color)"
    );
    expect(inputCss).toContain("outline-offset: var(--focus-ring-offset)");
  });
});
