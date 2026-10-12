import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts";
const WIDTHS = [375, 1024, 1440] as const;

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return result.violations.map((v) => v.id);
}

async function submit(page: Page, email: string, password: string) {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

for (const width of WIDTHS) {
  test(`login at ${width}: layout, mobile rules, axe and screenshot`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to FAS Evidence" })).toBeVisible();
    await expect(page.locator("[data-slot=login-brand] [data-slot=wordmark]")).toBeVisible();
    const m = await page.evaluate(() => {
      const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const inputs = [...document.querySelectorAll<HTMLInputElement>("#email, #password")];
      return {
        scroll: document.documentElement.scrollWidth,
        inputFont: Math.min(...inputs.map((el) => parseFloat(getComputedStyle(el).fontSize))),
        inputH: Math.min(...inputs.map((el) => el.getBoundingClientRect().height)),
        emailLabelBottom: rect("label[for=email]").bottom,
        emailTop: rect("#email").top,
        emailWidth: rect("#email").width,
        cardWidth: rect("[data-slot=login-card]").width,
        h1Left: rect("h1").left,
        submit: rect("[data-slot=login-submit]"),
        toggle: rect("[data-slot=password-toggle]"),
        formBottom: rect("[data-slot=login-main]").bottom,
        panelTop: rect("[data-slot=login-panel]").top,
        panelLeft: rect("[data-slot=login-panel]").left,
        sampleDisplay: getComputedStyle(document.querySelector("[data-slot=login-sample]")!).display,
      };
    });
    expect(m.scroll).toBeLessThanOrEqual(width);
    expect(m.inputFont).toBeGreaterThanOrEqual(16);
    expect(m.inputH).toBeGreaterThanOrEqual(44);
    expect(m.emailLabelBottom).toBeLessThanOrEqual(m.emailTop);
    expect(m.emailWidth).toBeCloseTo(m.cardWidth, 0);
    expect(m.h1Left).toBeGreaterThanOrEqual(16);
    expect(m.submit.width).toBeCloseTo(m.cardWidth, 0);
    expect(m.submit.height).toBeGreaterThanOrEqual(44);
    expect(m.toggle.width).toBeGreaterThanOrEqual(44);
    expect(m.toggle.height).toBeGreaterThanOrEqual(44);
    if (width < 1024) {
      expect(m.inputH).toBeGreaterThanOrEqual(48);
      expect(m.submit.height).toBeGreaterThanOrEqual(48);
      expect(m.panelTop).toBeGreaterThanOrEqual(m.formBottom);
      expect(m.sampleDisplay).toBe("none");
    } else {
      expect(m.panelLeft).toBeGreaterThan(m.h1Left);
      expect(m.sampleDisplay).not.toBe("none");
      await expect(page.locator("[data-slot=login-sample-chip]")).toHaveText("Example");
    }
    expect(await axe(page)).toEqual([]);
    await page.screenshot({ path: `${ART}/login-${width}.png`, fullPage: true });
  });

  test(`login at ${width}: bad password shows the generic alert and moves focus to it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await submit(page, "staff@example.test", "wrong-password");
    const alert = page.locator("[data-slot=alert][role=alert]");
    await expect(alert).toHaveCount(1);
    await expect(alert).toContainText("Email or password is incorrect.");
    await expect(alert).toContainText("Check both and try again.");
    await expect(alert).not.toContainText(/5 attempts|15 minutes/);
    await expect(alert).not.toContainText(/invalid login credentials/i);
    await expect(alert).toBeFocused();
    const alertBottom = await alert.evaluate((el) => el.getBoundingClientRect().bottom);
    const emailTop = await page.locator("#email").evaluate((el) => el.getBoundingClientRect().top);
    expect(alertBottom).toBeLessThanOrEqual(emailTop);
    expect(await axe(page)).toEqual([]);
    await page.screenshot({ path: `${ART}/login-${width}-error.png`, fullPage: true });
  });
}

test("Show/Hide toggles the password field with aria-pressed", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  const toggle = page.locator("[data-slot=password-toggle]");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#password")).toHaveAttribute("type", "password");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#password")).toHaveAttribute("type", "text");
  await expect(toggle).toContainText("Hide");
});

test("success honors the redirect param", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login?redirect=%2Fboard");
  await Promise.all([page.waitForURL(/\/board$/, { timeout: 10000 }), submit(page, "admin@example.test", "testpass123")]);
  await expect(page).toHaveURL(/\/board$/);
});
