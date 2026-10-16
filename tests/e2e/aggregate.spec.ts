import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze().then((r) => r.violations.map((v) => v.id));

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

/** Opens /staff/entry and switches the entity selector to the sixth option, once React has hydrated (a controlled select resets an earlier choice). */
async function openAggregate(page: Page) {
  await page.goto("/staff/entry");
  await page.locator("[data-slot=entry-form][data-hydrated]").waitFor();
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
  // When the save never confirms, print the form so the failing run says why.
  await status.waitFor({ timeout: 20_000 }).catch(async () => console.log("aggregate form after Save:", await page.locator("[data-slot=aggregate-form]").innerText()));
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

// DS-23: the Σ badge, the helper sentences and every recent total explain themselves on hover, focus and tap.
const BADGE = "A total that FAS entered as a total, not built up from individual records.";
const hoverUntil = (target: ReturnType<Page["locator"]>, face: ReturnType<Page["locator"]>) =>
  expect(async () => { await target.hover(); await expect(face).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 30_000 });

test("DS-23: every aggregate field carries a plain sentence in aria-describedby", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await openAggregate(page);
  for (const k of ["period", "metric", "value", "county_fips", "note"]) {
    const hint = page.locator(`#agg-${k}-hint`);
    await expect(hint, k).toHaveText(/^[A-Z].*\.$/);
    await expect(hint, k).not.toHaveText(/\b(FIPS|pct|N\/A)\b|!/);
    await expect(page.locator(`#agg-${k}[aria-describedby~=agg-${k}-hint]`), k).toHaveCount(1);
  }
  await expect(page.locator("#agg-period-hint")).toContainText("like 2026-Q2");
});

test("DS-23: the Σ badge says what an aggregate is on hover, on focus and on tap", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  await openAggregate(page);
  const trigger = page.locator("[data-slot=aggregate-notice] [data-slot=hint-trigger]"), tip = page.locator("[data-slot=tooltip-content]", { hasText: BADGE }).first();
  await expect(trigger).toHaveAccessibleName("Aggregate submission");
  await hoverUntil(trigger, tip);
  // The tooltip closes once the pointer settles outside its grace area (same as gallery.spec DS-09).
  await expect(async () => { await page.mouse.move(4, 4); await expect(tip).toHaveCount(0, { timeout: 1000 }); }).toPass();
  await trigger.focus();
  await expect(tip).toBeVisible();
  await trigger.blur();
  await page.setViewportSize({ width: 375, height: 900 });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: BADGE })).toBeVisible();
  const box = await trigger.boundingBox();
  expect(Math.min(box?.width ?? 0, box?.height ?? 0)).toBeGreaterThanOrEqual(44);
});

test("DS-23: a recent total explains itself through one layer: hover, focus and Enter show the same words; Escape closes", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  await openAggregate(page);
  await page.fill("#agg-period", "2026-Q1"); await page.selectOption("#agg-metric", "families_served");
  await page.fill("#agg-value", "47"); await page.selectOption("#agg-county_fips", "49035");
  await page.getByRole("button", { name: "Save total" }).click();
  const status = page.locator("[data-slot=entry-saved]");
  await expect(status).toContainText("Saved aggregate total", { timeout: 20_000 });
  const id = (await status.getAttribute("data-id")) ?? "";
  const card = page.locator("[data-slot=explain-layer]", { has: page.locator("[data-slot=aggregate-recent]") }).locator("[data-slot=explain-layer-card]");
  const total = page.locator(`[data-slot=aggregate-recent] li[data-id="${id}"] [data-slot=aggregate-total]`);
  await expect(total).toHaveText("47");
  await expect(total).toHaveAttribute("data-term", "aggregate");
  await hoverUntil(total, card);
  await expect(card).toContainText(/Aggregate submission.*47 families served, Jan–Mar 2026 \(Q1\), Salt Lake.*FAS aggregate total, entered by staff/s);
  const words = await card.innerText();
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await total.focus();
  await expect(card).toBeVisible();
  expect(await card.innerText()).toBe(words);
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("role", "dialog");
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(total).toBeFocused();
  expect(await axe(page)).toEqual([]);
});
