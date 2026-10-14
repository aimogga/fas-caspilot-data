import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { latestCompleteQuarter, quarterLabel } from "../../lib/dashboard/filters";

const ART = "/opt/cursor/artifacts/ds-07a";
// Each role walks filters, widgets, the filter sheet, axe and screenshots on a dev server that compiles on first hit; 30 s flaked on CI.
test.setTimeout(90_000);
const LABEL = quarterLabel(latestCompleteQuarter(new Date()));
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("board gets 403 and no Team dashboard nav item (DS-07a)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/dashboard"))?.status()).toBe(403);
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Team dashboard" })).toHaveCount(0);
});

for (const email of ["staff@example.test", "admin@example.test"] as const) {
  test(`team dashboard for ${email}: filters, pipeline widget, sheet, axe, screenshots (DS-07a)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await page.goto("/dashboard"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team dashboard");
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page], [data-slot=crumbs]")).toHaveText(["Team dashboard", "Team dashboard"]);
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText(`${LABEL} · All counties · All referral sources`);
    const bar = page.locator("[data-slot=filter-bar]");
    await expect(bar.getByLabel("Compare to prior quarter")).toBeChecked();
    await bar.getByLabel("County").selectOption("49035");
    await bar.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/county=49035/);
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText(`${LABEL} · Salt Lake County · All referral sources`);
    // The e2e suite shares one database: foundation-import.spec adds manual "New" opportunities that close before the seeded fund, so New, the deadline and the manual count are matched loosely.
    await expect(page.locator("[data-slot=pipeline-widget] li")).toHaveText([/^New(✎ Manual entry)?\s*\d+$/, /^Reviewing\s*0$/, /^Pursuing.*Manual entry\s*1$/, /^Submitted\s*0$/, /^Awarded\s*0$/, /^Declined\s*0$/, /^Passed\s*0$/]);
    await expect(page.locator("[data-slot=pipeline-widget]")).toContainText(/Next deadline: Synthetic [\w ]+, closes \w{3} \d{1,2}\s*Grants\.gov and foundation lists · as of \w{3} \d{4} · includes \d+ manual entries$/);
    for (const width of [375, 800, 1024, 1440]) {
      for (const scheme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/dashboard");
        await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), scheme === "dark");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width} ${scheme}`).toBe(width);
        expect(await axe(page), `axe @ ${width} ${scheme}`).toEqual([]);
        if (email === "staff@example.test") await page.screenshot({ path: `${ART}/dashboard-${width}-${scheme}.png`, fullPage: true });
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard?compare=none");
    const button = page.getByRole("button", { name: "Filters · 1" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    const sheet = page.locator("#filter-sheet");
    await expect(sheet.getByRole("heading", { name: "Filter the dashboard" })).toBeVisible();
    for (const el of await sheet.locator("select, button, a").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(button).toBeFocused();
  });
}

test("M1 headline card is wired to the F-304 view: title, source footer, trend table toggle (DS-07b, F-401)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const card = page.locator("[data-slot=metric-card]").filter({ has: page.locator("#card-m1-title") });
  await expect(card.getByRole("heading", { level: 2 })).toHaveText("Days from court order to first session");
  await expect(card.locator("[data-slot=source-footer]")).toHaveText(new RegExp(`^FAS records · ${LABEL.replace(/[()]/g, "\\$&")} · n = \\d+ · as of `));
  await expect(card).toHaveText(/\d+ days|n<11|No closed cases this quarter/);
  const toggle = card.getByRole("button", { name: "View as table" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(card.locator("table th[scope=col]")).toHaveText(["Quarter", "Median days"]);
  expect([await card.locator("table tbody tr").count(), await axe(page)]).toEqual([4, []]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard?county=49035");
  await expect(card).toContainText("No cases match these filters");
  for (const name of ["View as table", "Reset filters"]) expect((await card.getByText(name).boundingBox())!.height, name).toBeGreaterThanOrEqual(44);
});

test("M4, M6 and O1 cards against the seed: n<11 cells without a rate, complementary band, hidden-bands footer, both group rates, outcome rows (DS-07c, F-401)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const card = (id: string) => page.locator("[data-slot=metric-card]").filter({ has: page.locator(`#card-${id}-title`) });
  const m4 = card("m4"), m6 = card("m6"), o1 = card("o1"), quarter = LABEL.replace(/[()]/g, "\\$&");
  await expect(m4.getByRole("heading", { level: 2 })).toHaveText("Completion rate by income band");
  await expect(m4.locator("thead th")).toHaveText(["Income band", "Completed", "Closed", "Rate"]);
  await expect(m4.locator("tbody tr")).toHaveText([/^a.*12.*14.*86%$/, /^b.*Hidden · protects another cell$/, /^c.*n<11.*n<11.*—$/]);
  await expect(m4.locator("tbody tr[data-suppressed]:not([data-complementary])")).not.toContainText("%");
  await expect(m4.locator("tfoot tr")).toHaveText(/^All bands.*25.*29.*86%$/);
  await expect(m4.locator("[data-slot=source-footer]")).toHaveText(new RegExp(`^FAS records · ${quarter} · n = 29 · as of \\w{3} \\d{4} · includes hidden bands$`));
  await expect(m6.locator("[data-slot=m6-share]")).toHaveText("Affiliated providers 59% · Other providers 41%");
  await expect(m6.locator("tbody tr")).toHaveText([/^Affiliated providers.*\$120.*\$1,700.*17$/, /^Other providers.*\$90.*\$1,200.*12$/]);
  await expect(m6.locator("[data-slot=source-footer]")).toHaveText(new RegExp(`^FAS records · ${quarter} · n = 29 · as of \\w{3} \\d{4}$`));
  await expect(o1.locator("tbody tr")).toHaveText([/^PHQ-9.*Lower is better.*−1\.5.*75%.*12$/, /^GAD-7.*Lower is better.*n<11.*n<11.*n<11/]);
  await expect(o1.locator("tbody tr[data-measure=GAD-7]")).not.toContainText("%");
  await expect(o1.locator("[data-slot=source-footer]")).toContainText("n = 15 · as of");
  expect(await axe(page)).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  for (const c of [m4, m6, o1]) await expect(c.locator("[data-slot=table-stack]")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  await page.goto("/dashboard?county=49035");
  for (const c of [m4, m6, o1]) await expect(c).toContainText("No cases match these filters");
});

test("public data freshness widget lists the seeded sources with text statuses (DS-07a follow-up, F-401)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const widget = page.locator("[data-slot=freshness-widget]");
  await expect(widget.getByRole("heading", { level: 2, name: "Public data freshness" })).toBeVisible();
  const rows = widget.locator("li");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) await expect(row).toHaveText(/^\W*(Current|Stale|Failed|Not published)\s/);
  // census-sahie is "Not published" only until an ingest succeeds; CI's test:db load records one, so accept either state.
  // The widget lists only the MAX_ROWS worst sources, so once more sources are registered a current census-sahie may not be listed at all.
  const sahie = rows.filter({ hasText: "census-sahie" });
  if (await sahie.count()) await expect(sahie).toHaveText(/^\W*(Current|Stale|Not published)\s*census-sahie\s*Latest 2023$/);
  await expect(widget.locator("[data-slot=source-footer]")).toHaveText(/^Source registry · as of (Not available yet|\w{3} \d{4})$/);
  await expect(page.getByRole("link", { name: "See all sources" })).toHaveCount(0);
});
