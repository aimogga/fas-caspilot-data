import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ART = "/opt/cursor/artifacts";

test("gallery sizes, axe, and screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/ui");
  await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible();
  const m = await page.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    const buttons = [...document.querySelectorAll("[data-slot=button]")];
    const inputs = [...document.querySelectorAll("[data-slot=input]")];
    const label = document.querySelector("[data-slot=label]");
    const input = inputs[0];
    return {
      minTap: Math.min(...buttons.flatMap((el) => [box(el).height, box(el).width]), ...inputs.map((el) => box(el).height)),
      inputPx: Math.min(...inputs.map((el) => parseFloat(getComputedStyle(el).fontSize))),
      labelBlock: label ? getComputedStyle(label).display === "block" : false,
      stacked: !!(label && input && box(label).bottom <= box(input).top + 1),
      scroll: document.documentElement.scrollWidth,
    };
  });
  expect(m.minTap).toBeGreaterThanOrEqual(44);
  expect(m.inputPx).toBeGreaterThanOrEqual(16);
  expect(m).toMatchObject({ labelBlock: true, stacked: true });
  expect(m.scroll).toBeLessThanOrEqual(376);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await page.screenshot({ path: `${ART}/gallery-375.png`, fullPage: true });
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({ path: `${ART}/gallery-1024.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${ART}/gallery-1440.png`, fullPage: true });
  const button = page.locator("[data-slot=button]").first();
  const input = page.locator("[data-slot=input]").first();
  await button.focus();
  await page.screenshot({ path: `${ART}/gallery-focus.png`, fullPage: true });
  for (const el of [button, input]) {
    await el.focus();
    const ring = await el.evaluate((n) => `${getComputedStyle(n).outlineStyle} ${getComputedStyle(n).boxShadow}`);
    expect(ring).not.toMatch(/none rgba\(0, 0, 0, 0\)/);
  }
});
