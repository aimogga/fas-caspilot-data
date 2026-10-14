import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/ds-08a";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

const CASES = [["staff@example.test", "SHARE", true], ["admin@example.test", "SHARE", true], ["board@example.test", "BOARD", false]] as const;

for (const [email, eyebrow, seesDraft] of CASES) {
  test(`methodology page for ${email} (DS-08a)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    const res = await page.goto("/methodology");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Need score methodology");
    await expect(page.locator("[data-slot=page-header] p").first()).toHaveText(eyebrow);
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page]")).toHaveText("Methodology");
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Methodology");
    await expect(page.getByRole("link", { name: "Back to need map" })).toHaveAttribute("href", "/need-map");
    await expect(page.locator("[data-slot=version-line]")).toHaveText(/^Version v2-synthetic, approved Oct 2026\s*Synthetic data$/);
    await expect(page.locator("section:has(#inputs) tr[data-row=uninsured]")).toContainText(/Uninsured rate.*Census SAHIE.*2023.*Current/);
    await expect(page.locator("section:has(#weights) tr[data-row=uninsured]")).toContainText(/Uninsured rate.*1.*100%/);
    await expect(page.locator("tr[data-row=total]")).toContainText(/Total.*1.*100%/);
    await expect(page.locator("[data-slot=not-published-count]")).toHaveText("3 of 29 counties are Not published for this version.");
    await expect(page.locator("[data-testid^=limit-]")).toHaveCount(6);
    await expect(page.locator("[data-slot=source-footer]")).toContainText(/^Public sources: Census SAHIE · Need score version v2-synthetic · as of .* · Synthetic data$/);
    const notice = page.locator("[data-slot=draft-notice]");
    await expect(notice).toHaveCount(seesDraft ? 1 : 0);
    if (seesDraft) await expect(notice).toContainText(/Newer draft on file.*Version \S+ was created \w{3} \d{4} and is not approved\. The map and this page still use the approved version\./);
    for (const width of [375, 800, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/methodology");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBe(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations, `axe @ ${width}`).toEqual([]);
      if (email === "staff@example.test" && width !== 800) await page.screenshot({ path: `${ART}/methodology-${width}.png`, fullPage: true });
    }
  });
}
