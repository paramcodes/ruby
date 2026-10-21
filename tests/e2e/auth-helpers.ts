import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "password1234";

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

/**
 * Creates a fresh account and leaves the page on the post-sign-up dashboard.
 * Returns the email so a test can sign back in with the same account.
 */
export async function signUp(page: Page, prefix = "member"): Promise<string> {
  const email = uniqueEmail(prefix);

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3100\/$/);
  await expect(
    page.getByRole("heading", { name: "Your workspace" })
  ).toBeVisible();

  return email;
}
