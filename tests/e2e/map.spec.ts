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
  test(`need-map shows one county at a time for ${email}`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 800, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const res = await page.goto("/need-map");
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Where is the need greatest?");
      await expect(page.locator("[data-slot=page-header] p").first()).toHaveText(eyebrow);
      await expect(page.getByText("Need score not computed yet")).toHaveCount(0);
      // DS-22: no county table and no ranked list; the picker and the panel are the way in.
      await expect(page.locator("table")).toHaveCount(0);
      await expect(page.locator("[data-slot=need-table], [data-slot=ranked-list]")).toHaveCount(0);
      await expect(page.getByRole("switch", { name: "Show FAS counties only" })).toHaveAttribute("aria-checked", "false");
      await expect(page.locator("[data-slot=top-counties] li[data-fips]")).toHaveCount(5);
      await expect(page.locator("[data-slot=top-counties] li[data-fips]").first()).toContainText(/Rich County/);
      await expect(page.locator("path[data-fips][role=button]")).toHaveCount(29);
      await expect(page.locator("[data-slot=source-footer]").last()).toContainText(/^Public sources: .+ · Need score version \S+ · as of \w+ \d{4}$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations).toEqual([]);
    }
  });
}

test("board: the switch limits the map's panel and menu to seeded FAS counties via ?fas=1", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    const toggle = page.getByRole("switch", { name: "Show FAS counties only" }), picker = page.getByLabel("Choose a county");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(picker.locator("option")).toHaveCount(30);
    for (const fips of FAS) await expect(page.locator(`path[data-fips='${fips}']`)).toHaveAttribute("aria-label", /, FAS county$/);
    await page.screenshot({ path: `${ART}/need-map-${width}.png`, fullPage: true });
    await toggle.click();
    await expect(page).toHaveURL(/\/need-map\?fas=1$/);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(picker.locator("option")).toHaveCount(6);
    await expect(page.locator("[data-slot=top-counties] li[data-fips]")).toHaveCount(5);
    await expect(page.locator("[data-slot=top-counties] li").first()).toContainText(/Tooele County.*FAS county.*\+1\.10/);
    await expect(page.getByText("No FAS counties set")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
    await page.screenshot({ path: `${ART}/need-map-fas-${width}.png`, fullPage: true });
    await toggle.click();
    await expect(page).toHaveURL(/\/need-map$/);
    await expect(picker.locator("option")).toHaveCount(30);
  }
});

const LEGEND = ["Need score, version v2-synthetic", "Lower need", "Higher need", "Not published · 3 counties", "FAS county (outlined)", "Relative ranking · placeholder bands until FAS sets the weights."];
const TOP_PROMPT = "Pick a county on the map or from the menu above to see why it ranks where it does.";

test("map: 29 county paths, legend copy, FAS outlines, hatch; light and dark screenshots", async ({ page }) => {
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
      // DS-20a: one strip directly under the map (same column), five band swatches named with their counts; "placeholder" said once in the map region.
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

test("county selection: click or ?county= selects, panel copy, top-five link, arrows move to a neighbour, Enter selects, Esc clears", async ({ page }) => {
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
  await page.getByLabel("Choose a county").selectOption("49049");
  await expect(page).toHaveURL(/\?fas=1&county=49049$/);
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

// DS-11a, DS-22: one explain card for the rank and score cells of the "Highest need" rows (pointer, focus, Enter pins a dialog, Escape closes), header cards, panel provenance, median hint.
test("explain layer: hover, focus and Enter show the same words on a cell; Esc closes; headers, panel footers and the median tick explain themselves", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const card = page.locator("[data-slot=explain-layer-card]"), panel = page.locator("[data-slot=county-panel]"), dialog = page.getByRole("dialog");
  const row = page.locator("[data-slot=top-counties] li[data-fips='49033']"), cell = row.locator("[data-term='rank']");
  for (const width of [1024, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/need-map");
    await expect(card).toHaveCount(0);
    await cell.hover();
    await expect(card).toContainText(/^Rank.*1 of 26.*Need score version/s);
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
    await row.locator("[data-term='need_score']").hover();
    await expect(card).toContainText(/County need score.*\+1\.40.*Need score version/s);
    await page.locator("[data-slot=top-counties] li[data-fips='49045'] [data-slot=badge][data-term='fas_county']").hover();
    await expect(card).toContainText("A county where FAS currently funds therapy.");
    await page.mouse.move(0, 0);
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/need-map");
  await page.locator("[data-slot=top-counties] [data-slot=explain-trigger]", { hasText: "Rank" }).hover();
  await expect(page.locator("[data-slot=hover-card-content]")).toContainText("This county's place among the counties that have a score, 1 being the highest need.");
  await page.goto("/need-map?county=49035");
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
  test("375: a tap selects the county and shows its card with the hover words; the menu shows it; no table or list; no sideways scroll", async ({ page }) => {
    await signIn(page, "staff@example.test");
    await page.goto("/need-map");
    const card = page.locator("[data-slot=map-hover-card]");
    await page.locator("path[data-fips='49011']").tap();
    await expect(page).toHaveURL(/\?county=49011$/);
    await expect(card).toHaveAttribute("data-fips", "49011");
    await expect(card).toContainText(/^Davis County.*Rank.*20 of 26.*Band.*Lowest need \(1 of 5\).*FAS county/s);
    await expect(page.getByLabel("Choose a county")).toHaveValue("49011");
    await expect(page.locator("table, [data-slot=ranked-list]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations).toEqual([]);
  });
});

// DS-22: the menu and the map drive the same county panel.
test("county picker: A to Z with (no score), FAS limits it, choosing sets ?county= and keeps fas, the placeholder clears it, map and menu stay in sync, 44 px below 1024", async ({ page }) => {
  await signIn(page, "board@example.test");
  const picker = page.getByLabel("Choose a county"), heading = page.locator("[data-slot=county-panel]").getByRole("heading", { level: 2 });
  await page.goto("/need-map");
  await expect(picker).toHaveValue("");
  const labels = await picker.locator("option").allTextContents();
  expect(labels[0]).toBe("Select a county…");
  expect(labels.slice(1)).toEqual([...labels.slice(1)].sort((a, b) => a.localeCompare(b)));
  expect(labels).toHaveLength(30);
  expect(labels).toContain("Daggett County (no score)");
  expect(labels).toContain("Salt Lake County");
  await picker.selectOption("49035");
  await expect(page).toHaveURL(/\/need-map\?county=49035$/);
  await expect(heading).toContainText("Salt Lake County");
  await expect(page.locator("path[data-fips='49035']")).toHaveAttribute("aria-pressed", "true");
  await page.locator("path[data-fips='49051']").click();
  await expect(picker).toHaveValue("49051");
  await picker.selectOption("");
  await expect(page).toHaveURL(/\/need-map$/);
  await expect(heading).toHaveText("Highest need");
  await page.goto("/need-map?fas=1");
  await expect(picker.locator("option")).toHaveCount(6);
  await picker.selectOption("49049");
  await expect(page).toHaveURL(/\?fas=1&county=49049$/);
  await picker.selectOption("");
  await expect(page).toHaveURL(/\/need-map\?fas=1$/);
  for (const width of [375, 800]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await picker.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

for (const email of ["staff@example.test", "admin@example.test", "board@example.test"]) {
  test(`county picker is axe clean for ${email}, with a county and with none, light and dark`, async ({ page }) => {
    await signIn(page, email);
    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      for (const url of ["/need-map", "/need-map?county=49035"]) {
        await page.goto(url);
        await expect(page.getByLabel("Choose a county")).toBeVisible();
        const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(violations).toEqual([]);
      }
    }
  });
}

// DS-23: the selected county is unmistakable and the map follows the scroll from 1024. (Axe with a county selected, light and dark, is the test above.)
async function openAllMeasures(page: Page) {
  await page.locator("[data-slot=county-panel] summary").filter({ hasText: "All measures" }).click();
}
const MAP = (page: Page) => page.getByRole("group", { name: "Utah county need map" });
const scrollTo = (page: Page, y: number) => page.evaluate((top) => window.scrollTo(0, top), y);

for (const [width, height] of [[1440, 900], [1024, 768]]) {
  test(`the map stays in view while the panel scrolls at ${width}x${height}`, async ({ page }) => {
    await signIn(page, "board@example.test");
    await page.setViewportSize({ width, height });
    await page.goto("/need-map?county=49035");
    await openAllMeasures(page);
    // The seed has few measures, so the panel may be short: give the panel's column enough height to scroll, as a county with every measure open would.
    await page.evaluate(() => {
      const spacer = document.createElement("div");
      spacer.style.height = "1400px";
      spacer.setAttribute("aria-hidden", "true");
      document.querySelector("[data-slot=county-panel]")?.parentElement?.appendChild(spacer);
    });
    const legend = page.locator("[data-slot=map-legend]");
    const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(max).toBeGreaterThan(400);
    await scrollTo(page, 300);
    const stuck = (await MAP(page).boundingBox())?.y ?? -1;
    expect(stuck).toBeGreaterThan(0);
    for (let y = 300; y <= max + 300; y += 300) {
      await scrollTo(page, Math.min(y, max));
      const box = await MAP(page).boundingBox(), caption = await legend.boundingBox();
      expect(Math.abs((box?.y ?? -99) - stuck)).toBeLessThanOrEqual(2);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
      expect(caption?.y ?? -1).toBeGreaterThanOrEqual(0);
      expect((caption?.y ?? 0) + (caption?.height ?? 0)).toBeLessThanOrEqual(height);
    }
    // The hover card still lands on the county after scrolling.
    const county = (await page.locator("path[data-fips='49049']").boundingBox())!;
    await page.mouse.move(county.x + county.width / 2, county.y + county.height / 2);
    const card = (await page.locator("[data-slot=map-hover-card]").boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.y + card.height).toBeLessThanOrEqual(height + 1);
  });
}

test("the selected county is full strength with a 3 px outline and the others dim, light and dark", async ({ page }) => {
  await signIn(page, "board@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/need-map");
    await expect(page.locator("path[data-dimmed]")).toHaveCount(0);
    await page.goto("/need-map?county=49035");
    await expect(page.locator("path[data-selected='true']")).toHaveCount(1);
    await expect(page.locator("path[data-dimmed='true']")).toHaveCount(28);
    await expect(page.locator("path[data-selected-outline='49035']")).toHaveCSS("stroke-width", "3px");
    await expect(page.locator("path[data-selected-halo='49035']")).toHaveCSS("stroke-width", "6px");
    await expect(page.locator("path[data-fips='49035']")).toHaveCSS("opacity", "1");
    await expect(page.locator("path[data-fips='49049']")).toHaveCSS("opacity", "0.55");
  }
});

test("at 375 the map is not sticky and the page does not scroll sideways", async ({ page }) => {
  await signIn(page, "board@example.test");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/need-map?county=49035");
  await openAllMeasures(page);
  await scrollTo(page, 1600);
  expect((await MAP(page).boundingBox())?.y ?? 0).toBeLessThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
