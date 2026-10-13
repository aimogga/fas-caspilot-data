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
      await expect(page.getByText("Need score not computed yet")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "County need table" })).toBeVisible();
      const rows = page.locator("tbody tr");
      await expect(rows.nth(0)).toContainText(/Rich County.*1 of 26.*\+1\.40.*5 of 5.*Ranked/);
      await expect(rows.nth(1)).toContainText(/San Juan County.*2 of 26/);
      await expect(page.locator("tr[data-fips='49005']")).toContainText(/20 of 26.*-0\.80.*1 of 5/);
      await expect(page.locator("tr[data-fips='49011']")).toContainText(/20 of 26.*-0\.80.*1 of 5/);
      await expect(rows.nth(25)).toContainText(/Morgan County.*26 of 26/);
      for (const [i, name] of ["Daggett", "Piute", "Wayne"].entries()) {
        await expect(rows.nth(26 + i)).toContainText(new RegExp(`${name} County.*Not published.*Not published`));
      }
      await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: Census SAHIE 2023 · as of .* · Need score version v2-synthetic · Placeholder bins$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations).toEqual([]);
    }
  });
}
