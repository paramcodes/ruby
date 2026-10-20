import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "./page";

describe("home route", () => {
  it("renders the personal wiki heading", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "Your personal wiki" })
    ).toBeInTheDocument();
  });
});
