import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const FIX = "tests/fixtures/grants", LIST = "[data-slot=recent-opportunities] li", PREVIEW = "[data-slot=import-preview]";
async function signIn(page: Page, email: string) {
  await page.goto("/login"); await page.fill("#email", email); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("board gets 403 on the page and the API", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/grants"))?.status()).toBe(403); expect((await page.request.post("/api/grants/foundation", { data: { mode: "manual", row: { title: "x", funder: "y" } }, maxRedirects: 0 })).status()).toBe(403);
});

test("staff adds one by hand (required errors, saved row with the Manual entry tag and words for every value) and imports a CSV (bad file blocks, good file imports 3)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto("/staff/grants"))?.status()).toBe(200); await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add the grants foundations publish");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width); expect(await axe(page)).toEqual([]);
  }
  await page.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "2 fields need attention" })).toBeVisible();
  await expect(page.locator("#fo-title")).toHaveAttribute("aria-invalid", "true"); await expect(page.locator("#fo-title")).toBeFocused();
  await expect(page.locator("#fo-title-err")).toHaveText("Opportunity title is required");
  expect(await axe(page)).toEqual([]);
  const title = `Synthetic Manual Grant ${Date.now()}`;
  for (const [id, value] of [["title", title], ["funder", "Synthetic Manual Foundation"], ["close_date", "3/31/2027"], ["award_ceiling", "$12,000"]]) await page.fill(`#fo-${id}`, value);
  await page.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.getByText(`Saved ${title}`)).toBeVisible();
  for (const t of ["Manual entry", "Synthetic Manual Foundation", "Up to $12,000", "Closes Mar 31, 2027"]) await expect(page.locator(LIST).filter({ hasText: title })).toContainText(t);
  await page.getByRole("button", { name: "Add another" }).click(); await expect(page.locator("#fo-title")).toHaveValue("");
  const tpl = await page.request.get("/api/grants/foundation/template");
  expect(tpl.headers()["content-disposition"]).toBe('attachment; filename="fas-foundation-template.csv"'); expect((await tpl.text()).startsWith("title,funder,")).toBe(true);
  await page.locator("#fo-file").setInputFiles(`${FIX}/foundation-bad.csv`); await expect(page.locator(PREVIEW)).toContainText("0 rows ready · 3 rows with errors");
  await expect(page.getByRole("link", { name: "Download error report" })).toHaveAttribute("href", /row%2Ccolumn%2Ccode%2Cmessage/);
  await expect(page.getByRole("button", { name: /^Import \d+ rows$/ })).toBeDisabled();
  await page.locator("#fo-file").setInputFiles(`${FIX}/foundation-good.csv`); await expect(page.locator(PREVIEW)).toContainText("3 rows ready · 0 rows with errors");
  await page.getByRole("button", { name: "Import 3 rows" }).click(); await expect(page.getByText("Imported 3 opportunities")).toBeVisible();
  for (const t of ["Synthetic Therapy Access Grant", "Synthetic Court Families Fund", "Synthetic Rural Counseling Award"]) await expect(page.locator(LIST).filter({ hasText: t }).first()).toContainText("Manual entry");
  for (const t of ["No close date", "From $2,500"]) await expect(page.locator(LIST).filter({ hasText: "Synthetic Rural Counseling Award" }).first()).toContainText(t);
});
