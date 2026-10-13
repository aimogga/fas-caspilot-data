import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/ds-06a2";
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
      await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: Census SAHIE 2023 · as of .* · Need score version v2-synthetic · Placeholder bins$/);
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
