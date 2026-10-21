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
  test("keyboard navigation reaches the sidebar, page tree, and editor toolbar", async ({
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

    // Editor toolbar: Undo and Redo are reachable.
    expect(tabOrder).toContain("Undo");
    expect(tabOrder).toContain("Redo");
    expect(tabOrder).toContain("Move block up");
    expect(tabOrder).toContain("Move block down");
  });

  test("focused interactive elements show a visible focus indicator", async ({
    page
  }) => {
    await signUp(page, "focus");
    await createFirstPage(page, "Focus page");

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

    // Editor toolbar buttons.
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Redo" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Move block up" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Move block down" })
    ).toBeVisible();

    // Save status announces via role="status".
    await expect(page.getByTestId("save-status")).toHaveAttribute(
      "role",
      "status"
    );

    // Search button in the sidebar.
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("sidebar does not overlap the writing canvas at a narrow viewport", async ({
    page
  }) => {
    await signUp(page, "responsive");
    await createFirstPage(page, "Responsive page");

    await page.setViewportSize({ width: 500, height: 900 });

    const sidebar = page.locator('aside[aria-label="Workspace navigation"]');
    const editor = page.locator(".bn-editor");

    await expect(sidebar).toBeVisible();
    await expect(editor).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    const editorBox = await editor.boundingBox();

    expect(sidebarBox).not.toBeNull();
    expect(editorBox).not.toBeNull();

    // At narrow viewport the layout becomes a single column: the sidebar
    // sits above the main content, so the editor must start below the sidebar
    // rather than beside it or overlapped by it.
    expect(editorBox!.y).toBeGreaterThanOrEqual(sidebarBox!.y);
    // The editor's top edge should be at or below the sidebar's bottom edge.
    const sidebarBottom = sidebarBox!.y + sidebarBox!.height;
    expect(editorBox!.y).toBeGreaterThanOrEqual(sidebarBottom - 1); // 1px tolerance

    // The editor must remain interactive at the narrow width.
    await editor.click();
    await page.keyboard.type("Narrow viewport edit.");
    await expect(editor).toContainText("Narrow viewport edit.");
  });
});
