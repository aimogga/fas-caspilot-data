import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { latestCompleteQuarter, quarterLabel } from "../../lib/dashboard/filters";

const ART = "/opt/cursor/artifacts/f-402";
const LABEL = quarterLabel(latestCompleteQuarter(new Date()));
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

for (const email of ["board@example.test", "staff@example.test", "admin@example.test"] as const) {
  test(`board dashboard for ${email}: header, summary, seven cards with as-of footers, note (F-402)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1024, height: 900 });
    expect((await page.goto("/board"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How FAS help is working");
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText(new RegExp(`^${LABEL.replace(/[()]/g, "\\$&")} · All counties · Data (as of \\w{3} \\d{4}|date not available yet)$`));
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Board dashboard");
    const summary = page.locator("[data-slot=board-summary]");
    // Seed (DS-07c): GAD-7 has 3 follow-ups → worded "fewer than 11"; M4 total 25 of 29 is shown; the paragraph ends with its as-of date.
    await expect(summary).toContainText(/fewer than 11/i);
    await expect(summary).toContainText("86% of closed cases finished therapy (25 of 29)");
    await expect(summary).toContainText(/Data as of \w{3} \d{4}\.$/);
    await expect(summary).not.toContainText(/\$0|NaN|undefined|null/);
    const cards = page.locator("[data-slot=metric-card]");
    await expect(cards).toHaveCount(7);
    for (const c of await cards.all()) await expect(c.locator("[data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · (as of |date not available yet)/);
    await expect(page.locator("[data-slot=metric-card] tbody tr[data-suppressed]:not([data-complementary])").first()).not.toContainText("%");
    await expect(page.getByRole("heading", { level: 2, name: "Public data freshness" })).toBeVisible();
    await expect(page.locator("[data-slot=board-note]")).toHaveText(/^Counts under 11 are hidden to protect families' privacy\. Dates are shown by quarter\. Data (as of \w{3} \d{4}|date not available yet)\. FAS Evidence\.$/);
    await expect(page.locator("[data-slot=filter-bar]")).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
  });
}

test("board dashboard prints without the shell or buttons and reads at 375/1024/1440 (F-402)", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/board");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBe(width);
    if (width !== 1440) expect(await axe(page), `axe @ ${width}`).toEqual([]);
    await page.screenshot({ path: `${ART}/board-${width}.png`, fullPage: true });
  }
  const print = page.getByRole("button", { name: "Print" });
  await expect(print).toBeVisible();
  expect((await print.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.emulateMedia({ media: "print" });
  await expect(print).toBeHidden();
  await expect(page.locator("[data-slot=packet-download]").first()).toBeHidden();
  await expect(page.locator("[data-slot=sidebar]")).toBeHidden();
  await expect(page.locator("[data-slot=topbar]")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("[data-slot=metric-card]")).toHaveCount(7);
  for (const c of await page.locator("[data-slot=metric-card]").all()) await expect(c).toBeVisible();
  expect(await page.locator("[data-slot=metric-card]").first().evaluate((el) => getComputedStyle(el).breakInside)).toBe("avoid");
  expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).color)).toBe("rgb(0, 0, 0)");
  await page.screenshot({ path: `${ART}/board-print-1024.png`, fullPage: true });
  await page.pdf({ path: `${ART}/board-letter.pdf`, format: "Letter", printBackground: true });
});
