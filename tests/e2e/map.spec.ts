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
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where is the need greatest?");
      await expect(page.locator("[data-slot=page-header] p").first()).toHaveText(eyebrow);
      await expect(page.locator("tbody tr")).toHaveCount(29);
      await expect(page.getByText("Need score not computed yet")).toHaveCount(0);
      // DS-11b: the table from md up; the ranked list below it (both in the DOM, CSS shows one).
      await expect(page.getByRole("region", { name: "County need table" })).toBeVisible({ visible: width >= 768 });
      await expect(page.locator("[data-slot=ranked-list]")).toBeVisible({ visible: width < 768 });
      const rows = page.locator("tbody tr");
      // DS-20c: Key measures by default (the seed loads no scored rate, so County, Rank of N and Need score); the rank cell is the number alone.
      await expect(page.locator("[data-slot=need-table] thead th")).toHaveText(["County", /^Rank of\s26$/, "Need score"]);
      for (const [i, rank, score] of [[0, "1", "+1.40"], [1, "2", "+1.30"]] as const) await expect(rows.nth(i).locator("td")).toHaveText([rank, score]);
      await expect(page.locator("tr[data-fips='49005'] td")).toHaveText(["20", "−0.80"]);
      await expect(page.locator("tr[data-fips='49011'] td")).toHaveText(["20", "−0.80"]);
      await expect(page.getByRole("switch", { name: "Show FAS counties only" })).toHaveAttribute("aria-checked", "false");
      await expect(page.locator("tbody tr [data-slot=badge]")).toHaveCount(5);
      await expect(page.locator("tr[data-fips='49005'] [data-slot=badge]")).toHaveCount(0);
      await expect(page.locator("tr[data-fips='49005']")).toHaveAttribute("aria-label", "Cache County, rank 20 of 26, need score −0.80");
      await expect(page.locator("tr[data-fips='49009']")).toHaveAttribute("aria-label", "Daggett County, not published");
      await expect(rows.nth(25).locator("td").first()).toHaveText("26");
      for (const [i, name] of ["Daggett", "Piute", "Wayne"].entries()) {
        await expect(rows.nth(26 + i)).toContainText(new RegExp(`${name} County.*Not published.*Not published`));
      }
      await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: .+ · Need score version \S+ · as of \w+ \d{4}$/);
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
    await expect(page.locator("tbody tr").nth(0)).toContainText(/Tooele County.*FAS county.*4\s*\+1\.10/);
    await expect(page.locator("tr[data-fips='49011']")).toContainText(/Davis County.*FAS county.*20\s*−0\.80/);
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

const LEGEND = ["Need score, version v2-synthetic", "Lower need", "Higher need", "Not published · 3 counties", "FAS county (outlined)", "Relative ranking · placeholder bands until FAS sets the weights."];
const TOP_PROMPT = "Select any county on the map or in the table to see why it ranks where it does.";

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
      const legend = page.locator("[data-slot=map-legend]"), swatches = legend.locator("[data-slot=legend-ramp] [data-slot=hint-trigger]");
      for (const text of LEGEND) await expect(legend).toContainText(text);
      // DS-20a: one strip directly under the map (same column), five band swatches named with their counts; "placeholder" said once in the map region (the table header goes in DS-20c).
      await expect(swatches).toHaveCount(5);
      await expect(swatches.first()).toHaveAttribute("aria-label", "Lowest need · 7 counties");
      await expect(swatches.last()).toHaveAttribute("aria-label", "Highest need · 5 counties");
      await expect(map.getByText(/placeholder/i)).toHaveCount(1);
      // The county map itself, not the FAS pin icons in the panel's "Highest need" rows.
      const chart = map.getByRole("group", { name: "Utah county need map" });
      const [mapBox, legendBox] = [await chart.boundingBox(), await legend.boundingBox()];
      expect(legendBox!.y - (mapBox!.y + mapBox!.height)).toBeLessThanOrEqual(32);
      expect(Math.abs(legendBox!.x - mapBox!.x)).toBeLessThanOrEqual(8);
      await expect(map.locator("text").first()).toBeVisible({ visible: width >= 1024 });
      const svg = await chart.boundingBox();
      expect(svg?.height ?? 0).toBeLessThanOrEqual(640);
      expect(svg?.width ?? 0).toBeLessThanOrEqual(width === 375 ? 343 : 696);
      // The map sits above the county rows: the table from 768, the ranked list below it (DS-11b).
      expect(svg?.y ?? 0).toBeLessThan((await page.locator(width >= 768 ? "[data-slot=need-table] tbody" : "[data-slot=ranked-list] ol").boundingBox())?.y ?? 0);
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
  // Level 2: the panel also has "Key measures" and source-group headings (DS-20b).
  const heading = panel.getByRole("heading", { level: 2 });
  for (const width of [375, 800, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    // DS-20a: before a pick the panel answers the page's question with the five highest-need counties.
    await expect(heading).toHaveText("Highest need");
    await expect(panel.locator("[data-slot=top-counties] li[data-fips]")).toHaveCount(5);
    await expect(panel.locator("[data-slot=top-counties] li[data-fips]").first()).toContainText(/^1\s*Rich County\s*\+1\.40$/);
    await expect(panel).toContainText(TOP_PROMPT);
    await page.locator("path[data-fips='49035']").click();
    await expect(page).toHaveURL(/\/need-map\?county=49035$/);
    await expect(heading).toContainText("Salt Lake County");
    await expect(panel.locator("[data-slot=badge]")).toHaveText(/FAS county$/);
    // DS-20b: the rank in words with its band, then the score; every measure behind one closed disclosure, one source line per group.
    await expect(panel.locator("[data-slot=rank-line]")).toContainText(/^(Highest need|\d+(st|nd|rd|th) highest need) of 26 counties scored · [A-Z][a-z ]+ band\s*Need score [+−]\d\.\d\d · version \S+$/);
    const details = panel.locator("[data-slot=all-measures]"), summary = details.locator("summary");
    await expect(details).not.toHaveAttribute("open");
    await expect(summary).toHaveText(/^All measures \(\d+\)$/);
    await expect(details.locator("[data-slot=panel-indicator]").first()).toBeHidden();
    if (width < 1024) expect((await summary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(details).toHaveAttribute("open", "");
    await expect(details.locator("[data-slot=measure-group]").first().getByRole("heading", { level: 3 })).toHaveText("Health coverage");
    await expect(details.locator("[data-slot=source-footer]").first()).toHaveText(/^Census SAHIE \d{4} · as of \w+ \d{4}$/);
    await expect(details.locator("[data-slot=panel-indicator] [data-slot=source-footer]")).toHaveCount(0);
    await expect(page.locator("path[data-fips='49035']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("path[data-selected-outline='49035']")).toHaveCount(1);
    await expect(page.locator("path[aria-pressed='true']")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await page.screenshot({ path: `${ART_B}/need-map-selected-${width}.png`, fullPage: true });
  }
  await page.goto("/need-map?fas=1");
  await expect(heading).toHaveText("Highest need among FAS counties");
  await expect(panel.locator("[data-slot=top-counties] li[data-fips]").first()).toContainText(/Tooele County.*FAS county/);
  await panel.locator("[data-slot=top-counties] li[data-fips='49045'] a").click();
  await expect(page).toHaveURL(/\?county=49045&fas=1$/);
  await expect(heading).toContainText("Tooele County");
  await page.goto("/need-map?fas=1&county=49011");
  await expect(heading).toContainText("Davis County");
  await page.locator("tr[data-fips='49049'] a").click();
  await expect(page).toHaveURL(/\?county=49049&fas=1$/);
  await expect(heading).toContainText("Utah County");
  await page.goto("/need-map?county=49035");
  // The page streams in behind a skeleton (DS-14); retry until the map's key handler is hydrated and the arrow moves focus.
  await expect(async () => {
    await page.locator("path[data-fips='49035']").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("path[data-fips='49043']")).toBeFocused({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("path[data-fips='49051']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\?county=49051$/);
  await expect(heading).toContainText("Wasatch County");
  await page.locator("path[data-fips='49051']").focus();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/need-map$/);
  await expect(heading).toHaveText("Highest need");
  await expect(page.locator("path[aria-pressed='true']")).toHaveCount(0);
});

// DS-11a: one explain card for every table cell (pointer, focus, Enter pins a dialog, Escape closes, arrows walk), header cards, panel provenance, median hint.
test("explain layer: hover, focus and Enter show the same words on a cell; Esc closes; headers, panel footers and the median tick explain themselves", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const card = page.locator("[data-slot=explain-layer-card]"), panel = page.locator("[data-slot=county-panel]"), dialog = page.getByRole("dialog");
  const cell = page.locator("tr[data-fips='49005'] td[data-term='rank']");
  for (const width of [1024, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map?county=49035");
    await expect(card).toHaveCount(0);
    await cell.hover();
    await expect(card).toContainText(/^Rank.*20 of 26.*Need score version/s);
    await expect(card).not.toHaveAttribute("role", "dialog");
    const words = await card.innerText();
    await page.mouse.move(0, 0);
    await expect(card).toHaveCount(0);
    await cell.focus();
    expect(await card.innerText()).toBe(words);
    await page.keyboard.press("Enter");
    await expect(card).toHaveAttribute("role", "dialog");
    expect(await dialog.innerText()).toBe(words);
    await expect(dialog).toHaveAccessibleName("Rank");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(cell).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("tr[data-fips='49005'] td[data-term='need_score']")).toBeFocused();
    await expect(card).toContainText("County need score");
    await page.locator("tr[data-fips='49009'] td[data-term='rank']").hover();
    await expect(card).toContainText("The source did not publish this for this county in that release.");
    await page.locator("tr[data-fips='49035'] [data-slot=badge][data-term='fas_county']").hover();
    await expect(card).toContainText("A county where FAS currently funds therapy.");
    await page.goto("/need-map");
    await page.locator("[data-slot=top-counties] li[data-fips='49033'] [data-term='need_score']").hover();
    await expect(card).toContainText(/County need score.*\+1\.40.*Need score version/s);
    await page.goto("/need-map?county=49035");
    await page.locator("tr[data-fips='49035'] [data-slot=badge][data-term='fas_county']").hover();
    await expect(card).toContainText("A county where FAS currently funds therapy.");
    await page.mouse.move(0, 0);
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.locator("thead [data-slot=explain-trigger]", { hasText: "Rank" }).hover();
  await expect(page.locator("[data-slot=hover-card-content]")).toContainText("This county's place among the counties that have a score, 1 being the highest need.");
  await panel.locator("[data-slot=all-measures] summary").click();
  await panel.locator("[data-slot=source-footer] [data-slot=explain-trigger]").first().click();
  await expect(dialog).toContainText(/Census SAHIE.*Source.*Census SAHIE.*As of.*Period\s*\d{4}/s);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const median = panel.locator("[data-slot=compare-bars] [data-slot=hint-trigger]");
  if (await median.count()) {
    await median.hover();
    await expect(page.locator("[data-slot=tooltip-content]")).toContainText("The middle Utah county for this measure");
  }
});

// DS-11b: one card for the 29 county paths (pointer, arrow-key focus and the selected county show the same words), legend hints, rank labels from 1024.
test("map hover card: hover, focus and the selected county show the same words; it follows arrow keys, explains a hatched county and stays inside the figure", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const card = page.locator("[data-slot=map-hover-card]"), davis = page.locator("path[data-fips='49011']");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    await expect(card).toHaveCount(0);
    await davis.hover();
    await expect(card).toContainText(/^Davis County.*A higher need score than 6 of the 25 other counties scored.*Rank.*20 of 26.*Need score.*−0\.80.*Band.*Lowest need \(1 of 5\).*FAS county.*Yes, FAS funds therapy here.*Source.*Need score version/s);
    const words = await card.innerText();
    const [box, figure] = [await card.boundingBox(), await page.locator("[data-slot=map-hover]").boundingBox()];
    expect(box!.x + box!.width).toBeLessThanOrEqual(figure!.x + figure!.width + 1);
    expect(box!.x).toBeGreaterThanOrEqual(figure!.x - 1);
    await page.mouse.move(0, 0);
    await expect(card).toHaveCount(0);
    await davis.focus();
    expect(await card.innerText()).toBe(words);
    await page.keyboard.press("ArrowRight");
    // Davis County's neighbour to the right is Morgan County (49029), per NeedNeighbors.toward.
    await expect(page.locator("path[data-fips='49029']")).toBeFocused();
    await expect(card).toHaveAttribute("data-fips", "49029");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\?county=49029$/);
    await page.locator("path[data-fips='49009']").hover();
    await expect(card).toContainText(/Daggett County.*No need score, so no rank or band.*Why it's hidden.*The source did not publish this for this county in that release\./s);
    await page.locator("[data-slot=map-legend] [data-slot=hint-trigger]").first().hover();
    await expect(page.locator("[data-slot=tooltip-content]")).toContainText(/^Need scores −\d\.\d\d to −\d\.\d\d, \d+ counties\. Band 1 of 5: equal-count placeholder bands until FAS sets the final weights\.$/);
    await expect(page.locator("[data-slot=need-map] text").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
  }
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
  test("375: a tap selects the county and shows its card with the hover words; the ranked list has 29 rows that open the panel; no sideways scroll", async ({ page }) => {
    await signIn(page, "staff@example.test");
    await page.goto("/need-map");
    const card = page.locator("[data-slot=map-hover-card]"), list = page.locator("[data-slot=ranked-list]"), rows = list.locator("li[data-fips]");
    await page.locator("path[data-fips='49011']").tap();
    await expect(page).toHaveURL(/\?county=49011$/);
    await expect(card).toHaveAttribute("data-fips", "49011");
    await expect(card).toContainText(/^Davis County.*Rank.*20 of 26.*Band.*Lowest need \(1 of 5\).*FAS county/s);
    await expect(list).toBeVisible();
    await expect(page.getByRole("region", { name: "County need table" })).toBeHidden();
    await expect(rows).toHaveCount(29);
    await expect(rows.nth(0)).toContainText(/^1Rich County\+1\.40\s*Highest need\s*$/);
    await expect(rows.nth(3)).toContainText(/^4Tooele County\+1\.10\s*Highest need\s*FAS county\s*$/);
    await expect(rows.nth(26)).toContainText(/Daggett County\s*Not published\s*No need score/);
    expect((await rows.nth(0).locator("a").boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await rows.nth(0).locator("a").tap();
    await expect(page).toHaveURL(/\?county=49033#county-panel$/);
    const panel = page.locator("[data-slot=county-panel]");
    await expect(panel.getByRole("heading", { level: 2 })).toContainText("Rich County");
    await expect(panel).toBeInViewport();
  });
});

// DS-20c: Key measures by default fit the content column; All measures scroll sideways in a fixed order; the switch keeps the filter and the pick; the selected row is marked.
test("county table: Key | All switch, no sideways scroll in Key at 1024 and 1440, selected row marked, sticky header", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const box = page.getByRole("region", { name: "County need table" }), view = page.getByRole("navigation", { name: "Columns to show" });
  const [key, all] = [view.getByRole("link", { name: "Key measures" }), view.getByRole("link", { name: "All measures" })];
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map?county=49011");
    await expect(page.getByRole("heading", { level: 2, name: "All 29 counties" })).toBeVisible();
    await expect(key).toHaveAttribute("aria-current", "true");
    await expect(box.locator("thead th")).toHaveCount(3);
    await expect(box.locator("thead")).not.toContainText(/Status|placeholder/);
    expect(await box.evaluate((el) => [el.scrollWidth <= el.clientWidth, getComputedStyle(el).overflowX, getComputedStyle(el).borderTopWidth])).toEqual([true, "visible", "1px"]);
    await expect(page.locator("tbody tr[aria-current='true']")).toHaveCount(1);
    await expect(page.locator("tr[data-fips='49011']")).toHaveAttribute("data-selected", "true");
    // The header row sticks under the 56 px top bar once the page scrolls into the table.
    await page.evaluate(() => window.scrollBy(0, 1600));
    await expect.poll(async () => Math.abs(((await box.locator("thead th").first().boundingBox())?.y ?? 0) - 56)).toBeLessThanOrEqual(2);
    await all.click();
    await expect(page).toHaveURL(/\/need-map\?county=49011&cols=all$/);
    await expect(all).toHaveAttribute("aria-current", "true");
    await expect(box.locator("thead th")).toHaveText(["County", /^Rank of\s26$/, "Need score", "Uninsured"]);
    expect(await box.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
    await expect(page.locator("[data-slot=need-table-sources]")).toHaveText(/^Sources: Census SAHIE \d{4}\./);
    await expect(page.locator("tr[data-fips='49011']")).toHaveAttribute("aria-current", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
  }
  await page.goto("/need-map?fas=1&county=49035&cols=all");
  await expect(page.getByRole("heading", { level: 2, name: "All 5 FAS counties" })).toBeVisible();
  await expect(key).toHaveAttribute("href", "/need-map?county=49035&fas=1");
  await page.locator("tr[data-fips='49049'] a").click();
  await expect(page).toHaveURL(/\?county=49049&fas=1&cols=all$/);
  await key.click();
  await expect(page).toHaveURL(/\/need-map\?county=49049&fas=1$/);
  await page.setViewportSize({ width: 800, height: 900 });
  for (const link of [key, all]) expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
});
