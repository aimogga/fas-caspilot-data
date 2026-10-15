import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test("gallery sizes, axe, and screenshots", async ({ page }) => {
  const ART = "/opt/cursor/artifacts";
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/ui");
  await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible();
  const v = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("[data-slot=button]")];
    const inputs = [...document.querySelectorAll("[data-slot=input]")];
    const label = document.querySelector("[data-slot=label]");
    const ring = (n: HTMLElement) => {
      n.focus({ focusVisible: true });
      const p = document.createElement("i"); p.style.color = "var(--ring)";
      document.body.append(p);
      const expected = getComputedStyle(p).color;
      p.remove();
      const s = getComputedStyle(n);
      return s.outlineColor === expected && s.outlineWidth === "2px" && s.outlineStyle === "solid" && s.outlineOffset === "2px";
    };
    const btn = buttons[0] as HTMLElement;
    const light = ring(btn);
    document.documentElement.classList.add("dark");
    const dark = ring(btn);
    document.documentElement.classList.remove("dark");
    const err = document.querySelector("#gallery-err");
    const natives = [...document.querySelectorAll("button:not([data-slot])")];
    const page = document.querySelector("[data-slot=page]");
    const fresh = [...document.querySelectorAll("[data-slot=freshness]")].map((el) => (el.textContent ?? "").trim());
    const suppressed = document.querySelector("[data-slot=suppressed]")?.textContent ?? "";
    return {
      minTap: Math.min(...buttons.flatMap((el) => [box(el).height, box(el).width]), ...inputs.map((el) => box(el).height), ...natives.flatMap((el) => [box(el).height, box(el).width])),
      inputPx: Math.min(...inputs.map((el) => parseFloat(getComputedStyle(el).fontSize))),
      ok: !!label && getComputedStyle(label).display === "block" && !!inputs[0] && box(label).bottom <= box(inputs[0]).top + 1
        && err?.getAttribute("aria-invalid") === "true" && err.getAttribute("aria-describedby") === "gallery-err-msg"
        && light && dark && ring(document.querySelector("#gallery-email") as HTMLElement),
      scroll: document.documentElement.scrollWidth,
      pagePad: page ? parseFloat(getComputedStyle(page).paddingLeft) : 0,
      fresh: fresh.every((t) => t.length > 0) && fresh.length === 3,
      suppressedOk: suppressed.includes("n<11") && !suppressed.includes("7"),
    };
  });
  expect(v.minTap).toBeGreaterThanOrEqual(44);
  expect(v.inputPx).toBeGreaterThanOrEqual(16);
  expect(v.ok).toBe(true);
  expect(v.scroll).toBeLessThanOrEqual(375);
  expect(v.pagePad).toBe(16);
  expect(await page.locator("[data-slot=page-header] h1").evaluate((el) => Math.round(el.getBoundingClientRect().left))).toBe(16);
  expect(v.fresh).toBe(true);
  expect(v.suppressedOk).toBe(true);
  await expect(page.locator(".scroll-hint")).toBeVisible();
  expect(await page.locator(".scroll-hint [aria-hidden]").textContent()).toContain("Scroll");
  expect((await new AxeBuilder({ page }).analyze()).violations.filter((x) => x.impact === "serious" || x.impact === "critical")).toEqual([]);
  await page.screenshot({ path: `${ART}/gallery-375.png`, fullPage: true });
  // A viewport resize reflows asynchronously, so poll the page padding instead of reading it once (flaked 3/3 on CI).
  const padLeft = () => page.evaluate(() => {
    const pad = Math.round(parseFloat(getComputedStyle(document.querySelector("[data-slot=page]")!).paddingLeft));
    return { pad, left: Math.round(document.querySelector("[data-slot=page-header] h1")!.getBoundingClientRect().left) };
  });
  await page.setViewportSize({ width: 800, height: 900 });
  await expect.poll(padLeft, { message: `page padding @ 800` }).toEqual({ pad: 24, left: 24 });
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(padLeft, { message: `page padding @ 1024` }).toEqual({ pad: 32, left: 32 });
  await page.screenshot({ path: `${ART}/gallery-1024.png`, fullPage: true });
  // Line chart hover layer: the pointer snaps to the nearest period, arrow keys walk the points, the words are in the tooltip.
  const hover = page.locator("[data-slot=line-hover]");
  await hover.scrollIntoViewIfNeeded();
  const hb = (await hover.boundingBox())!;
  await page.mouse.move(hb.x + hb.width * 0.4, hb.y + hb.height / 2);
  await expect(hover.locator("[data-slot=tooltip]")).toHaveText("Q1 25 · Hidden (n < 11)");
  await page.mouse.move(hb.x + hb.width - 1, hb.y + hb.height / 2); // the last pixel inside the layer
  await expect(hover.locator("[data-slot=tooltip]")).toHaveText("Q3 25 · 23 days");
  const tb = (await hover.locator("[data-slot=tooltip]").boundingBox())!;
  expect(tb.x + tb.width, "tooltip flips inside the plot at the right edge").toBeLessThanOrEqual(hb.x + hb.width + 1);
  await hover.focus();
  await page.keyboard.press("End");
  await expect(hover.locator("[data-slot=tooltip]")).toHaveText("Q3 25 · 23 days");
  await expect(hover.locator("[aria-live]")).toHaveText("Q3 25 · 23 days");
  await page.keyboard.press("Escape");
  await expect(hover.locator("[data-slot=tooltip]")).toHaveCount(0);
  // Bar chart: hovering a row shows its label, value and note; nothing shows otherwise.
  const bars = page.locator("[data-slot=chart]").first().locator("[data-slot=tooltip]");
  await expect(bars).toHaveCount(5);
  await expect(bars.first()).toBeHidden();
  await bars.first().locator("..").hover();
  await expect(bars.first()).toBeVisible();
  await expect(bars.first()).toHaveText("Utah · 31");
  await bars.last().locator("..").hover();
  await expect(bars.last()).toHaveText("4 other counties · Hidden (n < 11)");
  await expect(bars.first()).toBeHidden();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(() => page.evaluate(() => {
    const h = (t: string) => [...document.querySelectorAll("[data-slot=button]")].find((el) => el.textContent === t)!.getBoundingClientRect().height;
    const b = (name: string) => getComputedStyle(document.querySelector(`[data-variant="${name}"]`)!).borderTopWidth;
    return { sm: h("sm"), def: h("default"), ghost: b("ghost"), link: b("link") };
  }), { message: "button sizes @ 1280" }).toMatchObject({ sm: 32, def: 40, ghost: "0px", link: "0px" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(padLeft, { message: `page padding @ 1440` }).toEqual({ pad: 32, left: 152 });
  await expect(page.locator(".scroll-hint")).toHaveCount(0);
  await page.screenshot({ path: `${ART}/gallery-1440.png`, fullPage: true });
  await page.locator("[data-slot=button]").first().focus();
  const box = await page.locator("[data-slot=button]").first().boundingBox();
  if (box) await page.screenshot({ path: `${ART}/gallery-focus-button.png`, clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
  await page.screenshot({ path: `${ART}/gallery-focus.png`, fullPage: true });
});

// DS-09 explain kit: pointer hover, keyboard focus and tap show the same words; Enter opens a dialog; Escape returns focus.
const HINT = "Half of the families waited less than this, half waited more.";
const PLAIN = "How many days a family waited between the court order and their first therapy session.";
const FACES = "[data-slot=tooltip-content], [data-slot=hover-card-content]";
const serious = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));
for (const [slot, has, text] of [["hint-trigger", "Median", HINT], ["explain-trigger", "23 days", PLAIN]] as const) {
  test(`${slot}: hover, focus, Enter and Escape show the same words (DS-09)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/ui");
    const trigger = page.locator(`[data-slot=${slot}]`, { hasText: has }).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();
    await expect(page.locator(FACES)).toBeVisible();
    await expect(page.locator(FACES)).toContainText(text);
    // The faces close once the pointer settles elsewhere (the tooltip waits for a move outside its grace area).
    await expect(async () => { await page.mouse.move(4, 4); await expect(page.locator(FACES)).toHaveCount(0); }).toPass();
    await trigger.focus();
    await expect(page.locator(FACES)).toBeVisible();
    await expect(page.locator(FACES)).toContainText(text);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toContainText(text);
    await expect(page.locator(FACES)).toHaveCount(0);
    expect(await serious(page), "axe with the popover open").toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("explain triggers are 44 px at 375 and the Provenance dialog lists the stored-row ids (DS-09)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/ui");
  const sizes = await page.locator("[data-slot=hint-trigger]:visible, [data-slot=explain-trigger]:visible").evaluateAll((els) => els.map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)));
  expect(sizes.length).toBeGreaterThan(5);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(44);
  await page.locator("[data-slot=source-footer]", { hasText: "n = 86" }).locator("[data-slot=explain-trigger]").click();
  // Rows read label then value; textContent carries no separator between them.
  await expect(page.getByRole("dialog")).toContainText(/FAS records.*Case records FAS uploaded.*Source.?FAS records.?As of.?Sep 2026.?Period.?Jul–Sep 2026 \(Q3\).?n.?86.?Source id.?fas_upload.?Ingest run.?run_demo.?Last success.?Oct 2026.?Vintage.?2026-Q3/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 900 } });
  test("a tap opens the explain dialog with the same words; axe clean; no horizontal scroll (DS-09)", async ({ page }) => {
    await page.goto("/ui");
    const trigger = page.locator("[data-slot=explain-trigger]", { hasText: "23 days" });
    await trigger.scrollIntoViewIfNeeded();
    await trigger.tap();
    await expect(page.getByRole("dialog")).toContainText(PLAIN);
    expect(await serious(page), "axe with the popover open at 375").toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await page.locator("[data-slot=hint-trigger]", { hasText: "n<11" }).first().tap();
    await expect(page.getByRole("dialog")).toHaveText("Fewer than 11 families, so the number is hidden to protect privacy.");
  });
});
