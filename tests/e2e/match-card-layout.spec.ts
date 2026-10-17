import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// DS-26a: nothing in a match card runs past its edge at 768, 1024 and 1440; flag chips stay one line; the band badge stays beside the score.
async function signIn(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "staff@example.test");
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

/** Per card: text of any descendant wider than the card or past its right edge; plus whether the page scrolls sideways.
 * A truncated chip's text span reports its full text as scrollWidth by design (AC 2); it counts only if its box passes the card edge. */
const overflow = (page: Page) => page.evaluate(() => ({
  cards: [...document.querySelectorAll<HTMLElement>("li[data-match]")].flatMap((card) => {
    const edge = card.getBoundingClientRect().right;
    return [...card.querySelectorAll<HTMLElement>("*")].filter((e) => (e.scrollWidth > card.clientWidth && getComputedStyle(e).textOverflow !== "ellipsis") || e.getBoundingClientRect().right > edge + 0.5).map((e) => (e.textContent ?? "").trim().slice(0, 40));
  }),
  page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
}));

test("match cards fit their width with one-line flag chips, at 768, 1024 and 1440", async ({ page }) => {
  await signIn(page);
  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto("/staff/grants/matches"))?.status()).toBe(200);
    // D-034: act only once React owns the list, so the injected chip text below is never a hydration mismatch.
    await page.locator("ol[data-slot=match-list][data-hydrated]").waitFor();
    const rows = page.locator("ol[data-slot=match-list] > li[data-match]");
    await expect(rows).toHaveCount(2);
    expect(await overflow(page)).toEqual({ cards: [], page: false });
    // A long stored reason stays one line with an ellipsis; the chip never becomes a tall pill and the card still fits.
    const chip = rows.nth(1).locator("[data-slot=flag]");
    await expect(chip).toHaveText("Only state governments may apply");
    await chip.locator(".truncate").evaluate((e) => { e.textContent = "Could not check the applicant type because the listing names several groups in a long free-text note"; });
    expect(await chip.evaluate((e) => e.getBoundingClientRect().height)).toBeLessThanOrEqual(24);
    expect(await chip.locator(".truncate").evaluate((e) => e.scrollWidth > e.clientWidth && getComputedStyle(e).textOverflow === "ellipsis")).toBe(true);
    expect(await overflow(page)).toEqual({ cards: [], page: false });
    // The strategy button keeps its four-word name whatever its visible label; below 1024 it stays a 44 px target.
    const draft = rows.first().getByRole("button", { name: "Draft a response strategy" });
    await expect(draft).toBeVisible();
    if (width < 1024) expect(await draft.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    // F-504d: the band badge stays in the score block, beside the score tile.
    await expect(rows.nth(1).locator("[data-slot=fit-band]").locator("xpath=ancestor::div[1]").locator("[data-slot=fit-score]")).toHaveCount(1);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  }
});
