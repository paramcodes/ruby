import { expect, test } from "@playwright/test";

import { signUp } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

async function createFirstPage(
  page: import("@playwright/test").Page,
  title: string
): Promise<void> {
  await page.goto("/");
  await page.getByRole("main").getByLabel("First page title").fill(title);
  await page.getByRole("button", { name: "Create your first page" }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(page.locator(".bn-editor")).toBeVisible();
}

test.describe("shell accessibility", () => {
  test("keyboard navigation reaches the sidebar, page tree, and editor", async ({
    page
  }) => {
    await signUp(page, "a11y");
    await createFirstPage(page, "Keyboard page");

    // Tab forward through the shell and collect accessible names of each
    // focused element. This is more robust than counting positions because it
    // verifies the *names* of reachable controls rather than DOM structure.
    const tabOrder: string[] = [];

    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const name = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) {
          return null;
        }

        // For inputs, the accessible name comes from the associated <label>,
        // not from an aria-label or textContent.
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          const labels = el.labels;
          if (labels && labels.length > 0) {
            const text = labels[0].textContent?.trim();
            if (text) {
              return text;
            }
          }
        }

        return (
          el.getAttribute("aria-label") ||
          el.getAttribute("value") ||
          el.textContent?.trim().slice(0, 60) ||
          ""
        );
      });
      if (name) {
        tabOrder.push(name);
      }
    }

    // Sidebar: brand link and create form are reachable.
    expect(tabOrder).toContain("Individual Wiki");
    expect(tabOrder).toContain("New page title");
    expect(tabOrder).toContain("Create page");

    // Page tree: the page link and its actions button are reachable.
    expect(tabOrder).toContain("Keyboard page");
    expect(tabOrder).toContain("Actions for Keyboard page");

    // Editor: there is no permanent command toolbar anymore — undo, redo,
    // and block moves are keyboard-first (Ctrl+Z/Y, Alt+Arrows). Verify the
    // writing canvas is itself reachable and the undo shortcut works.
    const editor = page.locator(".bn-editor");

    let focusedCanvas = false;

    for (let i = 0; i < 40 && !focusedCanvas; i++) {
      await page.keyboard.press("Tab");
      focusedCanvas = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return Boolean(el?.isContentEditable && el.closest(".bn-editor"));
      });
    }

    expect(focusedCanvas).toBe(true);

    await page.keyboard.type("Keyboard edit");
    await expect(editor).toContainText("Keyboard edit");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).not.toContainText("Keyboard edit");
  });

  test("focused interactive elements show a visible focus indicator", async ({
    page
  }) => {
    await signUp(page, "focus");

    // Navigate explicitly: a fresh navigation resets focus to the document,
    // and the workspace listing has no editor to auto-focus or swallow Tab.
    // The first two Tabs then deterministically reach the skip link and the
    // brand link.
    await page.goto("/");

    // Tab past the skip link to the brand link.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    const focusStyle = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) {
        return { outlineWidth: "0px", outlineStyle: "none" };
      }
      const style = getComputedStyle(el);
      return {
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle
      };
    });

    // The global :focus-visible rule sets outline: 2px solid var(--color-accent).
    expect(Number.parseInt(focusStyle.outlineWidth)).toBeGreaterThan(0);
    expect(focusStyle.outlineStyle).not.toBe("none");
  });

  test("main controls have accessible names", async ({ page }) => {
    await signUp(page, "names");
    await createFirstPage(page, "Named page");

    // Page actions dropdown trigger.
    await expect(
      page.getByRole("button", { name: "Actions for Named page" })
    ).toBeVisible();

    // Favorite toggle (initially not favorited).
    await expect(
      page.getByRole("button", { name: "Add to favorites" })
    ).toBeVisible();

    // The writing canvas hosts undo, redo, and block actions itself (drag
    // handle and slash menu); no command toolbar is rendered.
    await expect(page.locator(".bn-editor")).toBeVisible();

    // Save status announces via role="status".
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "role",
      "status"
    );

    // Search button in the sidebar.
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("the sidebar becomes a drawer at a narrow viewport", async ({
    page
  }) => {
    await signUp(page, "responsive");
    await createFirstPage(page, "Responsive page");

    await page.setViewportSize({ width: 500, height: 900 });

    const sidebar = page.locator('aside[aria-label="Workspace navigation"]');
    const editor = page.locator(".bn-editor");
    const menuButton = page.getByRole("button", { name: "Open navigation" });

    // The rail is off-canvas, so the writing canvas owns the whole width.
    await expect(menuButton).toBeVisible();
    await expect(editor).toBeVisible();

    const closedBox = await sidebar.boundingBox();
    const editorBox = await editor.boundingBox();

    expect(closedBox).not.toBeNull();
    expect(editorBox).not.toBeNull();
    // The closed rail sits entirely to the left of the viewport.
    expect(closedBox!.x + closedBox!.width).toBeLessThanOrEqual(1);
    // The editor starts at the top of the content area, with no rail above.
    expect(editorBox!.y).toBeLessThan(200);

    // The editor stays usable with the drawer closed.
    await editor.click();
    await page.keyboard.type("Narrow viewport edit.");
    await expect(editor).toContainText("Narrow viewport edit.");

    // Opening the drawer slides the rail in over the content.
    await menuButton.click();
    await page.waitForTimeout(400);
    const openBox = await sidebar.boundingBox();
    expect(openBox!.x).toBeGreaterThanOrEqual(-1);

    // The scrim closes the drawer again. The click lands beside the drawer,
    // because the drawer itself covers the middle of the scrim.
    await page
      .getByRole("button", { name: "Close navigation" })
      .click({ position: { x: 460, y: 700 } });
    await page.waitForTimeout(400);
    const reclosedBox = await sidebar.boundingBox();
    expect(reclosedBox!.x + reclosedBox!.width).toBeLessThanOrEqual(1);
  });
});
