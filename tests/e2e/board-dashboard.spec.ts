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
    expect(await page.locator("[data-slot=kpi-row]").evaluate((el) => el.compareDocumentPosition(document.querySelector("[data-slot=board-section]") as Element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Board dashboard");
    // DS-13b: the H1 keeps the full row at 1024 (two lines at most) with the actions on their own row under it; the seven-sentence paragraph is one lead sentence.
    expect((await page.getByRole("heading", { level: 1 }).boundingBox())!.height).toBeLessThan(90);
    await expect(page.locator("[data-slot=board-lead]")).toHaveText(/^Four pictures tell the quarter: .*counties we serve\.$/);
    await expect(page.locator("[data-slot=board-summary], [data-slot=metric-card], [data-slot=freshness-widget]")).toHaveCount(0);
    // Four numbered sections in words, each opening with its sentence; section 1 words the seed's M4 total (25 of 29) and keeps the completion picture with View as table.
    const sections = page.locator("[data-slot=board-section]");
    const eyebrows = sections.locator("[data-slot=section-eyebrow]");
    await expect(eyebrows.first()).toHaveText("1 · Did families improve?");
    await expect(eyebrows).toHaveText(["1 · Did families improve?", "2 · How long families waited", "3 · Where our therapy dollars went", "4 · Need in the counties we serve"]);
    expect(await sections.evaluateAll((els) => els.map((e) => e.getAttribute("data-state")))).not.toContain("error");
    for (const s of await sections.all()) { await expect(s.locator("h2")).toHaveText(/.+\.$/); await expect(s).not.toContainText(/\$0\b|NaN|undefined|null/); }
    const improve = sections.nth(0);
    await expect(improve.locator("h2")).toContainText("86% of closed cases finished therapy (25 of 29)");
    await expect(improve.locator("[data-picture=completion] [data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · as of \w{3} \d{4}/);
    await improve.locator("[data-picture=completion]").getByRole("button", { name: "View as table" }).click();
    await expect(improve.locator("[data-picture=completion] table")).toBeVisible();
    // Section 4: FAS counties from the need-map data; a rank cell shows the same explain words on hover and on focus; the map link is verb-first.
    const need = sections.nth(3);
    await expect(need.locator("h2")).toHaveText(/(has the highest need of the \d+ counties we serve, ranked \d+(st|nd|rd|th) of \d+ statewide|not available yet|no published need score)/i);
    await expect(need.getByRole("link", { name: "Open the county need map" })).toHaveAttribute("href", "/need-map?fas=1");
    const rank = need.locator("[data-term=rank]").first(), layer = need.locator("[data-slot=explain-layer-card]");
    if (await rank.count()) {
      await rank.hover();
      await expect(layer).toBeVisible();
      const hovered = await layer.textContent();
      await page.mouse.move(0, 0);
      await rank.focus();
      await expect(layer).toHaveText(hovered ?? "");
      expect(hovered).toContain("Rank");
      await page.keyboard.press("Escape");
    }
    // Packet card: no invented date or page count; sources paragraph built from the footers.
    await expect(page.locator("[data-slot=packet-card] h2")).toHaveText(/^A saved packet for [A-Z][a-z]+–[A-Z][a-z]+ \d{4} is not available yet\.$/);
    await expect(page.locator("[data-slot=packet-card]")).not.toContainText(/\d+ pages|Generated/);
    await expect(page.locator("[data-slot=board-sources]")).toContainText(/^Sources\. FAS records for [A-Z][a-z]+–[A-Z][a-z]+ \d{4}, as of \w{3} \d{4}: .*\(n = \d+\).* County need: .* Dates are shown by quarter\./);
    await expect(page.locator("[data-slot=board-sources] [data-slot=explain-trigger]")).toHaveCount(1);
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
  // DS-13b print: the four sections, the sources paragraph and the running footer print; the packet card, map link and View as table do not.
  await expect(page.locator("[data-slot=board-section]")).toHaveCount(4);
  for (const s of await page.locator("[data-slot=board-section]").all()) await expect(s.locator("h2")).toBeVisible();
  expect(await page.locator("[data-slot=board-section]").first().evaluate((el) => getComputedStyle(el).breakInside)).toBe("avoid");
  await expect(page.locator("[data-slot=board-sources] p").first()).toBeVisible();
  await expect(page.locator("[data-slot=board-page-footer]")).toHaveText(/^FAS Evidence · Board summary · [A-Z][a-z]+–[A-Z][a-z]+ \d{4} · County totals only$/);
  expect(await page.locator("[data-slot=board-page-footer]").evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
  await expect(page.locator("[data-slot=packet-card]")).toBeHidden();
  await expect(page.locator("[data-slot=open-map]")).toBeHidden();
  await expect(page.getByRole("button", { name: "View as table" }).first()).toBeHidden();
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
