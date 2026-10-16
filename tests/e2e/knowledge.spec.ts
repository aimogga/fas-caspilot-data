import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));
const CONFIRM = "This text contains no client or family information.";
/** Fill and submit the add form (or an edit form passed as `scope`); returns the form's status line. */
async function submit(page: Page, fields: { title?: string; body: string }, scope = page.locator("[data-slot=knowledge-form]").first()) {
  if (fields.title) await scope.getByLabel("Title").fill(fields.title);
  await scope.getByLabel("Text the grant writer may use").fill(fields.body);
  await scope.getByLabel(CONFIRM).check();
  await scope.getByRole("button", { name: /as draft$|as new draft$/ }).click();
  return scope.locator("[data-slot=knowledge-message]");
}

test("admin adds, edits, approves and archives a fictional entry; the guard refuses a phone number (F-508c)", async ({ page }) => {
  await signIn(page, "admin@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/admin/knowledge"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("What FAS says about itself");
  await expect(page.locator("[data-slot=crumbs]")).toHaveText("Admin · FAS knowledge");
  const title = `Program (fictional) ${Date.now()}`, phone = "801-555-0142";
  await page.getByLabel("Category").first().selectOption("program");
  const msg = await submit(page, { title, body: `Call the made-up family at ${phone}.` });
  await expect(msg).toHaveText("Not saved: the text contains a phone number. Store org-level facts only.");
  expect(await page.locator("main").innerText()).not.toContain(phone); // the field keeps it; the page never echoes it
  await expect(page.getByLabel("Title").first()).toHaveValue(title); // a refused entry keeps the typing
  await expect(await submit(page, { body: "Bluebird Family Fund (fictional) offers short-term family counseling." })).toHaveText("Added as a draft.");

  const row = page.locator("[data-slot=knowledge-row]", { hasText: title });
  await expect(row).toHaveAttribute("data-status", "draft");
  await row.locator("[data-slot=knowledge-edit] summary").click();
  await submit(page, { body: "Bluebird Family Fund (fictional) offers counseling in two made-up counties." }, row.locator("[data-slot=knowledge-form]"));
  await expect(row.locator("[data-slot=knowledge-facts]")).toContainText("Version 2");
  await row.getByRole("button", { name: `Approve: ${title}` }).click();
  await expect(row).toHaveAttribute("data-status", "approved");
  await row.locator("[data-slot=knowledge-history] summary").click();
  await expect(row.locator("[data-slot=knowledge-history] li")).toHaveCount(3);
  await expect(row.locator("[data-slot=knowledge-history] li").first()).toContainText("Version 3 · Approved");
  expect(await axe(page)).toEqual([]);

  await row.getByRole("button", { name: `Archive: ${title}` }).click();
  await expect(row).toHaveAttribute("data-status", "archived");
  await expect(row.getByRole("button", { name: /delete/i })).toHaveCount(0);
  await page.goto("/admin/knowledge?status=archived");
  await expect(page.locator("[data-slot=knowledge-row]", { hasText: title })).toBeVisible();
  await expect(page.locator("[data-slot=knowledge-row]:not([data-status=archived])")).toHaveCount(0);
  expect(await axe(page)).toEqual([]);
});

test("staff and board get 403 on the admin screen, so they cannot edit (F-508c)", async ({ browser }) => {
  for (const email of ["staff@example.test", "board@example.test"]) {
    const page = await (await browser.newContext()).newPage(); await signIn(page, email); expect((await page.goto("/admin/knowledge"))?.status()).toBe(403);
  }
});
