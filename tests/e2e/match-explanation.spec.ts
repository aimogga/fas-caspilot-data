import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

// Expected text is the seed's stored match_result.components / flags (supabase/seed.sql, F-504 block); the panel must not recompute.
const TOP = "Mission fit · 30 of 30 points · Matched 3 of 5 configured themes: therapy (description), mental health (description), court-involved families (description)org.program_themes, opportunity.description";
const CAP = "Blocker · 0 of 0 points · Score capped at 0: Only state governments may applyopportunity.eligibility.applicant_types";

test("board gets 403 on /staff/grants/matches", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/grants/matches"))?.status()).toBe(403);
});

test("staff sees seeded matches by score and the How we matched panel shows only stored reasons", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto("/staff/grants/matches"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Grant matches");
    await expect(page.locator("[data-slot=page-header] p")).toHaveText(["WORKSPACE", "Scored against the v0-synthetic-test rules · 2 open opportunities · as of Oct 2026"]);
    const rows = page.locator("tbody tr[data-match]");
    await expect(rows.nth(0)).toContainText(/Family Therapy Access Grants \(synthetic\).*Synthetic Agency for Families.*Dec 15, 2027.*100.*Eligible/);
    await expect(rows.nth(1)).toContainText(/State Child Welfare Block Grant \(synthetic\).*Oct 31, 2027.*0.*Not eligible/);
    const buttons = page.getByRole("button", { name: "How we matched" });
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "false");
    await buttons.first().click();
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "true");
    const panel = page.locator("[data-slot=match-panel]");
    await expect(panel.locator("[data-slot=match-components] li")).toHaveText([TOP, /^Eligibility certainty · 20 of 20 points · /, /^Evidence readiness/, /^Award size fit/, /^Geography/, /^Effort vs time/]);
    await expect(panel.locator("[data-slot=match-flags]")).toHaveText("No eligibility flags");
    await buttons.nth(1).click();
    await expect(buttons.first()).toHaveAttribute("aria-expanded", "false");
    await expect(panel.locator("[data-slot=match-components] li")).toHaveCount(7);
    await expect(panel.locator("[data-slot=match-components] li").last()).toHaveText(CAP);
    await expect(panel.locator("[data-slot=match-flags] li")).toHaveText(["Blocker · Only state governments may apply"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  }
});
