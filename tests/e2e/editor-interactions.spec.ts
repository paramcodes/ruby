import { expect, test, type Page } from "@playwright/test";

import { signUp } from "./auth-helpers";

async function createPage(page: Page, title: string) {
  await page.goto("/");

  const main = page.getByRole("main");
  await main.getByLabel("First page title").fill(title);
  await main.getByRole("button", { name: "Create your first page" }).click();

  await expect(page).toHaveURL(/\/pages\/[^/]+$/);
  await expect(page.locator(".bn-editor")).toBeVisible();
}

async function insertFromSlashMenu(
  page: Page,
  query: string,
  optionName: string,
  text = "",
  enters = 1
) {
  await page.keyboard.type(`/${query}`);
  const option = page.getByRole("option", { name: optionName });

  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByRole("listbox", { name: "Slash menu" })).toHaveCount(
    0
  );

  if (text) {
    await page.keyboard.type(text);
  }

  for (let index = 0; index < enters; index += 1) {
    await page.keyboard.press("Enter");
  }
}

async function expectBlockGallery(page: Page) {
  const paragraph = page.locator('[data-content-type="paragraph"]');
  const headingOne = page.locator('[data-content-type="heading"] h1');
  const headingTwo = page.locator('[data-content-type="heading"] h2');
  const headingThree = page.locator('[data-content-type="heading"] h3');
  const bullet = page.locator('[data-content-type="bulletListItem"]');
  const numbered = page.locator('[data-content-type="numberedListItem"]');
  const checklist = page.locator('[data-content-type="checkListItem"]');
  const quote = page.locator('[data-content-type="quote"]');
  const divider = page.locator('[data-content-type="divider"]');
  const code = page.locator('[data-content-type="codeBlock"]');

  await expect(paragraph).toHaveCount(1);
  await expect(paragraph).toContainText("Paragraph text");
  await expect(headingOne).toHaveCount(1);
  await expect(headingOne).toContainText("Heading one");
  await expect(headingTwo).toHaveCount(1);
  await expect(headingTwo).toContainText("Heading two");
  await expect(headingThree).toHaveCount(1);
  await expect(headingThree).toContainText("Heading three");
  await expect(bullet).toHaveCount(1);
  await expect(bullet).toContainText("Bullet item");
  await expect(numbered).toHaveCount(1);
  await expect(numbered).toContainText("Numbered item");
  await expect(checklist).toHaveCount(1);
  await expect(checklist).toContainText("Check item");
  await expect(quote).toHaveCount(1);
  await expect(quote).toContainText("Quote text");
  await expect(divider).toHaveCount(1);
  await expect(code).toHaveCount(1);
  await expect(code).toContainText("const x = 1;");
}

test("slash menu inserts every supported block type and persists it", async ({
  page
}) => {
  await signUp(page, "slash");
  await createPage(page, "Block gallery");

  const editor = page.locator(".bn-editor");
  await editor.click();

  await insertFromSlashMenu(page, "text", "Paragraph", "Paragraph text");
  await insertFromSlashMenu(page, "h1", "Heading 1", "Heading one");
  await insertFromSlashMenu(page, "h2", "Heading 2", "Heading two");
  await insertFromSlashMenu(page, "h3", "Heading 3", "Heading three");
  await insertFromSlashMenu(page, "bullet", "Bullet List", "Bullet item", 2);
  await insertFromSlashMenu(
    page,
    "number",
    "Numbered List",
    "Numbered item",
    2
  );
  await insertFromSlashMenu(page, "check", "Checklist", "Check item", 2);
  await insertFromSlashMenu(page, "quote", "Quote", "Quote text");
  await insertFromSlashMenu(page, "divider", "Divider");
  await insertFromSlashMenu(page, "code", "Code Block", "const x = 1;", 0);

  await expectBlockGallery(page);

  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved",
    { timeout: 15_000 }
  );

  await page.reload();

  await expectBlockGallery(page);
});

test("keyboard shortcuts reorder blocks, and undo and redo restore state", async ({
  page
}) => {
  await signUp(page, "shortcuts");
  await createPage(page, "Shortcut page");

  const editor = page.locator(".bn-editor");
  await editor.click();
  await page.keyboard.type("First block");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second block");

  const paragraphs = page.locator('[data-content-type="paragraph"]');
  await expect(paragraphs).toHaveCount(2);

  // Let autosave and the editor history settle, so the undo below targets the
  // block move rather than the preceding typing group.
  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved",
    { timeout: 15_000 }
  );

  await page.keyboard.press("Alt+ArrowUp");

  await expect(paragraphs.nth(0)).toContainText("Second block");
  await expect(paragraphs.nth(1)).toContainText("First block");

  await page.keyboard.press("Control+z");

  await expect(paragraphs.nth(0)).toContainText("First block");
  await expect(paragraphs.nth(1)).toContainText("Second block");

  await page.keyboard.press("Control+Shift+z");

  await expect(paragraphs.nth(0)).toContainText("Second block");
  await expect(paragraphs.nth(1)).toContainText("First block");

  await expect(page.getByTestId("save-status")).toHaveAttribute(
    "data-status",
    "saved",
    { timeout: 15_000 }
  );

  await page.reload();

  const reloadedParagraphs = page.locator('[data-content-type="paragraph"]');
  await expect(reloadedParagraphs.nth(0)).toContainText("Second block");
  await expect(reloadedParagraphs.nth(1)).toContainText("First block");
});
