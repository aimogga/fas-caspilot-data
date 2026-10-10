import { expect, test } from "@playwright/test";

test("login uses design tokens, Inter, and Source Serif 4", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);

  const computed = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return {
      primary: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
      bodyFont: getComputedStyle(document.body).fontFamily,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : "",
    };
  });

  expect(computed.primary).toBe("oklch(0.38 0.06 160)");
  expect(computed.bodyFont).toMatch(/Inter/i);
  expect(computed.h1Font).toMatch(/Source Serif/i);
});
