import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// F-508f. The adapter is the fake (playwright.config.ts sets STRATEGY_FAKE_LLM=1): no network call. Synthetic seed rows only.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const FAILED = "/staff/grants/strategy/50505050-5050-5050-5050-505050505053";
const axe = async (page: Page) => expect((await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);

test("board gets 403 on a strategy draft", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto(FAILED))?.status()).toBe(403);
});

test("staff generates and views a cited draft; an admin approves it; staff cannot approve", async ({ page, browser }) => {
  await signIn(page, "staff@example.test");
  await page.goto("/staff/grants/matches");
  const row = page.locator("ol[data-slot=match-list] > li[data-match]").first();
  await row.getByRole("button", { name: "Draft a response strategy" }).click();
  await page.waitForURL(/\/staff\/grants\/strategy\/[0-9a-f-]{36}$/, { timeout: 30000 });
  const url = page.url();
  await expect(page.locator("[data-slot=draft-banner]")).toContainText("DRAFT");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Strategy: Family Therapy Access Grants (synthetic)");
  await expect(page.locator("[data-slot=criteria-map] li h3, [data-slot=confidence]")).toHaveText(["Fit with the funder's purpose", "Medium confidence"]);
  await expect(page.locator("[data-slot=suggested-ask] p").first()).toHaveText("$50,000–$200,000");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["How FAS meets each criterion", "Suggested ask", "Risks", "Narrative outline", "Inferences (not facts)"]);
  await expect(page.locator("[data-slot=inferences] li")).toHaveText(["Inference: reviewers may weigh rural reach heavily."]);
  // A citation chip opens the stored row: same words on focus (hover card) and on Enter (dialog).
  const chip = page.locator("[data-slot=draft-evidence] [data-slot=explain-trigger]").first();
  await chip.focus();
  const card = page.locator("[data-slot=hover-card-content] [data-slot=explain-content]");
  await expect(card).toContainText("Family Therapy Access Grants (synthetic)");
  await expect(card).toContainText("award floor $50,000 · award ceiling $200,000");
  await expect(card).toContainText("Grants.gov opportunity record");
  await chip.press("Enter");
  await expect(page.getByRole("dialog", { name: /Family Therapy Access Grants/ })).toContainText("As of");
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused(); await chip.blur();
  await expect(page.locator("[data-slot=model], [data-slot=review]")).toHaveText(["Google Gemini · e2e-fake", "Not reviewed yet: an admin approves or rejects"]);
  await expect(page.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await axe(page); await page.screenshot({ path: `test-results/strategy-${width}.png`, fullPage: true });
  }

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "admin@example.test");
  await admin.goto(url);
  await admin.getByRole("button", { name: "Approve draft" }).click();
  await expect(admin.locator("[data-slot=review]")).toHaveText(/^Approved by you on /);
  await expect(admin.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
});

test("a failed draft shows the citation report in plain words and nothing usable", async ({ page }) => {
  await signIn(page, "admin@example.test");
  await page.goto(FAILED);
  await expect(page.locator("[data-slot=draft-banner]")).toBeVisible();
  await expect(page.locator("[data-slot=draft-failed]")).toContainText("failed its citation check and can't be used");
  await expect(page.locator("[data-slot=citation-report] li")).toHaveText(["Criterion 1, evidence 1: the number 99 does not match any source it cites.", "Tried 2 times."]);
  await expect(page.locator("[data-slot=criteria-map]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
  for (const width of [375, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await axe(page); await page.screenshot({ path: `test-results/strategy-failed-${width}.png`, fullPage: true }); }
});
