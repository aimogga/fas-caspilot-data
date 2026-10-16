import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// DS-15a: the team dashboard explains itself on hover, focus and tap (D-040). Seed facts: M4 band `a` 12/14/86%, band `b` complementary, band `c` under 11; one `foundation_manual` row in Pursuing.
test.setTimeout(90_000);
async function signIn(page: Page) {
  await page.goto("/login");
  await page.fill("#email", "staff@example.test");
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));
const PRIVACY = "Fewer than 11 families, so the number is hidden to protect privacy.";
const COMPLEMENTARY = "Hidden so the smaller group next to it cannot be worked out from the total.";

test("AC2: M4 cells share one explain layer; hover, focus and Enter show the same words; hidden cells say why; Escape returns focus; arrows walk cells", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const m4 = page.locator("[data-slot=metric-card]").filter({ has: page.locator("#card-m4-title") });
  const card = m4.locator("[data-slot=explain-layer-card]"), cell = m4.locator("tbody tr").first().locator("td[data-term=m4_completed]");
  await expect(m4.locator("[data-slot=explain-layer]")).toHaveCount(1);
  await expect(card).toHaveCount(0);
  await cell.hover();
  // The card's rows read `Value · Source · As of` with the date alone (`Sep 2026`), so no "as of" words are expected here.
  await expect(card).toContainText(/^Completed.*12 in the a band.*FAS records.*\w{3} \d{4}/s);
  const words = await card.innerText();
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await cell.focus();
  expect(await card.innerText()).toBe(words);
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("role", "dialog");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Completed");
  expect(await page.getByRole("dialog").innerText()).toBe(words);
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(cell).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(m4.locator("tbody tr").first().locator("td[data-term=m4_closed]")).toBeFocused();
  await expect(card).toContainText("Closed");
  await m4.locator("tbody tr[data-complementary] td[data-term=complementary]").hover();
  await expect(card).toContainText(COMPLEMENTARY);
  await m4.locator("tbody tr[data-suppressed]:not([data-complementary]) td[data-term=m4_closed]").hover();
  await expect(card).toContainText(PRIVACY);
  await expect(card).not.toContainText("Value");
  await m4.locator("tfoot td[data-term=m4_rate]").hover();
  await expect(card).toContainText(/Completion rate.*86% across all bands/s);
  await page.mouse.move(0, 0);
  expect(await axe(page)).toEqual([]);
});

test("AC3: filter labels, pipeline stages and the manual badge carry hints that read the same on hover and on focus", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const tip = page.locator("[data-slot=tooltip-content]").first();
  // Same pattern as home.spec: hover, read, then focus the same trigger and expect the same string; the pointer leaves afterwards.
  const same = async (trigger: ReturnType<Page["locator"]>, pattern: RegExp) => {
    await trigger.hover();
    await expect(tip).toHaveText(pattern);
    const hovered = await tip.textContent();
    await trigger.focus();
    await expect(tip).toHaveText(hovered ?? "");
    await page.keyboard.press("Tab");
    await page.mouse.move(0, 0);
    await expect(tip).toHaveCount(0);
  };
  const bar = page.locator("[data-slot=filter-bar]");
  await expect(bar.locator("[data-slot=hint-trigger]")).toHaveCount(4);
  await same(bar.getByRole("button", { name: "About Quarter", exact: true }), /^The three months the numbers cover\./);
  await same(bar.getByRole("button", { name: "About Compare to prior quarter", exact: true }), /^Adds an arrow and words/);
  const pipeline = page.locator("[data-slot=pipeline-widget]");
  for (const stage of ["New", "Reviewing", "Pursuing", "Submitted", "Awarded", "Declined", "Passed"]) {
    await expect(pipeline.locator(`li[data-stage=${stage}] [data-slot=hint-trigger]`).first()).toHaveText(stage);
  }
  await same(pipeline.locator("li[data-stage=Pursuing] [data-slot=hint-trigger]").first(), /^FAS has decided to apply and is preparing the application\. \d+ opportunit(y is|ies are) at this stage\.$/);
  await same(pipeline.locator("li[data-stage=Pursuing] [data-slot=hint-trigger]", { hasText: "Manual entry" }), /^Entered by hand by FAS staff/);
  await expect(pipeline).not.toContainText(/\bpct\b|\bM[1-6]\b/);
});

test("AC4: the M1 trend has a hover layer: pointer and arrow keys read the quarter and the median, through a live region", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const m1 = page.locator("[data-slot=metric-card]").filter({ has: page.locator("#card-m1-title") });
  test.skip((await m1.getAttribute("data-state")) !== "value", "the seed has no M1 value this quarter");
  const layer = m1.locator("[data-slot=line-hover]"), tooltip = layer.locator("[data-slot=tooltip]"), live = layer.locator("[aria-live=polite]");
  await expect(layer).toHaveAttribute("aria-label", /^Days from court order to first session: use arrow keys/);
  const box = (await layer.boundingBox())!;
  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(tooltip).toHaveText(/^Q[1-4] ’\d{2} · (\d+ days|Hidden \(n < 11\))$/);
  await expect(live).toHaveText(await tooltip.innerText());
  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);
  await layer.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tooltip).toHaveText(/^Q[1-4] ’\d{2} · /);
  await page.keyboard.press("End");
  const last = await tooltip.innerText();
  await m1.getByRole("button", { name: "View as table" }).click();
  await expect(m1.locator("table tbody tr").last()).toContainText(last.includes("Hidden") ? "n<11" : last.replace(/^.* · /, ""));
  expect(await axe(page)).toEqual([]);
});

test("AC5 + AC6: deltas are an arrow plus words with a hint naming the prior quarter; no pct code; 44 px triggers, axe and no overflow at 375", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const deltas = page.locator("[data-slot=delta]");
  for (const d of await deltas.all()) {
    await expect(d).toHaveText(/^(↑|↓) .+ (faster|slower|higher|lower) than Q[1-4]$|^No change from Q[1-4]$/);
    await d.locator("[data-slot=hint-trigger]").hover();
    await expect(page.locator("[data-slot=tooltip-content]").first()).toHaveText(/than \w{3}–\w{3} \d{4} \(Q[1-4]\)\. Lower is better for this number\.$|^No change from .*Lower is better for this number\.$/);
    await page.mouse.move(0, 0);
  }
  await expect(page.locator("main")).not.toContainText(/\bpct\b/);
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
    expect(await axe(page), `axe @ ${width}`).toEqual([]);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  for (const t of await page.locator("[data-slot=pipeline-widget] [data-slot=hint-trigger], [data-slot=delta] [data-slot=hint-trigger]").all()) {
    expect((await t.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button", { name: /^Filters/ }).click();
  for (const t of await page.locator("#filter-sheet [data-slot=hint-trigger]").all()) {
    const b = (await t.boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
  }
  await page.locator("#filter-sheet").getByRole("button", { name: "About County" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Limits every number" })).toBeVisible();
});
