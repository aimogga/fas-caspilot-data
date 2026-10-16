import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { SECTIONS } from "../../lib/shell/sections";

/** DS-18b: a glyph on every nav link (sidebar, rail and sheet); the admin overview and the entry page clean at three widths. DS-21: five workspace links, tabs inside the sections. */
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
  expect(wide).toHaveLength(8);
  for (const l of wide) expect(l, l.href ?? "").toMatchObject({ svgs: 1, hidden: "true", w: 16, h: 16, labelWide: true });
  expect(new Set(await page.locator("[data-slot=sidebar] nav a svg").evaluateAll((els) => els.map((e) => e.innerHTML))).size, "eight different glyphs").toBe(8);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/admin");
  const rail = await linkFacts(page, "[data-slot=sidebar]");
  for (const l of rail) expect(l, l.href ?? "").toMatchObject({ svgs: 1, w: 16, h: 16, labelWide: false });
  expect(Math.min(...rail.map((l) => l.tall))).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = await linkFacts(page, "#nav-sheet");
  expect(sheet).toHaveLength(8);
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

const TABS = SECTIONS.flatMap((section) => section.tabs.map((tab) => ({ section: section.label, ...tab, labels: section.tabs.map((t) => t.label) })));
const tabs = (page: Page) => page.locator("#main [data-slot=section-tabs]");

test("staff: five workspace links; a section link opens its first tab and the tabs reach every page", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/staff");
  await expect(page.locator("[data-slot=sidebar] nav [data-slot=nav-group]").first().locator("a")).toHaveText(["Home", "Insights", "Data", "Grants", "Evidence packets"]);
  await expect(tabs(page)).toHaveCount(0);
  await page.locator("[data-slot=sidebar] nav a", { hasText: "Data" }).click();
  await expect(page).toHaveURL(/\/staff\/intake$/);
  await tabs(page).getByRole("link", { name: "Methodology" }).click();
  await expect(page).toHaveURL(/\/methodology$/);
  await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page]")).toHaveText("Data");
  await page.locator("[data-slot=sidebar] nav a", { hasText: "Grants" }).click();
  await tabs(page).getByRole("link", { name: "Matches" }).click();
  await expect(page).toHaveURL(/\/staff\/grants\/matches$/);
});

test("admin: every tab route names its section, marks one tab current, and is clean at 375, 1024 and 1440", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "admin@example.test");
  for (const t of TABS) {
    for (const width of [375, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(t.href);
      await expect(page.locator("h1")).toBeVisible();
      const nav = tabs(page);
      await expect(nav, t.href).toHaveAttribute("aria-label", `${t.section} pages`);
      await expect(nav.locator("a")).toHaveText(t.labels);
      await expect(nav.locator("a[aria-current=page]")).toHaveText(t.label);
      await expect(page.locator("[data-slot=crumbs]")).toHaveText(`${t.section} · ${t.label}`);
      const box = await nav.locator("a").evaluateAll((els) => els.map((a) => { const r = a.getBoundingClientRect(); return { top: Math.round(r.top), h: r.height }; }));
      expect(new Set(box.map((b) => b.top)).size, `one row @ ${width}`).toBe(1);
      if (width < 1024) expect(Math.min(...box.map((b) => b.h)), `44 px taps @ ${width}`).toBeGreaterThanOrEqual(44);
      // The current tab is in view inside its row, even when the row scrolls sideways at 375.
      await expect.poll(() => nav.evaluate((n) => { const r = n.querySelector("ul")!.getBoundingClientRect(), a = n.querySelector("[aria-current=page]")!.getBoundingClientRect(); return a.left >= r.left - 1 && a.right <= r.right + 1; })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${t.href} @ ${width}`).toBeLessThanOrEqual(width);
      expect(await axe(page), `${t.href} @ ${width}`).toEqual([]);
    }
  }
  for (const path of ["/staff", "/staff/packets", "/board", "/admin"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await expect(tabs(page), path).toHaveCount(0);
  }
});

test("board viewer: same three links, no tabs anywhere", async ({ page }) => {
  await signIn(page, "board@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [path, current] of [["/board", "Board dashboard"], ["/need-map", "County need map"], ["/methodology", "Methodology"]] as const) {
    await page.goto(path);
    await expect(page.locator("[data-slot=sidebar] nav a")).toHaveText(["Board dashboard", "County need map", "Methodology"]);
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page]")).toHaveText(current);
    await expect(page.locator("[data-slot=crumbs]")).toHaveText(current);
    await expect(tabs(page)).toHaveCount(0);
  }
});
