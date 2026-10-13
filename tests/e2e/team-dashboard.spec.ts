import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { latestCompleteQuarter, quarterLabel } from "../../lib/dashboard/filters";

const ART = "/opt/cursor/artifacts/ds-07a";
const LABEL = quarterLabel(latestCompleteQuarter(new Date()));
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("board gets 403 and no Team dashboard nav item (DS-07a)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/dashboard"))?.status()).toBe(403);
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Team dashboard" })).toHaveCount(0);
});

for (const email of ["staff@example.test", "admin@example.test"] as const) {
  test(`team dashboard for ${email}: filters, pipeline widget, sheet, axe, screenshots (DS-07a)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await page.goto("/dashboard"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Team dashboard");
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page], [data-slot=crumbs]")).toHaveText(["Team dashboard", "Team dashboard"]);
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText(`${LABEL} · All counties · All referral sources`);
    const bar = page.locator("[data-slot=filter-bar]");
    await expect(bar.getByLabel("Compare to prior quarter")).toBeChecked();
    await bar.getByLabel("County").selectOption("49035");
    await bar.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/county=49035/);
    await expect(page.locator("[data-slot=page-header] > p:not([class])")).toHaveText(`${LABEL} · Salt Lake County · All referral sources`);
    await expect(page.locator("[data-slot=pipeline-widget] li")).toHaveText([/^New\s*0$/, /^Reviewing\s*0$/, /^Pursuing.*Manual entry\s*1$/, /^Submitted\s*0$/, /^Awarded\s*0$/, /^Declined\s*0$/, /^Passed\s*0$/]);
    await expect(page.locator("[data-slot=pipeline-widget]")).toContainText(/Next deadline: Synthetic Family Fund, closes Mar 1\s*Grants\.gov and foundation lists · as of \w{3} \d{4} · includes 1 manual entries$/);
    for (const width of [375, 800, 1024, 1440]) {
      for (const scheme of ["light", "dark"] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/dashboard");
        await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), scheme === "dark");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width} ${scheme}`).toBe(width);
        expect(await axe(page), `axe @ ${width} ${scheme}`).toEqual([]);
        if (email === "staff@example.test") await page.screenshot({ path: `${ART}/dashboard-${width}-${scheme}.png`, fullPage: true });
      }
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard?compare=none");
    const button = page.getByRole("button", { name: "Filters · 1" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    const sheet = page.locator("#filter-sheet");
    await expect(sheet.getByRole("heading", { name: "Filter the dashboard" })).toBeVisible();
    for (const el of await sheet.locator("select, button, a").all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(button).toBeFocused();
  });
}
