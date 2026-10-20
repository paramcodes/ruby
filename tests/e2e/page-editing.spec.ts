import { expect, test } from "@playwright/test";

import { signUp } from "./auth-helpers";

test("typing autosaves and the content survives a reload", async ({ page }) => {
  await signUp(page, "editor");
  await page.goto("/");

  const main = page.getByRole("main");
  await main.getByLabel("First page title").fill("Autosave page");
  await main.getByRole("button", { name: "Create your first page" }).click();

  await expect(page).toHaveURL(/\/pages\/[^/]+$/);

  const editor = page.locator(".bn-editor");
  const saveStatus = page.getByTestId("save-status");

  await expect(editor).toBeVisible();
  await expect(saveStatus).toHaveAttribute("data-status", "saved");

  await editor.click();
  await page.keyboard.type("Autosave keeps this line.");

  await expect(saveStatus).toHaveAttribute("data-status", "saving");
  await expect(saveStatus).toHaveAttribute("data-status", "saved", {
    timeout: 15_000
  });

  await page.reload();

  await expect(page.locator(".bn-editor")).toContainText(
    "Autosave keeps this line."
  );
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved"
  );
});
