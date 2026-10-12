import { expect, test, type Page } from "@playwright/test";

/** Main (6fc8976) content-box of login `main` and the 403 wrapper. Role pages moved in DS-02. */
const MAIN: Record<number, Record<string, { left: number; top: number; width: number }>> = {
  375: { "/login": { left: 16, top: 0, width: 343 }, "/403": { left: 16, top: 0, width: 343 } },
  1280: { "/login": { left: 16, top: 0, width: 1248 }, "/403": { left: 16, top: 0, width: 1248 } },
};

const SHELL: Record<number, { left: number; width: number; container?: number }> = {
  375: { left: 16, width: 343 },
  800: { left: 80, width: 696 },
  1024: { left: 288, width: 704 },
  1280: { left: 288, width: 960 },
  1440: { left: 288, width: 1120, container: 1184 },
};

async function box(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 812 });
  await page.goto(path);
  await expect(page.locator("h1")).toBeVisible();
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const el = h1?.closest("main") ?? h1?.parentElement;
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
    for (const path of ["/login", "/403"] as const) {
      const got = await box(page, path, width);
      expect(got, `${path} @ ${width}`).toEqual(MAIN[width][path]);
    }
  }
  for (const width of [375, 800, 1024, 1280, 1440] as const) {
    for (const path of ["/admin", "/staff", "/board"] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const got = await page.evaluate(() => {
        const h1 = document.querySelector("h1");
        const el = document.querySelector("[data-slot=page]");
        if (!h1 || !el) return null;
        const s = getComputedStyle(el);
        const pl = parseFloat(s.paddingLeft) || 0;
        const pr = parseFloat(s.paddingRight) || 0;
        const sidebar = document.querySelector("[data-slot=sidebar]");
        const topbar = document.querySelector("[data-slot=topbar]");
        return {
          left: Math.round(h1.getBoundingClientRect().left),
          width: Math.round(el.clientWidth - pl - pr),
          container: el.clientWidth,
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
          topbar: topbar ? getComputedStyle(topbar).position : "",
          sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : "",
        };
      });
      const exp = SHELL[width];
      expect(got, `${path} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width, inner: width });
      if (exp.container) expect(got?.container, `${path} container @ ${width}`).toBe(exp.container);
      if (width === 375) {
        expect(got?.topbar).toBe("sticky");
        expect(got?.sidebarDisplay).toBe("none");
      }
    }
  }
});
