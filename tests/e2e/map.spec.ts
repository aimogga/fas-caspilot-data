import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Each map test loads the page up to 8 times (2 color schemes × 4 widths) with an axe scan and a full-page screenshot
// per load, against the dev server with parallel workers; the default 30 s budget timed out in CI (run 38615882214).
test.setTimeout(180_000);

const ART = "/opt/cursor/artifacts/ds-06a2";
const ART_B = "/opt/cursor/artifacts/ds-06b";
const FAS = ["49035", "49049", "49011", "49057", "49045"];

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

for (const [email, eyebrow] of [["staff@example.test", "WORKSPACE"], ["admin@example.test", "WORKSPACE"], ["board@example.test", "BOARD"]] as const) {
  test(`need-map table for ${email}`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 800, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto("/need-map");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("County need map");
      await expect(page.locator("[data-slot=page-header] p").first()).toHaveText(eyebrow);
      await expect(page.locator("tbody tr")).toHaveCount(29);
      await expect(page.getByText("Need score not computed yet")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "County need table" })).toBeVisible();
      const rows = page.locator("tbody tr");
      await expect(rows.nth(0)).toContainText(/Rich County.*1 of 26.*\+1\.40.*5 of 5.*Ranked/);
      await expect(rows.nth(1)).toContainText(/San Juan County.*2 of 26/);
      await expect(page.locator("tr[data-fips='49005']")).toContainText(/20 of 26.*−0\.80.*1 of 5/);
      await expect(page.locator("tr[data-fips='49011']")).toContainText(/20 of 26.*−0\.80.*1 of 5/);
      await expect(page.getByRole("switch", { name: "Show FAS counties only" })).toHaveAttribute("aria-checked", "false");
      await expect(page.locator("tbody tr [data-slot=badge]")).toHaveCount(5);
      await expect(page.locator("tr[data-fips='49005'] [data-slot=badge]")).toHaveCount(0);
      await expect(page.locator("tr[data-fips='49005']")).toHaveAttribute("aria-label", "Cache County, rank 20 of 26, need score −0.80");
      await expect(page.locator("tr[data-fips='49009']")).toHaveAttribute("aria-label", "Daggett County, not published");
      await expect(rows.nth(25)).toContainText(/Morgan County.*26 of 26/);
      for (const [i, name] of ["Daggett", "Piute", "Wayne"].entries()) {
        await expect(rows.nth(26 + i)).toContainText(new RegExp(`${name} County.*Not published.*Not published`));
      }
      await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: .+ · Need score version \S+ · as of \w+ \d{4} · Placeholder bins$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations).toEqual([]);
    }
  });
}

test("board: FAS county badges, and the switch filters to seeded FAS counties via ?fas=1", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    const toggle = page.getByRole("switch", { name: "Show FAS counties only" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("tbody tr")).toHaveCount(29);
    for (const fips of FAS) {
      await expect(page.locator(`tr[data-fips='${fips}'] [data-slot=badge]`)).toHaveText(/FAS county$/);
      await expect(page.locator(`tr[data-fips='${fips}']`)).toHaveAttribute("aria-label", /, FAS county$/);
    }
    await page.screenshot({ path: `${ART}/need-map-${width}.png`, fullPage: true });
    await toggle.click();
    await expect(page).toHaveURL(/\/need-map\?fas=1$/);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.locator("tbody tr")).toHaveCount(5);
    await expect(page.locator("tbody tr [data-slot=badge]")).toHaveCount(5);
    await expect(page.locator("tbody tr").nth(0)).toContainText(/Tooele County.*FAS county.*4 of 26.*\+1\.10/);
    await expect(page.locator("tr[data-fips='49011']")).toContainText(/Davis County.*FAS county.*20 of 26.*−0\.80/);
    await expect(page.getByText("No FAS counties set")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await page.screenshot({ path: `${ART}/need-map-fas-${width}.png`, fullPage: true });
    await toggle.click();
    await expect(page).toHaveURL(/\/need-map$/);
    await expect(page.locator("tbody tr")).toHaveCount(29);
  }
});

const LEGEND = ["Need score (version v2-synthetic) · Placeholder bins", "Lowest −1.40 to −0.80", "Highest +1.00 to +1.40", "Not published", "FAS county (outlined)", "Placeholder bins (5 equal-count groups) until need-score weights are set.", "Relative ranking, not absolute need."];

test("map: 29 county paths above the table, legend copy, FAS outlines, hatch; light and dark screenshots", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [375, 800, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/need-map");
      const map = page.locator("[data-slot=need-map]");
      await expect(map.locator("path[data-fips][tabindex='0'][role=button]")).toHaveCount(29);
      await expect(map.locator("path[data-fas-outline]")).toHaveCount(5);
      await expect(map.locator("path[data-bin='0']")).toHaveCount(3);
      await expect(map.locator("path[data-fips='49009']")).toHaveAttribute("aria-label", "Daggett County, not published");
      await expect(map.locator("path[data-fips='49011']")).toHaveAttribute("aria-label", "Davis County, rank 20 of 26, need score −0.80, FAS county");
      for (const text of LEGEND) await expect(page.locator("[data-slot=map-legend]")).toContainText(text);
      await expect(map.locator("text").first()).toBeVisible({ visible: width >= 1440 });
      const svg = await map.locator("svg").boundingBox();
      expect(svg?.height ?? 0).toBeLessThanOrEqual(640);
      expect(svg?.width ?? 0).toBeLessThanOrEqual(width === 375 ? 343 : 696);
      expect(svg?.y ?? 0).toBeLessThan((await page.locator("tbody").boundingBox())?.y ?? 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations).toEqual([]);
      await page.screenshot({ path: `${ART_B}/need-map-${width}-${colorScheme}.png`, fullPage: true });
    }
  }
  await page.goto("/need-map?fas=1");
  const map = page.locator("[data-slot=need-map]");
  await expect(map.locator("path[data-fips][tabindex='0']")).toHaveCount(29);
  await expect(map.locator("path[data-dim='true']")).toHaveCount(24);
  await expect(map.locator("path[data-fas-outline]")).toHaveCount(5);
  await expect(map.locator("path[data-fips='49005']")).toHaveAttribute("aria-label", "Cache County, rank 20 of 26, need score −0.80");
});

test("county selection: click or ?county= selects, panel copy, table link, arrows move to a neighbour, Enter selects, Esc clears", async ({ page }) => {
  await signIn(page, "board@example.test");
  const panel = page.locator("[data-slot=county-panel]");
  const heading = panel.getByRole("heading");
  for (const width of [375, 800, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    await expect(panel).toContainText("Select a county on the map or in the table.");
    await page.locator("path[data-fips='49035']").click();
    await expect(page).toHaveURL(/\/need-map\?county=49035$/);
    await expect(heading).toContainText("Salt Lake County");
    await expect(panel.locator("[data-slot=badge]")).toHaveText(/FAS county$/);
    await expect(panel).toContainText(/Rank \d+ of 26 · Need score [+−]\d\.\d\d/);
    await expect(panel.locator("[data-slot=panel-indicator] [data-slot=source-footer]").first()).toHaveText(/^Census SAHIE · \d{4} · as of \w+ \d{4}$/);
    await expect(page.locator("path[data-fips='49035']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("path[data-selected-outline='49035']")).toHaveCount(1);
    await expect(page.locator("path[aria-pressed='true']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await page.screenshot({ path: `${ART_B}/need-map-selected-${width}.png`, fullPage: true });
  }
  await page.goto("/need-map?fas=1&county=49011");
  await expect(heading).toContainText("Davis County");
  await page.locator("tr[data-fips='49049'] a").click();
  await expect(page).toHaveURL(/\?county=49049&fas=1$/);
  await expect(heading).toContainText("Utah County");
  await page.goto("/need-map?county=49035");
  await page.locator("path[data-fips='49035']").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("path[data-fips='49043']")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("path[data-fips='49051']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?county=49051$/);
  await expect(heading).toContainText("Wasatch County");
  await page.locator("path[data-fips='49051']").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/need-map$/);
  await expect(panel).toContainText("Select a county on the map or in the table.");
  await expect(page.locator("path[aria-pressed='true']")).toHaveCount(0);
});
