import { expect, test } from "@playwright/test";

test("login uses design tokens, Inter, and Source Serif 4", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.evaluate(() => document.fonts.ready);
  const computed = await page.evaluate(() => {
    const used = (value: string) => {
      const el = document.createElement("span");
      el.style.color = value;
      document.body.append(el);
      const { color } = getComputedStyle(el);
      el.remove();
      return color;
    };
    const h1 = document.querySelector("h1");
    return {
      primary: used("var(--primary)"),
      expected: used("oklch(0.38 0.06 160)"),
      bodyFont: getComputedStyle(document.body).fontFamily,
      h1Font: h1 ? getComputedStyle(h1).fontFamily : "",
    };
  });
  expect(computed.primary).toBe(computed.expected);
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
      pad: parseFloat(getComputedStyle(document.querySelector("[data-slot=page]")!).paddingLeft),
      inputPx: input ? parseFloat(getComputedStyle(input).fontSize) : 0,
      inputH: box(input).height,
      btnH: box(button).height,
      btnW: box(button).width,
      labelBlock: label ? getComputedStyle(label).display === "block" : false,
      noHScroll: document.documentElement.scrollWidth <= 375 + 1,
      inputBorder: input ? parseFloat(getComputedStyle(input).borderTopWidth) : 0,
      inputBorderColor: input ? getComputedStyle(input).borderTopColor : "",
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(m).toMatchObject({ tap: "44px", font: "16px", gutter: "16px", labelBlock: true, noHScroll: true });
  expect(m.pad).toBeGreaterThanOrEqual(16);
  expect(m.inputPx).toBeGreaterThanOrEqual(16);
  expect(m.inputH).toBeGreaterThanOrEqual(44);
  expect(m.btnH).toBeGreaterThanOrEqual(44);
  expect(m.btnW).toBeGreaterThanOrEqual(44);
  expect(m.inputBorder).toBeGreaterThanOrEqual(1);
  expect(m.inputBorderColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(m.inputBorderColor).not.toBe(m.bodyBg);
});

test("native Sign In and Sign Out are 44px at 1280", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  expect(await page.getByRole("button", { name: "Sign In" }).evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.fill("#email", "staff@example.test");
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
  expect(await page.getByRole("button", { name: "Sign Out" }).evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});
