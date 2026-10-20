import { expect, test } from "@playwright/test";

import { signUp } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

test("search finds pages by title and content and navigates from results", async ({
  page
}) => {
  await signUp(page, "discovery");
  await page.goto("/");

  // Create a page whose title and body overlap only on common words, so a
  // content-only match ("terrain") can be told apart from a title match.
  await page
    .getByRole("main")
    .getByLabel("First page title")
    .fill("Field Notes");
  await page.getByRole("button", { name: "Create your first page" }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);

  const editor = page.locator(".bn-editor");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.type("These field research notes cover terrain mapping.");
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved",
    { timeout: 15_000 }
  );

  // Return to the workspace home so the sidebar is fully rendered.
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open the search dialog via the global Cmd+K shortcut.
  await page.keyboard.press("Meta+k");
  await expect(
    page.getByRole("dialog", { name: "Search pages" })
  ).toBeVisible();

  const dialog = page.getByRole("dialog", { name: "Search pages" });
  const searchInput = dialog.getByLabel("Search pages");

  // Title search: "field" appears in the page title.
  await searchInput.fill("field");
  await expect(dialog.getByRole("link", { name: /Field Notes/ })).toBeVisible({
    timeout: 10_000
  });

  // Content search: "terrain" appears only in the body text, proving the
  // full-text index covers page content, not just titles.
  await searchInput.fill("terrain");
  await expect(dialog.getByRole("link", { name: /Field Notes/ })).toBeVisible({
    timeout: 10_000
  });

  // Navigate from the search result and confirm the page loads.
  await dialog.getByRole("link", { name: /Field Notes/ }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(
    page.getByRole("heading", { name: "Field Notes", level: 1 })
  ).toBeVisible();
});

test("recently visited pages appear in the sidebar recent list", async ({
  page
}) => {
  await signUp(page, "recent");
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("main")
    .getByLabel("First page title")
    .fill("Recent Page");
  await page.getByRole("button", { name: "Create your first page" }).click();
  await expect(page).toHaveURL(/\/pages\/[^/]+$/);

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("region", { name: "Recent" }).getByRole("link", {
      name: "Recent Page"
    })
  ).toBeVisible({ timeout: 10_000 });
});

test("search shows a message when no pages match", async ({ page }) => {
  await signUp(page, "no-match");
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await page.keyboard.press("Meta+k");
  await expect(
    page.getByRole("dialog", { name: "Search pages" })
  ).toBeVisible();

  await page.getByRole("searchbox", { name: "Search pages" }).fill("zzzzz");
  await expect(page.getByText("No pages found.")).toBeVisible({
    timeout: 10_000
  });
});
