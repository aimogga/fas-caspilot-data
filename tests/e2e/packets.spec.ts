import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/f-403";
const ORDER = ["County need profile", "FAS results", "Outcomes", "Methodology and sources", "Suppression note", "Related-party disclosure"];
/** Any day-level date: ISO, slashed, `Jul 1, 2026` or `1 Jul 2026`. Month/quarter strings pass. */
const EXACT_DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/;
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("board viewer gets 403 on /staff/packets and no Evidence packets nav item (F-403)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/packets?variant=board"))?.status()).toBe(403);
  await page.goto("/board");
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Evidence packets" })).toHaveCount(0);
});

for (const [variant, query, scope] of [["grant", "variant=grant&county=49035", "Salt Lake County"], ["board", "variant=board&county=49035", "Statewide"]] as const) {
  test(`${variant} packet renders six sections in order with no exact dates, prints without controls, and saves a Letter PDF (F-403)`, async ({ page }) => {
    await signIn(page, variant === "grant" ? "staff@example.test" : "admin@example.test");
    await page.setViewportSize({ width: 1024, height: 900 });
    expect((await page.goto(`/staff/packets?${query}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page]")).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=packet-title]")).toHaveText(`FAS Evidence packet · ${variant === "grant" ? "Grant attachment" : "Board packet"} · ${scope}`);
    await expect(page.locator("[data-slot=packet-ribbon]")).toHaveText("DRAFT · for review");
    await expect(page.locator("[data-slot=packet-cover]")).toContainText(/Prepared \w{3} \d{4} · Data as of (\w{3} \d{4}|Not available yet)/);
    await expect(page.locator("[data-slot=packet-section] h2")).toHaveText(ORDER);
    const text = await page.locator("[data-slot=packet]").innerText();
    expect(text).not.toMatch(EXACT_DATE);
    expect(text).not.toMatch(/\$0\b|NaN|undefined|null|case_id/);
    expect(text).toMatch(/fewer than 11|hidden/i);
    await expect(page.locator("[data-slot=packet-footer]")).toHaveText(/^FAS Evidence · Counts under 11 are hidden · \w{3} \d{4}$/);
    expect(await axe(page)).toEqual([]);
    expect(await page.setViewportSize({ width: 375, height: 800 }).then(() => page.evaluate(() => document.documentElement.scrollWidth))).toBe(375);
    await page.setViewportSize({ width: 816, height: 1056 });
    const print = page.getByRole("button", { name: "Print / Save as PDF" });
    await expect(print).toBeVisible().then(() => page.emulateMedia({ media: "print" }));
    await expect(print).toBeHidden();
    await expect(page.locator("[data-slot=packet-controls]")).toBeHidden();
    await expect(page.locator("[data-slot=sidebar]")).toBeHidden();
    expect(await page.locator("[data-slot=packet-section]").first().evaluate((el) => getComputedStyle(el).breakBefore)).toBe("page");
    await page.screenshot({ path: `${ART}/packet-${variant}-page1.png`, clip: { x: 0, y: 0, width: 816, height: 1056 } });
    await page.pdf({ path: `${ART}/packet-${variant}.pdf`, format: "Letter", printBackground: true });
  });
}
