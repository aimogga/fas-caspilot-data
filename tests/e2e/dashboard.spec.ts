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
// The first pointer action on a page can land before the client components hydrate (dev server on CI), so the first hover re-tries until its face appears.
const hoverUntil = (target: ReturnType<Page["locator"]>, face: ReturnType<Page["locator"]>) =>
  expect(async () => { await target.hover(); await expect(face).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 30_000 });

test("AC2: M4 cells share one explain layer; hover, focus and Enter show the same words; hidden cells say why; Escape returns focus; arrows walk cells", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const m4 = page.locator("[data-slot=metric-card]").filter({ has: page.locator("#card-m4-title") });
  const card = m4.locator("[data-slot=explain-layer-card]"), cell = m4.locator("tbody tr").first().locator("td[data-term=m4_completed]");
  await expect(m4.locator("[data-slot=explain-layer]")).toHaveCount(1);
  await expect(card).toHaveCount(0);
  await hoverUntil(cell, card);
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
    await hoverUntil(trigger, tip);
    await expect(tip).toHaveText(pattern);
    const hovered = await tip.textContent();
    await trigger.focus();
    await expect(tip).toHaveText(hovered ?? "");
    await trigger.blur();
    await page.mouse.move(0, 0);
    // Blur rather than Tab: Tab can land on the next hint and open its tooltip, which would make `tip` stale for the next call.
    await expect(page.locator("[data-slot=tooltip-content]", { hasText: hovered ?? "" })).toHaveCount(0);
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
  await expect(async () => {
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await expect(tooltip).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 30_000 });
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
    await hoverUntil(d.locator("[data-slot=hint-trigger]"), page.locator("[data-slot=tooltip-content]").first());
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

// DS-15b: the M6 share bar and table, the O1 rows and the View as table hint. Seed facts: affiliated 59% / $120 / $1,700 / 17, other 41% / $90 / $1,200 / 12; PHQ-9 −1.5 / 75% / 12, GAD-7 under 11.
const cardFor = (page: Page, id: string) => page.locator("[data-slot=metric-card]").filter({ has: page.locator(`#card-${id}-title`) });

test("AC7: M6 segments and cells share one explain layer; hover, focus and Enter show the same words on a segment; Left and Right walk the segments; Escape returns focus", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const m6 = cardFor(page, "m6");
  test.skip((await m6.getAttribute("data-state")) !== "value", "the seed has no M6 value this quarter");
  const card = m6.locator("[data-slot=explain-layer-card]"), segments = m6.locator("[data-slot=m6-bar] [data-term=m6_share]");
  await expect(m6.locator("[data-slot=explain-layer]")).toHaveCount(1);
  await expect(segments).toHaveCount(2);
  await expect(m6.locator("[data-slot=m6-share]")).toHaveText(/Affiliated providers 59%\s*·\s*Other providers 41%/);
  await hoverUntil(segments.first(), card);
  await expect(card).toContainText(/^Share of therapy dollars.*59% of therapy dollars went to affiliated providers \(\$1,700\).*FAS records.*\w{3} \d{4}/s);
  const words = await card.innerText();
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await segments.first().focus();
  expect(await card.innerText()).toBe(words);
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("role", "dialog");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Share of therapy dollars");
  expect(await page.getByRole("dialog").innerText()).toBe(words);
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(segments.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(segments.nth(1)).toBeFocused();
  await expect(card).toContainText("41% of therapy dollars went to other providers ($1,200)");
  await page.keyboard.press("ArrowLeft");
  await expect(segments.first()).toBeFocused();
  await m6.locator("tbody tr[data-group=affiliated] td[data-term=m6_rate]").hover();
  await expect(card).toContainText(/^Average rate per hour.*\$120 per hour for affiliated providers/s);
  await m6.locator("tbody tr[data-group=other] td[data-term=m6_episodes]").hover();
  await expect(card).toContainText(/^Episodes.*12 episodes with other providers/s);
  await page.mouse.move(0, 0);
  expect(await axe(page)).toEqual([]);
});

test("AC8: O1 cells share one explain layer; hover and focus say the figure for the survey with the direction in words; the row under 11 pairs says why on every cell", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const o1 = cardFor(page, "o1");
  test.skip((await o1.getAttribute("data-state")) !== "value", "the seed has no O1 value this quarter");
  const card = o1.locator("[data-slot=explain-layer-card]"), row = o1.locator("tbody tr[data-measure=PHQ-9]"), mean = row.locator("td[data-term=o1_mean]");
  await expect(o1.locator("[data-slot=explain-layer]")).toHaveCount(1);
  await hoverUntil(mean, card);
  await expect(card).toContainText(/^Mean change.*−1\.5 points on the PHQ-9 survey \(lower is better\).*FAS records.*\w{3} \d{4}/s);
  const words = await card.innerText();
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await mean.focus();
  expect(await card.innerText()).toBe(words);
  await page.keyboard.press("ArrowRight");
  await expect(row.locator("td[data-term=o1_improved]")).toBeFocused();
  await expect(card).toContainText("75% of families improved on the PHQ-9 survey");
  await page.keyboard.press("ArrowRight");
  await expect(row.locator("td[data-term=o1_n]")).toBeFocused();
  await expect(card).toContainText("12 families with a start and an end score on the PHQ-9 survey");
  for (const term of ["o1_mean", "o1_improved", "o1_n"]) {
    await o1.locator(`tbody tr[data-suppressed] td[data-term=${term}]`).first().hover();
    await expect(card).toContainText(PRIVACY);
    await expect(card).not.toContainText("Value");
  }
  await page.mouse.move(0, 0);
  await expect(o1).not.toContainText(/\bpct\b/);
  expect(await axe(page)).toEqual([]);
});

test("AC9: the View as table toggle has an Info hint that reads the same on hover and focus and is 44 px at 375; every delta on the page carries a hint", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/dashboard"))?.status()).toBe(200);
  const hints = page.getByRole("button", { name: "About the table view", exact: true }), tip = page.locator("[data-slot=tooltip-content]").first();
  expect(await hints.count()).toBeGreaterThan(0);
  expect(await hints.count()).toBe(await page.getByRole("button", { name: "View as table", exact: true }).count());
  await hoverUntil(hints.first(), tip);
  await expect(tip).toHaveText(/^Shows the same numbers as the picture in a table, one row per bar or point, with hidden values marked\.$/);
  const hovered = await tip.textContent();
  await hints.first().focus();
  await expect(tip).toHaveText(hovered ?? "");
  await hints.first().blur();
  await page.mouse.move(0, 0);
  const deltas = page.locator("[data-slot=delta]");
  expect(await deltas.count()).toBe(await deltas.locator("[data-slot=hint-trigger]").count());
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");
  const small = page.getByRole("button", { name: "About the table view", exact: true }).first(), box = (await small.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
  await small.click();
  await expect(page.getByRole("dialog").filter({ hasText: "Shows the same numbers as the picture" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
