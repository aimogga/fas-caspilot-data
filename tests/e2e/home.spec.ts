import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** DS-10a staff and admin home: dated greeting, one sentence, three explained KPI cards, public sources beside the quick links. */
test.setTimeout(120_000);
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));
const WEEKDAY = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}$/i;

for (const [email, path, primary, heading] of [["staff@example.test", "/staff", "Upload data", "What do you need to do?"], ["admin@example.test", "/admin", "Open team dashboard", "Where to look"]] as const) {
  test(`${path}: dated eyebrow, greeting, summary sentence, three KPI cards with explain cards and chips, sources two-up (DS-10a)`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      // AC1: eyebrow is weekday + date; the H1 greets by time of day; the seed has no full name, so no name follows.
      await expect(page.locator("[data-slot=page-header] p").first()).toHaveText(WEEKDAY);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening)$/);
      await expect(page.locator("[data-slot=page-header]").getByRole("link", { name: primary })).toBeVisible();
      // AC2: one sentence in words, never an example number from the artboard.
      await expect(page.locator("[data-slot=home-summary]")).toHaveText(/^(Families|Too few families|No first sessions|This quarter's numbers)/);
      // AC3 + AC4: three cards; every state is named; the hatch only with a footer n between 1 and 10.
      const tiles = page.locator("[data-slot=home-tile]");
      await expect(tiles).toHaveCount(3);
      expect(await tiles.evaluateAll((els) => els.map((e) => e.getAttribute("data-metric")))).toEqual(["m1", "m2", "m4"]);
      for (const t of await tiles.all()) {
        await expect(t).toHaveAttribute("data-state", /^(value|suppressed|no-data|not-available|error)$/);
        await expect(t.locator("h2 [data-slot=explain-trigger]")).toHaveText(/.+/);
        const state = await t.getAttribute("data-state");
        if (state === "suppressed") await expect(t.locator("[data-slot=source-footer]")).toHaveText(/n = ([1-9]|10) ·/);
        if (state === "value") await expect(t.locator("[data-slot=source-footer]")).toContainText(/FAS records · .* · n = \d+ · (as of |date not available yet)/);
        if (state === "no-data") await expect(t).toContainText(/No closed cases this quarter|Not enough closed episodes/);
        await expect(t.locator("[data-slot=suppressed]")).toHaveCount(state === "suppressed" ? 1 : 0);
      }
      // AC3: a chip is a glyph plus words and its hint reads the same on hover and on focus.
      const chip = page.locator("[data-slot=direction] [data-slot=hint-trigger]").first();
      if (await chip.count()) {
        await expect(chip).toHaveText(/^[↓↑→] (Better · |Worse · |Same as last quarter)/);
        await chip.hover();
        const hovered = await page.locator("[data-slot=tooltip-content]").first().textContent();
        await page.mouse.move(0, 0);
        await chip.focus();
        await expect(page.locator("[data-slot=tooltip-content]").first()).toHaveText(hovered ?? "");
        expect(hovered).toMatch(/\(Q[1-4]\)\. (Lower|Higher) is better for this number\.$/);
        await page.keyboard.press("Escape");
      }
      // AC5: public sources with a status word per row, then the freshness link; quick links beside it.
      const sources = page.locator("[data-slot=public-sources]");
      await expect(sources.getByRole("heading", { level: 2 })).toHaveText("Public sources");
      for (const row of await sources.locator("li").all()) await expect(row.locator("[data-slot=badge]")).toHaveText(/Current|Stale|Failed|Not published/);
      await expect(sources.getByRole("link", { name: "Open data freshness" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      // AC6: no overflow, 44 px controls below 1024, axe clean.
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBe(width);
      if (width < 1024) {
        const small = await page.locator("#main").evaluate((main) => [...main.querySelectorAll("a, button")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44)).length);
        expect(small, `controls under 44px @ ${width}`).toBe(0);
      }
      expect(await axe(page), `axe @ ${width}`).toEqual([]);
    }
  });
}
