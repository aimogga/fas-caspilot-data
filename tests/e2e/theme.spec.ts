import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** DS-19 dark mode: the Appearance choice in the account menu, persisted in localStorage, following the device by default, light in print. */
test.setTimeout(180_000);
const ART = "/opt/cursor/artifacts/DS-19";
const KEY = "fas-theme";
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id));
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const scheme = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
async function openMenu(page: Page) {
  await page.locator("[data-slot=user-menu] summary").click();
  await expect(page.locator("[data-slot=theme-menu]")).toBeVisible();
}
const option = (page: Page, name: string) => page.locator("[data-slot=theme-menu]").getByRole("button", { name, exact: false });

test("theme: Dark from the account menu sets html.dark and color-scheme, survives a reload, and is marked as pressed", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/staff");
  await page.emulateMedia({ colorScheme: "light" });
  expect(await isDark(page)).toBe(false);
  await openMenu(page);
  await expect(option(page, "Match device")).toHaveAttribute("aria-pressed", "true");
  await option(page, "Dark").click();
  expect(await isDark(page)).toBe(true);
  expect(await scheme(page)).toBe("dark");
  expect(await stored(page)).toBe("dark");
  await expect(option(page, "Dark")).toHaveAttribute("aria-pressed", "true");
  await expect(option(page, "Match device")).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  expect(await isDark(page), "the boot script restores the stored choice before hydration").toBe(true);
  await openMenu(page);
  await expect(option(page, "Dark")).toHaveAttribute("aria-pressed", "true");
  await option(page, "Light").click();
  expect(await isDark(page)).toBe(false);
  expect(await stored(page)).toBe("light");
});

test("theme: Match device removes the key and follows prefers-color-scheme live and after a reload; Light ignores the device", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/staff");
  await openMenu(page);
  await option(page, "Dark").click();
  await option(page, "Match device").click();
  expect(await stored(page)).toBeNull();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => isDark(page), { message: "follows the device without a reload" }).toBe(true);
  await page.reload();
  expect(await isDark(page)).toBe(true);
  expect(await scheme(page)).toBe("dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => isDark(page)).toBe(false);
  await page.emulateMedia({ colorScheme: "dark" });
  await openMenu(page);
  await option(page, "Light").click();
  expect(await isDark(page), "an explicit choice wins over the device").toBe(false);
  await page.reload();
  expect(await isDark(page)).toBe(false);
});

test("theme: the menu is keyboard operable with 44 px rows at 375; printing turns a dark page light", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/staff");
  await openMenu(page);
  const rows = page.locator("[data-slot=theme-option]");
  await expect(rows).toHaveCount(3);
  for (const h of await rows.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(h).toBeGreaterThanOrEqual(44);
  await expect(page.locator("[data-slot=theme-menu]")).toHaveAttribute("role", "group");
  await option(page, "Light").focus();
  await page.keyboard.press("Tab");
  await expect(option(page, "Dark")).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await isDark(page)).toBe(true);
  await expect(option(page, "Dark")).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ media: "print" });
  await expect.poll(() => isDark(page), { message: "print sheets stay one ink" }).toBe(false);
  await page.emulateMedia({ media: "screen" });
  await expect.poll(() => isDark(page)).toBe(true);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
});

test("theme: every main route reads correctly in dark: axe clean and no horizontal scroll at 375, 1024 and 1440", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/staff", "/dashboard", "/need-map", "/board"] as const) {
    for (const width of [375, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(await isDark(page), `${path} @ ${width}`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${path} @ ${width}`).toBeLessThanOrEqual(width);
      expect(await axe(page), `${path} @ ${width}`).toEqual([]);
      if (width === 1024) await page.screenshot({ path: `${ART}/${path.slice(1).replace(/\//g, "-")}-${width}-dark.png`, fullPage: false });
    }
  }
});

test("theme: signed-out pages follow the device too: /login and /403 dark, axe clean", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/login", "/403"] as const) {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(await isDark(page), path).toBe(true);
    expect(await scheme(page), path).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(375);
    expect(await axe(page), path).toEqual([]);
  }
});
