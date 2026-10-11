import { expect, test, type Page } from "@playwright/test";

/** Main (6fc8976) content-box of login `main`, 403 wrapper, and PageLayout inner box. */
const MAIN: Record<number, Record<string, { left: number; top: number; width: number }>> = {
  375: { "/login": { left: 16, top: 0, width: 343 }, "/403": { left: 16, top: 0, width: 343 }, "/staff": { left: 36, top: 70, width: 303 }, "/board": { left: 36, top: 70, width: 303 }, "/admin": { left: 36, top: 70, width: 303 } },
  1280: { "/login": { left: 16, top: 0, width: 1248 }, "/403": { left: 16, top: 0, width: 1248 }, "/staff": { left: 260, top: 70, width: 760 }, "/board": { left: 260, top: 70, width: 760 }, "/admin": { left: 260, top: 70, width: 760 } },
};

async function box(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
  return page.evaluate(() => {
    const el = document.querySelector("main") ?? document.body.firstElementChild;
    if (!el) return { left: 0, top: 0, width: 0 };
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const pl = parseFloat(s.paddingLeft) || 0;
    const pr = parseFloat(s.paddingRight) || 0;
    const pt = parseFloat(s.paddingTop) || 0;
    return { left: Math.round(r.left + pl), top: Math.round(r.top + pt), width: Math.round(r.width - pl - pr) };
  });
}

test("existing screens match main content boxes at 375 and 1280", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@example.test");
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
  for (const width of [375, 1280] as const) {
    for (const path of ["/login", "/403", "/staff", "/board", "/admin"] as const) {
      const got = await box(page, path, width);
      const exp = MAIN[width][path]!;
      expect(got, `${path} @ ${width}`).toEqual(exp);
    }
  }
});
