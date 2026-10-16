import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

// Expected text is the seed's stored match_result.components / flags (supabase/seed.sql, F-504 block); the panel must not recompute.
const TOP_REASON = "Matched 3 of 5 configured themes: therapy (description), mental health (description), court-involved families (description)";
const CAP_NOTE = "Capped at 0 by a blocker: Score capped at 0: Only state governments may apply";

test("board gets 403 on /staff/grants/matches", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/grants/matches"))?.status()).toBe(403);
});

test("staff sees seeded matches by score and the How we matched panel shows only stored reasons, in words", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto("/staff/grants/matches"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grant matches");
    await expect(page.locator("[data-slot=page-header] p")).toHaveText(["WORKSPACE", "Scored against the v0-synthetic-test rules · 2 open opportunities · as of Oct 2026"]);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("2 open opportunities, best fit first");
    const rows = page.locator("ol[data-slot=match-list] > li[data-match]");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator("h3")).toHaveText("Family Therapy Access Grants (synthetic)");
    await expect(rows.nth(0).locator("[data-slot=match-meta]")).toHaveText("Synthetic Agency for Families · closes Dec 15, 2027 · $50,000–$200,000");
    await expect(rows.nth(0).locator("[data-slot=fit-score]")).toHaveText("100");
    await expect(rows.nth(0).locator("[data-slot=match-badges] [data-variant]")).toHaveText(["Eligible", "Not tracked yet"]);
    await expect(rows.nth(1).locator("[data-slot=fit-score]")).toHaveText("0");
    await expect(rows.nth(1).locator("[data-slot=match-badges] [data-variant]")).toHaveText(["Not eligible", "Only state governments may apply", "Not tracked yet"]);
    await expect(page.locator("[data-slot=match-count]")).toHaveCount(0); // two rows: no "Showing k of n", no Show more
    // D-040: the flag badge's card carries the severity words and the stored reason; the capped tile says why its score is 0.
    const flag = rows.nth(1).locator("[data-slot=flag]").locator("xpath=ancestor::button[1]");
    await flag.hover();
    const card = page.locator("[data-slot=hover-card-content] [data-slot=explain-content]");
    await expect(card).toContainText("stops FAS applying as things stand, so the fit score is capped at 0");
    await expect(card).toContainText(/Stored reason\s*Only state governments may apply/);
    await expect(card).toContainText(/Checked from\s*Grant listing · applicant types/);
    await page.mouse.move(0, 0);
    await expect(card).toHaveCount(0);
    const tile = rows.nth(1).locator("[data-slot=explain-trigger]").first();
    await tile.focus();
    await expect(card).toContainText("0 of 100 points");
    await expect(card.locator("dd").last()).toHaveText("Score capped at 0: Only state governments may apply");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-slot=source-footer]")).toHaveText("Grants.gov · open opportunities · n 2 · as of Oct 2026");
    // The panel: focus lands on its heading; six parts as label, points, reason and sources in words; ten checks; Close returns focus.
    const buttons = page.getByRole("button", { name: "How we matched" });
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "false");
    await buttons.first().click();
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("[data-slot=match-panel]");
    await expect(panel).toHaveCount(1);
    await expect(panel.locator("h3")).toBeFocused();
    await expect(panel.locator("[data-slot=panel-score]")).toHaveText("100");
    await expect(rows.nth(0).locator("[data-slot=match-panel]")).toHaveCount(width < 1024 ? 1 : 0);
    await expect(page.locator("[data-slot=match-aside] [data-slot=match-panel]")).toHaveCount(width < 1024 ? 0 : 1);
    const parts = panel.locator("[data-slot=match-component]");
    await expect(parts).toHaveCount(6);
    await expect(parts.first()).toContainText(`Mission fit 30 of 30 points ${TOP_REASON}`);
    await expect(parts.first().locator("[data-slot=match-sources] li")).toHaveText(["FAS settings · program themes", "Grant listing · description"]);
    await expect(panel.locator("[data-slot=match-check]")).toHaveCount(10);
    await expect(panel.locator("[data-slot=match-check][data-status=pass]")).toHaveCount(10);
    await expect(panel.locator("[data-slot=match-cap]")).toHaveCount(0);
    await expect(panel).not.toContainText(/org\.|opportunity\./);
    await buttons.nth(1).click();
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "false");
    await expect(panel.locator("[data-slot=panel-score]")).toHaveText("0");
    await expect(panel.locator("[data-slot=match-cap]")).toHaveText(CAP_NOTE);
    await expect(panel.locator("[data-slot=match-check]").first()).toHaveText("Who may apply · Only state governments may apply");
    await expect(panel.locator("[data-slot=match-check][data-status=flagged]")).toHaveCount(1);
    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);
    await expect(buttons.nth(1)).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  }
});
