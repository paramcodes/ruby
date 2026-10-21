import { expect, test } from "@playwright/test";

import { uniqueEmail } from "./auth-helpers";

test.describe.configure({ mode: "serial" });

test("redirects unauthenticated visitors to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("signs up and reaches the workspace", async ({ page }) => {
  const email = uniqueEmail("signup");
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password1234");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await expect(
    page.getByRole("heading", { name: "Your workspace" })
  ).toBeVisible();
});

test("signs in with an existing account", async ({ page }) => {
  const email = uniqueEmail("signin");
  const password = "password1234";

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);

  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
});
