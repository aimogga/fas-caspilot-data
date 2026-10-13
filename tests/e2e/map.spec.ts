import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
      await expect(page.getByRole("region", { name: "County need table" })).toBeVisible();
      const ranked = (await page.getByText("Need score not computed yet").count()) === 0;
      await expect(page.locator("tbody tr").first()).toContainText(ranked ? /\b1 of \d+/ : /Not available yet/);
      await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: .+ · Need score version .+ · Placeholder bins$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations).toEqual([]);
    }
  });
}
