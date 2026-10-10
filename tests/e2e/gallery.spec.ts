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
  await page.goto("/ui");
  await page.keyboard.press("Tab");
  const button = page.locator("[data-slot=button]").first();
  await expect(button).toBeFocused();
  expect(await button.evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("solid");
  expect(await button.evaluate((n) => getComputedStyle(n).outlineWidth)).toBe("2px");
  const box = await button.boundingBox();
  if (box) {
    await page.screenshot({
      path: `${ART}/gallery-focus-button.png`,
      clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 },
    });
  }
  await page.screenshot({ path: `${ART}/gallery-focus.png`, fullPage: true });
  await page.getByRole("button", { name: "Add" }).press("Tab");
  expect(await page.locator("[data-slot=input]").evaluate((n) => getComputedStyle(n).outlineStyle)).toBe("solid");
  expect(await page.locator("[data-slot=input]").evaluate((n) => getComputedStyle(n).outlineWidth)).toBe("2px");
});
