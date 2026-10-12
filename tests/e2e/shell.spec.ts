import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts";
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("role nav and shell screenshots", async ({ page }) => {
  const cases = [
    ["admin@example.test", "/admin", ["Home", "Overview"], "Admin", false, "Admin · Overview"],
    ["staff@example.test", "/staff", ["Home"], "Staff", false, "Home"],
    ["board@example.test", "/board", ["Board dashboard"], "Board · read-only", true, "Board home"],
  ] as const;
  for (const [email, path, labels, role, footer, crumb] of cases) {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);
    await expect(page.locator("[data-slot=sidebar] nav a")).toHaveText([...labels]);
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
  for (const width of [800, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/staff");
    await page.screenshot({ path: `${ART}/shell-staff-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/board");
  await page.screenshot({ path: `${ART}/shell-board-1024.png`, fullPage: true });
});
