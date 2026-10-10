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

test("login at 375 uses mobile tokens and stacked fields", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/login");
  const m = await page.evaluate(() => {
    const input = document.querySelector("input");
    const button = document.querySelector("button");
    const label = document.querySelector("label");
    const box = (el: Element | null) => (el ? el.getBoundingClientRect() : { height: 0, width: 0 });
    return {
      tap: getComputedStyle(document.documentElement).getPropertyValue("--tap-min").trim(),
      font: getComputedStyle(document.documentElement).getPropertyValue("--input-font").trim(),
      gutter: getComputedStyle(document.documentElement).getPropertyValue("--page-gutter-mobile").trim(),
      pad: parseFloat(getComputedStyle(document.body).paddingLeft),
      inputPx: input ? parseFloat(getComputedStyle(input).fontSize) : 0,
      inputH: box(input).height,
      btnH: box(button).height,
      btnW: box(button).width,
      labelBlock: label ? getComputedStyle(label).display === "block" : false,
      noHScroll: document.documentElement.scrollWidth <= 375 + 1,
    };
  });
  expect(m).toMatchObject({ tap: "44px", font: "16px", gutter: "16px", labelBlock: true, noHScroll: true });
  expect(m.pad).toBeGreaterThanOrEqual(16);
  expect(m.inputPx).toBeGreaterThanOrEqual(16);
  expect(m.inputH).toBeGreaterThanOrEqual(44);
  expect(m.btnH).toBeGreaterThanOrEqual(44);
  expect(m.btnW).toBeGreaterThanOrEqual(44);
});
