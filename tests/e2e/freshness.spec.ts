import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/ds-05a";
const HEADERS = ["Source", "Latest vintage", "Last successful run", "Cadence", "Status"];

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

for (const [email, admin] of [["staff@example.test", false], ["admin@example.test", true]] as const) {
  test(`data freshness page for ${email}: table, statuses, nav, axe, screenshots (DS-05a, F-209)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await page.goto("/data-freshness"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data freshness");
    await expect(page.locator("[data-slot=page-header] p").first()).toHaveText("WORKSPACE");
    await expect(page.locator("[data-slot=page-header] p").nth(1)).toHaveText("Latest vintage, last successful run, and status for each public data source.");
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page], [data-slot=crumbs]")).toHaveText(["Data freshness", "Data freshness"]);
    await expect(page.locator("thead th")).toHaveText(admin ? [...HEADERS, "Latest run"] : HEADERS);
    const stale = page.locator("tr[data-row=example-monthly-source]");
    await expect(stale).toContainText(/example-monthly-source.*Example owner.*Monthly.*Stale · \d+ days/s);
    await expect(stale.locator("td").nth(1)).toHaveText(/^\w{3} \d{1,2}, \d{4}$/);
    const failed = page.locator("tr[data-row=example-failed-source]");
    await expect(failed).toContainText(/example-failed-source.*Quarterly.*Failed/s);
    await expect(failed.locator("td").nth(1)).toHaveText(/^\w{3} \d{1,2}, \d{4}$/);
    if (admin) await expect(failed.locator("td").last()).toHaveText("dddddddd");
    const statuses = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status") ?? ""));
    const ranks = statuses.map((s) => ["failed", "stale", "not_published", "current"].indexOf(s));
    expect(ranks, "rows sorted Failed → Stale → Not published → Current").toEqual([...ranks].sort((a, b) => a - b));
    for (const row of await page.locator("tbody tr").all()) await expect(row.locator("td").nth(3)).toHaveText(/^Status: \W*(Current|Stale · \d+ days|Failed|Not published)$/);
    await expect(page.locator("[data-slot=freshness-summary]")).toHaveText(/^\d+ sources\W*Failed$/);
    await expect(page.locator("[data-slot=source-footer]")).toHaveText(/^Public sources · as of \w{3} \d{1,2}, \d{4}$/);
    if (!admin) await expect(page.locator("main")).not.toContainText("Latest run");
    for (const width of [375, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/data-freshness");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations, `axe @ ${width}`).toEqual([]);
      if (!admin) await page.screenshot({ path: `${ART}/data-freshness-${width}.png`, fullPage: true });
    }
  });
}

test("board gets a real 403 with the DS-04 card and no Data freshness nav item (DS-05a)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/data-freshness"))?.status()).toBe(403);
  await expect(page.locator("[data-slot=status-card]")).toContainText(/Error 403 · No permission.*You don't have access to this page.*Board · read-only/s);
  await expect(page.locator("[data-slot=status-card] code")).toHaveText("/data-freshness");
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Data freshness" })).toHaveCount(0);
});

for (const [email, home, navigates] of [["staff@example.test", "/staff", true], ["admin@example.test", "/admin", true], ["board@example.test", "/board", false]] as const) {
  test(`top-bar aggregate chip for ${email}: worst seeded status, ${navigates ? "links to" : "never links to"} /data-freshness (DS-05b, F-209)`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(home);
      const chip = page.locator("[data-slot=topbar-sub] [data-slot=freshness-chip]");
      await expect(chip, `chip @ ${width}`).toBeVisible();
      await expect(chip).toHaveAttribute("data-status", "failed");
      await expect(chip).toHaveText(/^\W*Last run failed$/);
      await expect(chip.locator("[aria-hidden]")).toHaveText("✕");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
      if (width === 375) expect((await chip.boundingBox())?.height ?? 0, "44px target below 1024").toBeGreaterThanOrEqual(44);
    }
    const chip = page.locator("[data-slot=topbar-sub] [data-slot=freshness-chip]");
    if (navigates) {
      await expect(chip).toHaveAttribute("href", "/data-freshness");
      await chip.click();
      await page.waitForURL("**/data-freshness");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data freshness");
      await expect(page.locator("[data-slot=freshness-summary]")).toContainText("Failed");
    } else {
      await expect(chip).not.toHaveAttribute("href", /.*/);
      expect(await chip.evaluate((el) => el.tagName)).toBe("SPAN");
      await chip.click();
      expect(new URL(page.url()).pathname).toBe(home);
    }
  });
}
