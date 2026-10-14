import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { HIDDEN_LABELS } from "../../lib/shell/nav";

const ART = "/opt/cursor/artifacts";
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("role nav, mobile sheet, and shell screenshots", async ({ page }) => {
  const cases = [
    ["admin@example.test", "/admin", ["Home", "Upload data", "Overview"], "Admin", false, "Admin · Overview"],
    ["staff@example.test", "/staff", ["Home", "Upload data"], "Staff", false, "Home"],
    ["board@example.test", "/board", ["Board dashboard"], "Board · read-only", true, "Board dashboard"],
  ] as const;
  for (const [email, path, labels, role, footer, crumb] of cases) {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    await expect(page.locator("[data-slot=sidebar] nav a")).toHaveText([...labels]);
    for (const name of HIDDEN_LABELS) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
    await expect(page.locator("[data-slot=crumbs]")).toHaveText(crumb);
    await expect(page.locator("[data-slot=user-role]")).toHaveText(role);
    expect(await axe(page)).toEqual([]);
    await expect(page.locator("main")).not.toContainText("Role:");
    await expect(page.locator("body")).not.toContainText(/case\s*pilot/i);
    if (footer) await expect(page.locator("[data-slot=board-footer]")).toHaveText("Read-only access · aggregates only");
    else await expect(page.locator("[data-slot=sidebar] [data-slot=preview-footer]")).toHaveText("Synthetic data · preview");
    expect(await page.locator("[data-slot=sidebar] a[aria-current=page]").evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe("2px");
    await page.screenshot({ path: `${ART}/shell-${path.slice(1)}-1440.png`, fullPage: true });
    await page.locator("[data-slot=sidebar] nav a").last().focus();
    await page.locator("[data-slot=user-menu] summary").click();
    await expect(page.locator("[data-slot=role-label]")).toHaveText(role);
    await expect(page.locator("[data-slot=env-badge]")).toHaveText("Synthetic data");
    await expect(page.locator("[data-slot=freshness-slot]")).toBeHidden();
    await page.context().clearCookies();
  }
  await signIn(page, "admin@example.test");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/staff");
  await expect(page.locator("[data-slot=topbar-brand] [data-slot=wordmark]")).toBeVisible();
  const menu = page.getByRole("button", { name: "Open navigation" });
  const sheet = page.locator("#nav-sheet");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAttribute("aria-controls", "nav-sheet");
  expect((await menu.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  expect(await axe(page)).toEqual([]);
  await page.screenshot({ path: `${ART}/shell-staff-375-closed.png`, fullPage: true });
  await menu.click();
  await expect(sheet).toBeVisible();
  await expect(page.locator("#nav-sheet nav a").first()).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
  }
  const focusInSheet = await page.evaluate(() => !!document.querySelector("#nav-sheet")?.contains(document.activeElement));
  expect(focusInSheet).toBe(true);
  const scrollLocked = await page.evaluate(() => document.body.hasAttribute("data-scroll-locked") || getComputedStyle(document.body).overflow === "hidden");
  expect(scrollLocked).toBe(true);
  expect(await axe(page)).toEqual([]);
  const minTarget = await page.evaluate(() => {
    const visible = [...document.querySelectorAll("a, button, summary")].filter((el) => {
      const r = el.getBoundingClientRect();
      return getComputedStyle(el).display !== "none" && r.width > 0 && r.height > 0;
    });
    return Math.min(...visible.map((el) => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height)));
  });
  expect(minTarget).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: `${ART}/shell-staff-375-open.png`, fullPage: true });
  const closers = [
    () => page.keyboard.press("Escape"),
    () => page.mouse.click(360, 400),
    () => sheet.getByRole("button", { name: "Close" }).click(),
  ];
  for (const close of closers) {
    if (!(await sheet.count())) await menu.click();
    await expect(sheet).toBeVisible();
    await close();
    await expect(sheet).toHaveCount(0);
    await expect(menu).toBeFocused();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await menu.click();
  await expect(sheet).toBeVisible();
  expect(await sheet.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await sheet.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(menu).toBeFocused();
  for (const width of [800, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/staff");
    await page.screenshot({ path: `${ART}/shell-staff-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/board");
  await page.screenshot({ path: `${ART}/shell-board-1024.png`, fullPage: true });
});
