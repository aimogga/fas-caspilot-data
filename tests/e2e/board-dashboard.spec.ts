import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { latestCompleteQuarter } from "../../lib/dashboard/filters";
import { quarterWords } from "../../lib/dashboard/format";

const ART = "/opt/cursor/artifacts/f-402";
const WHEN = quarterWords(latestCompleteQuarter(new Date()));
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
    // DS-13a: eyebrow and H1 in words, the privacy rule under it, a "Data as of" block, then three KPIs in one rule row before the pictures.
    await expect(page.locator("[data-slot=page-header] > p").first()).toHaveText("Family Advocacy Services · Board summary");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`How families fared, ${WHEN}`);
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText("County totals only. Anything under 11 families is hidden.");
    const asOf = page.locator("[data-slot=board-asof]");
    await expect(asOf.locator("dt")).toHaveText(["Data as of", "Period", "Counties"]);
    await expect(asOf.locator("dd").first()).toHaveText(/^(\w{3} \d{4}|Not available yet)$/);
    await expect(asOf.locator("dd").nth(1)).toHaveText(`${WHEN}, the latest complete quarter`);
    const kpis = page.locator("[data-slot=kpi]");
    await expect(kpis).toHaveCount(3);
    expect(await kpis.evaluateAll((els) => els.map((e) => e.getAttribute("data-metric")))).toEqual(["m1", "m4", "m5"]);
    expect(await kpis.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).not.toContain("error");
    // Seed (DS-07c): M4 total 25 of 29 is shown, so the middle KPI carries the stored counts in words and a comparison line with its hint.
    const m4 = page.locator("[data-slot=kpi][data-metric=m4]");
    await expect(m4.locator("[data-slot=kpi-detail]")).toHaveText(/^\d+ of \d+ who closed$/);
    await expect(m4.locator("[data-slot=kpi-compare]")).toHaveText(/(faster|slower|higher|lower|Same as|Nothing to compare with) [A-Z][a-z]+–[A-Z][a-z]+ \d{4}$/);
    await expect(m4.locator("[data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · as of \w{3} \d{4}/);
    for (const k of await kpis.all()) await expect(k).not.toContainText(/\$0\b|NaN|undefined|null|^0 /);
    // The KPI label opens the same explain words on hover and on keyboard focus; the pictures and the seven cards stay below the row.
    const label = m4.locator("[data-slot=explain-trigger]").first();
    const face = page.locator("[data-slot=hover-card-content] [data-slot=explain-content]");
    await label.hover();
    await expect(face).toBeVisible();
    const hovered = await face.textContent();
    await page.mouse.move(0, 0);
    await expect(face).toBeHidden();
    await label.focus();
    await expect(face).toHaveText(hovered ?? "");
    expect(hovered).toContain("Completion rate by income band");
    await page.keyboard.press("Escape");
    expect(await page.locator("[data-slot=kpi-row]").evaluate((el) => el.compareDocumentPosition(document.querySelector("[data-slot=board-pictures], [data-slot=metric-card]") as Element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
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
  // DS-13a: at 375 every KPI label and comparison trigger is at least 44 px tall.
  await page.setViewportSize({ width: 375, height: 900 });
  for (const t of await page.locator("[data-slot=kpi] [data-slot=explain-trigger], [data-slot=kpi] [data-slot=hint-trigger]").all()) expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1024, height: 900 });
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
  // DS-13a print: Letter sheet with 22 pt serif H1 and 11 pt body, the KPI row three across, no explain face left open.
  expect(await page.locator("h1").evaluate((el) => [getComputedStyle(el).fontSize, getComputedStyle(el).fontFamily.includes("Source Serif")])).toEqual(["29.3333px", true]);
  expect(await page.locator("[data-slot=page]").evaluate((el) => getComputedStyle(el).fontSize)).toBe("14.6667px");
  expect(await page.locator("[data-slot=kpi-row]").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(page.locator("[data-slot=kpi]")).toHaveCount(3);
  await page.locator("[data-slot=kpi] [data-slot=explain-trigger]").first().focus();
  await expect(page.locator("[data-slot=hover-card-content]")).toBeHidden();
  await page.screenshot({ path: `${ART}/board-print-1024.png`, fullPage: true });
  await page.pdf({ path: `${ART}/board-letter.pdf`, format: "Letter", printBackground: true });
});
