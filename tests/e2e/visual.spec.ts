import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Visual-first direction (packets 1–5): board pictures, county panel in words, staff and admin tiles, `/home`. */
test.setTimeout(120_000);
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));
const noOverflow = async (page: Page, width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBe(width);

test("board opens with the quarter as pictures: headline in words, hidden bands never drawn as zero, table view (F-402)", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/board");
    const charts = page.locator("[data-slot=board-section] [data-slot=chart]");
    // Seed (DS-07c): M4 total 25 of 29 is shown, so the completion picture always exists; up to four pictures in all.
    expect(await charts.count()).toBeGreaterThanOrEqual(1);
    expect(await charts.count()).toBeLessThanOrEqual(4);
    const completion = page.locator("[data-picture=completion]");
    await expect(completion.locator("figcaption")).toContainText(/finished therapy most often|hidden to protect privacy/);
    await expect(completion.locator("[role=img]")).toHaveAttribute("aria-label", /.+/);
    await expect(completion).toContainText("All bands");
    await completion.getByRole("button", { name: "View as table" }).click();
    await expect(completion.locator("table")).toBeVisible();
    await noOverflow(page, width);
    expect(await axe(page), `axe @ ${width}`).toEqual([]);
  }
});

test("county panel opens in words with comparison bars against the state median (F-211)", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map?county=49035");
    const panel = page.locator("[data-slot=county-panel]");
    await expect(panel.getByRole("heading")).toContainText("Salt Lake County");
    await expect(panel.locator("[data-slot=county-compare]")).toContainText(/^Salt Lake County has a higher .+ than \d+ of \d+ other Utah counties|^No rate indicators are published/);
    const bars = panel.locator("[data-slot=compare-bars] li[data-where]");
    if (await bars.count()) {
      await expect(bars.first()).toContainText(/\d+%, (above|below|near) the state median of \d+(\.\d+)?%/);
      await expect(panel).toContainText("State median");
    }
    await noOverflow(page, width);
    expect(await axe(page), `axe @ ${width}`).toEqual([]);
  }
});

for (const [email, path] of [["staff@example.test", "/staff"], ["admin@example.test", "/admin"]] as const) {
  test(`${path} greets, shows three KPI cards with footers and the quick links (F-401, DS-10a)`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)/);
      const tiles = page.locator("[data-slot=home-tile]");
      await expect(tiles).toHaveCount(3);
      for (const t of await tiles.all()) {
        await expect(t.locator("h2")).toHaveText(/.+/);
        await expect(t.locator("[data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · (as of |date not available yet)/);
      }
      // Every card loaded: a value, a hatch for 1 ≤ n < 11, or the n = 0 words; never an error or "not available" against the seed.
      for (const t of await tiles.all()) await expect(t).toHaveAttribute("data-state", /^(value|suppressed|no-data)$/);
      await expect(page.locator("#main").getByRole("link", { name: "Team dashboard" })).toBeVisible();
      await noOverflow(page, width);
      expect(await axe(page), `axe @ ${width}`).toEqual([]);
    }
  });
}

test("/home sends every role to its own home; signed out it asks for sign-in", async ({ page }) => {
  for (const [email, home] of [["admin@example.test", "/admin"], ["staff@example.test", "/staff"], ["board@example.test", "/board"]] as const) {
    await signIn(page, email);
    await page.goto("/home");
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await page.context().clearCookies();
  }
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fhome$/);
});

test("team dashboard shows the last four quarters of M2, M3 and M5 as line charts with footers (F-401)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    const charts = page.locator("[data-slot=dashboard-trends] [data-picture]");
    // The seed carries four quarters for some metrics only; a metric with n = 0 or every quarter hidden has no picture by design.
    await expect(charts.first()).toBeVisible();
    expect(await charts.count(), "at most M2, M3 and M5").toBeLessThanOrEqual(3);
    for (const c of await charts.all()) {
      await expect(c.getByRole("img")).toHaveAttribute("aria-label", /.+/);
      await expect(c.locator("[data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · (as of |date not available yet)/);
    }
    await noOverflow(page, width);
    expect(await axe(page), `axe @ ${width}`).toEqual([]);
  }
});
