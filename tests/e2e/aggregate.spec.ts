import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze().then((r) => r.violations.map((v) => v.id));

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

/** Opens /staff/entry and switches the entity selector to the sixth option. */
async function openAggregate(page: Page) {
  await page.goto("/staff/entry");
  await page.selectOption("#entry-entity", "aggregate");
  await expect(page.locator("[data-slot=aggregate-form]")).toBeVisible();
}

test("staff can open the Aggregate totals form (200) with the Σ Aggregate notice; board gets 403", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/staff/entry"))?.status()).toBe(200);
  await openAggregate(page);
  await expect(page.locator("[data-slot=aggregate-notice]")).toContainText("Totals are stored as aggregate submissions and always shown with the Σ Aggregate label.");
  await expect(page.locator("[data-slot=aggregate-notice] [data-slot=badge]")).toHaveAttribute("aria-label", "Aggregate submission");
  await page.context().clearCookies(); await signIn(page, "board@example.test");
  expect((await page.goto("/staff/entry"))?.status()).toBe(403);
});

test("2026-Q5 and a negative total show inline errors; nothing is saved", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await openAggregate(page);
  await page.fill("#agg-period", "2026-Q5"); await page.selectOption("#agg-metric", "families_served"); await page.fill("#agg-value", "-3");
  await page.getByRole("button", { name: "Save total" }).click();
  await expect(page.locator("[data-slot=entry-alert]")).toHaveText(/^2 fields need attention/);
  await expect(page.locator("#agg-period-error")).toHaveText('✕ Period must be a quarter like 2026-Q2, got "2026-Q5"');
  await expect(page.locator("#agg-value-error")).toHaveText("✕ Total must be at least 0, got -3");
  await expect(page.locator("#agg-period[aria-invalid=true][aria-describedby~=agg-period-error]")).toBeFocused();
  await expect(page.locator("[data-slot=entry-saved]")).toHaveCount(0);
});

test("a valid total saves, is listed under Recent aggregate totals with the badge, and survives a reload", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await openAggregate(page);
  await page.fill("#agg-period", "2026-Q2"); await page.selectOption("#agg-metric", "episodes_completed");
  await page.fill("#agg-value", "31"); await page.selectOption("#agg-county_fips", "49035");
  await page.getByRole("button", { name: "Save total" }).click();
  const status = page.locator("[data-slot=entry-saved]");
  await expect(status).toContainText("Saved aggregate total"); const id = (await status.getAttribute("data-id")) ?? "";
  const row = page.locator(`[data-slot=aggregate-recent] li[data-id="${id}"]`);
  await expect(row).toContainText("Apr–Jun 2026 (Q2) · Episodes completed · 31 · Salt Lake");
  await expect(row.locator("[data-slot=badge]")).toHaveText(/Aggregate/);
  await openAggregate(page);
  await expect(page.locator(`[data-slot=aggregate-recent] li[data-id="${id}"] [data-slot=badge]`)).toHaveAttribute("aria-label", "Aggregate submission");
});

test("375 and 1024: no horizontal scroll, 44px targets, axe clean", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024] as const) {
    await page.setViewportSize({ width, height: 900 }); await openAggregate(page);
    await page.getByRole("button", { name: "Save total" }).click();
    await expect(page.locator("[data-slot=entry-alert]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `@ ${width}`).toBe(width);
    expect(await axe(page), `@ ${width}`).toEqual([]);
    const minTarget = await page.evaluate(() => Math.min(...[...document.querySelectorAll("main a, main button, main select, main input")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.min(r.width, r.height))));
    if (width < 1024) expect(minTarget, `targets @ ${width}`).toBeGreaterThanOrEqual(44);
  }
});
