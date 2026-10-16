import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { FOUNDATION_FIELDS } from "../../lib/grants/foundation";
import { FORM_HELP, HIDDEN } from "../../lib/grants/form-words";

/** DS-24: the Foundation grants page in words. Header, a helper sentence on every field, every list value explains itself, 44 px targets, clean at three widths in light and dark. */
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id));
async function signIn(page: Page) {
  await page.goto("/login"); await page.fill("#email", "staff@example.test"); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
/** A synthetic row with no award; the far close date sorts it first among this month's entries, so it is always in the newest 10. */
async function addBareRow(page: Page) {
  const title = `Synthetic Bare Grant ${Date.now()}`;
  expect((await page.request.post("/api/grants/foundation", { data: { mode: "manual", row: { title, funder: "Synthetic Bare Foundation", close_date: "2099-12-31" } } })).status()).toBe(201);
  return title;
}

test("staff: header in words; every form field and the file input name a helper sentence in aria-describedby", async ({ page }) => {
  await signIn(page);
  await page.goto("/staff/grants");
  await expect(page.locator("[data-slot=page-header] p").first()).toHaveText("Foundation grants");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add the grants foundations publish");
  await expect(page.getByRole("heading", { level: 2, name: "Recently added foundation grants" })).toBeVisible();
  for (const f of FOUNDATION_FIELDS) {
    const input = page.locator(`#fo-${f.key}`);
    await expect(input, f.key).toHaveAttribute("aria-describedby", `fo-${f.key}-hint`);
    await expect(input, f.key).not.toHaveAttribute("placeholder", /.+/);
    await expect(page.locator(`#fo-${f.key}-hint`), f.key).toHaveText(FORM_HELP[f.key]);
  }
  await expect(page.locator("#fo-file")).toHaveAttribute("aria-describedby", "fo-file-help");
  await expect(page.locator("[data-slot=dropzone]")).toContainText("Every row is checked before anything is saved.");
  await page.getByRole("button", { name: "Save opportunity" }).click();
  await expect(page.locator("#fo-title")).toHaveAttribute("aria-describedby", "fo-title-hint fo-title-err");
});

test("staff: award, close date and Manual entry explain themselves; hover, focus and tap show the same words; Escape returns focus", async ({ page }) => {
  await signIn(page);
  const title = await addBareRow(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/staff/grants");
  const row = page.locator("[data-slot=recent-row]", { hasText: title }), card = page.locator("[data-slot=explain-layer-card]");
  await expect(page.locator("[data-slot=recent-note]")).toContainText("“Award not stated” mean the listing did not say");
  for (const [text, term, words] of [["Award not stated", "Award range", HIDDEN.award], ["Closes Dec 31, 2099", "Close date", "Dec 31, 2099"], ["Manual entry", "Manual entry", "Added by hand"]] as const) {
    const target = row.locator("[data-slot=recent-value]", { hasText: text });
    await target.hover();
    await expect(card).toContainText(term); await expect(card).toContainText(words); await expect(card).toContainText("Typed in by FAS staff");
    const hovered = await card.textContent();
    await page.mouse.move(0, 0); await target.focus();
    await expect(card).toHaveText(hovered ?? "");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveText(hovered ?? "");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0); await expect(target).toBeFocused();
  }
  await expect(row).not.toContainText("$0");
});

test("staff: list values are 44 px tall at 375; no horizontal scroll and axe clean at 375, 1024 and 1440 in light and dark", async ({ page }) => {
  await signIn(page);
  await addBareRow(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [375, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/staff/grants");
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.classList.contains("dark")), `${scheme} @ ${width}`).toBe(scheme === "dark");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${scheme} @ ${width}`).toBeLessThanOrEqual(width);
      expect(await axe(page), `${scheme} @ ${width}`).toEqual([]);
      if (width === 375) {
        const heights = await page.locator("[data-slot=recent-value]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
        expect(heights.length).toBeGreaterThan(0); expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
