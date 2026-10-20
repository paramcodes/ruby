import { expect, test } from "@playwright/test";

import { signUp } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

test("creates, renames, archives, restores, and isolates pages", async ({
  browser,
  page
}) => {
  await signUp(page, "wiki");

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your workspace", level: 1 })
  ).toBeVisible();

  const main = page.getByRole("main");
  await main.getByLabel("New page title").fill("Field notes");
  await main.getByRole("button", { name: "Create your first page" }).click();

  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  const pageId = page.url().split("/").pop();

  if (!pageId) {
    throw new Error("The page route did not include a page id");
  }

  await expect(
    page.getByRole("heading", { name: "Field notes", level: 1 })
  ).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Pages" });
  await expect(
    navigation.getByRole("link", { name: "Field notes" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Actions for Field notes" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();

  const renameDialog = page.getByRole("dialog", { name: "Rename page" });
  await renameDialog.getByLabel("Page title").fill("Research notes");
  await renameDialog.getByRole("button", { name: "Save title" }).click();

  await expect(
    page.getByRole("heading", { name: "Research notes", level: 1 })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Research notes" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Actions for Research notes" })
    .click();
  await page.getByRole("menuitem", { name: "Archive" }).click();

  const archive = page.getByRole("region", { name: "Archived" });
  await expect(
    archive.getByRole("link", { name: "Research notes" })
  ).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Research notes" })
  ).toHaveCount(0);

  await archive
    .getByRole("button", { name: "Actions for Research notes" })
    .click();
  await page.getByRole("menuitem", { name: "Restore" }).click();

  await expect(
    navigation.getByRole("link", { name: "Research notes" })
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Archived" })).toHaveCount(0);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();

  try {
    await signUp(otherPage, "other");
    const response = await otherPage.goto(`/pages/${pageId}`);

    expect(response?.status()).toBe(404);
    await expect(
      otherPage.getByRole("heading", { name: "Page not found" })
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("a second member signs back in without seeing another page tree", async ({
  page
}) => {
  const email = await signUp(page, "returning");

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Start with one page" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Pages" }).getByRole("link")
  ).toHaveCount(0);
});
