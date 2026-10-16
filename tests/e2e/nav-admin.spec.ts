import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** DS-18b: a glyph on all 12 nav links (sidebar, rail and sheet); the admin overview and the entry page clean at three widths. */
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id));

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
/** One svg per link, hidden from readers, 16 × 16; the link itself keeps its label and its 44 px height. */
const linkFacts = (page: Page, scope: string) => page.locator(`${scope} nav a`).evaluateAll((els) => els.map((a) => {
  const svgs = a.querySelectorAll("svg"), r = svgs[0]?.getBoundingClientRect(), box = a.getBoundingClientRect();
  const label = a.querySelector<HTMLElement>("[data-rail=hide]");
  return { href: a.getAttribute("href"), svgs: svgs.length, hidden: svgs[0]?.getAttribute("aria-hidden"), w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0, tall: box.height, labelWide: label ? label.getBoundingClientRect().width > 1 : false };
}));

test("admin: every sidebar link has one 16 px hidden glyph at 1440; the 800 rail keeps the glyph and hides the label; the sheet shows both at 375", async ({ page }) => {
  await signIn(page, "admin@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const wide = await linkFacts(page, "[data-slot=sidebar]");
  expect(wide).toHaveLength(12);
  for (const l of wide) expect(l, l.href ?? "").toMatchObject({ svgs: 1, hidden: "true", w: 16, h: 16, labelWide: true });
  expect(new Set(await page.locator("[data-slot=sidebar] nav a svg").evaluateAll((els) => els.map((e) => e.innerHTML))).size, "twelve different glyphs").toBe(12);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/admin");
  const rail = await linkFacts(page, "[data-slot=sidebar]");
  for (const l of rail) expect(l, l.href ?? "").toMatchObject({ svgs: 1, w: 16, h: 16, labelWide: false });
  expect(Math.min(...rail.map((l) => l.tall))).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = await linkFacts(page, "#nav-sheet");
  expect(sheet).toHaveLength(12);
  for (const l of sheet) expect(l, l.href ?? "").toMatchObject({ svgs: 1, hidden: "true", w: 16, labelWide: true });
  expect(Math.min(...sheet.map((l) => l.tall))).toBeGreaterThanOrEqual(44);
});

test("admin overview and entry page: no horizontal scroll and axe clean at 375, 1024 and 1440", async ({ page }) => {
  await signIn(page, "admin@example.test");
  for (const path of ["/admin", "/staff/entry"] as const) {
    for (const width of [375, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} @ ${width}`).toBeLessThanOrEqual(width);
      expect(await axe(page), `${path} @ ${width}`).toEqual([]);
    }
  }
});
