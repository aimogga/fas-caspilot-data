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
    await expect(page.locator("[data-slot=version-line]")).toHaveText(/^Version v2-synthetic, approved Oct 2026\s*·\s*one input, 100 points\s*·\s*26 of 29 counties scored\s*Synthetic data$/);
    await expect(page.locator("section:has(#inputs) tr[data-row=uninsured]")).toContainText(/Uninsured rate.*Census SAHIE.*2023.*Current/);
    await expect(page.locator("[data-weight=uninsured]")).toContainText(/Uninsured rate.*100.*of 100 points.*Census SAHIE 2023 · as of \w{3} \d{4}/s);
    await expect(page.locator("[data-slot=weights-total]")).toHaveText(/^Total\s*1\s*of 100 points as stored, across one input\.$/);
    await expect(page.locator("[data-slot=not-published-count]")).toHaveText("3 of 29 counties are Not published for this version.");
    await expect(page.locator("[data-testid^=limit-]")).toHaveCount(6);
    // DS-16b: each weight card has its own source-footer; the page footer is the last one.
    await expect(page.locator("[data-slot=source-footer]").last()).toContainText(/^Public sources: Census SAHIE · Need score version v2-synthetic · as of .* · Synthetic data$/);
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

// DS-16b: weights as points, inputs with provenance, statistics in plain words (D-040). Seed: v2-synthetic, `uninsured: 1`, Census SAHIE 2023, 26 of 29 counties scored.
const face = (page: Page) => page.locator("[data-slot=hover-card-content] [data-slot=explain-content]");
const tip = (page: Page) => page.locator("[data-slot=tooltip-content]").first();
// The first pointer action on a page can land before the client components hydrate (dev server on CI), so the first hover re-tries until its face appears.
const hoverUntil = (target: ReturnType<Page["locator"]>, shown: ReturnType<Page["locator"]>) =>
  expect(async () => { await target.hover(); await expect(shown).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 30_000 });

test("AC1: weight cards read N of 100 points; label → numeral → sentence → source; hover, focus and Enter show the same words; Escape returns focus", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  expect((await page.goto("/methodology"))?.status()).toBe(200);
  const card = page.locator("[data-weight=uninsured]");
  await expect(card.locator("[data-slot=weight-points]")).toHaveText(/^100\s*of 100 points$/);
  await expect(card.locator("[data-slot=source-footer]")).toHaveText(/^Census SAHIE 2023 · as of \w{3} \d{4}$/);
  const trigger = card.getByRole("button", { name: "Uninsured rate", exact: true });
  await hoverUntil(trigger, face(page));
  await expect(face(page)).toContainText(/^Uninsured rate.*no health insurance.*Value\s*100 of 100 points\s*Source\s*Need score version v2-synthetic, approved Oct 2026\s*As of\s*\w{3} \d{4}\s*Input source\s*Census SAHIE 2023$/s);
  const words = await face(page).innerText();
  await page.mouse.move(0, 0);
  await expect(face(page)).toBeHidden();
  await trigger.focus();
  await expect(face(page)).toBeVisible();
  // innerText on both sides: toHaveText compares textContent, which has no whitespace between the face's sibling elements.
  expect(await face(page).innerText()).toBe(words);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName("Uninsured rate");
  expect(await dialog.locator("[data-slot=explain-content]").innerText()).toBe(words);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(card.locator("p").nth(2)).toContainText(/no health insurance/);
});

test("AC2: inputs table carries the source line as a provenance card and the input name as the indicator's words", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/methodology"))?.status()).toBe(200);
  const row = page.locator("section:has(#inputs) tr[data-row=uninsured]");
  await expect(row.locator("th")).toHaveCount(1);
  const source = row.locator("[data-cell=source] [data-slot=explain-trigger]");
  await expect(source).toHaveText(/^Census SAHIE · 2023 · as of \w{3} \d{4}$/);
  await hoverUntil(source, face(page));
  await expect(face(page)).toContainText(/^Census SAHIE.*Small Area Health Insurance Estimates.*Source\s*Census SAHIE\s*As of\s*\w{3} \d{4}\s*Period\s*2023\s*Vintage\s*2023$/s);
  await page.mouse.move(0, 0);
  await expect(face(page)).toBeHidden();
  const name = row.getByRole("button", { name: "Uninsured rate", exact: true });
  await name.focus();
  await expect(face(page)).toContainText(/^Uninsured rate.*no health insurance.*Source\s*Census SAHIE 2023\s*As of\s*\w{3} \d{4}$/s);
  await expect(row.locator("[data-cell=status] [data-slot=freshness]")).toContainText("Current");
  await expect(page.locator("[data-slot=not-published-count] [data-slot=hint-trigger]")).toHaveText("3 of 29 counties are Not published for this version.");
});

test("AC3: the statistics paragraph hints every term in plain words, the same on hover and on focus, and the formula is not the only place", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.goto("/methodology"))?.status()).toBe(200);
  const plain = page.locator("[data-slot=plain-method]");
  await expect(plain.locator("[data-slot=hint-trigger]")).toHaveCount(5);
  await expect(plain).toHaveText(/^For each Utah county we turn every input into a z-score: how far that county sits from the statewide average, measured in standard deviations\. We multiply .* not a fixed level of need\.$/);
  const expected: [string, RegExp][] = [["z-score", /^A z-score says how far one county sits from the typical Utah county/], ["statewide average", /^The mean of this input across the Utah counties with a published value/],
    ["standard deviations", /^The usual distance between a county's value and the statewide average/], ["weight", /^How many of the 100 points an input contributes/], ["rank", /^Counties are placed in order from the highest score to the lowest/]];
  for (const [word, pattern] of expected) {
    const trigger = plain.getByRole("button", { name: word, exact: true });
    await hoverUntil(trigger, tip(page));
    await expect(tip(page)).toHaveText(pattern);
    const hovered = await tip(page).textContent();
    await page.mouse.move(0, 0);
    await trigger.focus();
    await expect(tip(page)).toHaveText(hovered ?? "");
    await trigger.blur();
    await expect(page.locator("[data-slot=tooltip-content]", { hasText: hovered ?? "" })).toHaveCount(0);
  }
  await expect(page.locator("section:has(#how) p").nth(2)).not.toContainText("z_i");
  await expect(page.locator("[data-slot=formula]")).toContainText("score_c");
});

test("AC4: every section has an eyebrow and a serif headline in words; the summary shows at every width; axe clean; no sideways scroll; 44 px triggers at 375", async ({ page }) => {
  await signIn(page, "board@example.test");
  const H2S = ["How we turn one public input into one county rank", "What goes into the score", "Uninsured rate carries all 100 points in this version.", "When each input was published and last loaded", "What this score cannot tell you"];
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect((await page.goto("/methodology"))?.status()).toBe(200);
    const sections = page.locator("[data-slot=methodology-section]");
    await expect(sections).toHaveCount(5);
    await expect(sections.locator("h2")).toHaveText(H2S);
    for (const h2 of await sections.locator("h2").all()) expect(await h2.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/Source Serif|Georgia/);
    await expect(sections.locator("p").first()).toHaveText("How we calculate it");
    for (const fact of ["Version v2-synthetic, approved Oct 2026", "one input, 100 points", "26 of 29 counties scored"]) await expect(page.locator("[data-slot=version-fact]", { hasText: fact })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
    if (width === 375) for (const b of await page.locator("[data-slot=explain-trigger], [data-slot=hint-trigger]").all()) expect((await b.boundingBox())?.height ?? 0, "44 px trigger").toBeGreaterThanOrEqual(44);
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(violations, `axe @ ${width}`).toEqual([]);
  }
});
