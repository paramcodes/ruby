import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";
import { Dialog } from "./dialog";

afterEach(cleanup);

describe("Dialog", () => {
  it("opens with an accessible name and description", async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        trigger={<Button>Rename page</Button>}
        title="Rename page"
        description="Choose a new title."
      >
        <p>Dialog body</p>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Rename page" }));

    const dialog = await screen.findByRole("dialog", { name: "Rename page" });
    expect(dialog).toHaveAccessibleDescription("Choose a new title.");
    expect(dialog).toHaveTextContent("Dialog body");
  });

  it("moves focus into the dialog and marks the background inert", async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="background">
        <Dialog
          trigger={<Button>Open settings</Button>}
          title="Settings"
          description="Adjust your workspace."
        >
          <p>Dialog body</p>
        </Dialog>
      </div>
    );

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(
      screen.queryByRole("button", { name: "Open settings" })
    ).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        trigger={<Button>Open settings</Button>}
        title="Settings"
        description="Adjust your workspace."
      >
        <p>Dialog body</p>
      </Dialog>
    );

    const trigger = screen.getByRole("button", { name: "Open settings" });
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Settings" });

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
  });

  it("closes from its labelled close control", async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        trigger={<Button>Open settings</Button>}
        title="Settings"
        description="Adjust your workspace."
      >
        <p>Dialog body</p>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    await user.click(screen.getByRole("button", { name: "Close dialog" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
  });

  it("traps Tab focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        trigger={<Button>Open settings</Button>}
        title="Settings"
        description="Adjust your workspace."
      >
        <Button>Save changes</Button>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Settings" });

    for (let index = 0; index < 5; index += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });
});
