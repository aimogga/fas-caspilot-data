import { expect, test, type Page } from "@playwright/test";

/** Signed-out screens in the Page container (h1 left, content width, container width). */
// Eight shell routes at several widths, each compiled on first hit by the dev server: the 30 s default timed out on CI.
test.setTimeout(120_000);

const SIGNED_OUT: Record<number, { left: number; width: number; container?: number }> = {
  375: { left: 16, width: 343 },
  800: { left: 24, width: 752 },
  1024: { left: 32, width: 960 },
  1440: { left: 152, width: 1136, container: 1200 },
};

const SHELL: Record<number, { left: number; width: number; container?: number }> = {
  375: { left: 16, width: 343 },
  800: { left: 80, width: 696 },
  1024: { left: 288, width: 704 },
  1280: { left: 288, width: 960 },
  1440: { left: 288, width: 1120, container: 1184 },
};

/** Geometry once two reads 150 ms apart agree: a first read mid-hydration (fonts, the sheet nav settling at the md edge) measured 94/668 instead of 80/696 at 800. */
async function pageBox(page: Page) {
  await expect(page.locator("h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  let last = await readBox(page);
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(150);
    const next = await readBox(page);
    if (JSON.stringify(next) === JSON.stringify(last)) return next;
    last = next;
  }
  return last;
}
function readBox(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const el = document.querySelector("[data-slot=page]");
    if (!h1 || !el) return null;
    const s = getComputedStyle(el);
    const pl = parseFloat(s.paddingLeft) || 0;
    const pr = parseFloat(s.paddingRight) || 0;
    return {
      left: Math.round(h1.getBoundingClientRect().left),
      width: Math.round(el.clientWidth - pl - pr),
      container: el.clientWidth,
      scroll: document.documentElement.scrollWidth,
    };
  });
}

test("signed-out screens use the Page layout at 375, 800, 1024 and 1440", async ({ page }) => {
  for (const path of ["/login", "/dev-error?kind=notfound", "/dev-error"] as const) {
    for (const width of [375, 800, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      const got = await pageBox(page);
      const exp = SIGNED_OUT[width];
      expect(got, `${path} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width });
      if (exp.container) expect(got?.container, `${path} container @ ${width}`).toBe(exp.container);
    }
  }
});

test("existing screens use the shell Page layout", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", "admin@example.test");
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
  for (const width of [375, 800, 1024, 1280, 1440] as const) {
    for (const path of ["/admin", "/staff", "/staff/intake", "/staff/entry", "/staff/grants", "/staff/grants/matches", "/board", "/403"] as const) {
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
      // On a horizontal overflow, name the widest elements so the failing run says what pushed past the viewport.
      if (got && got.scroll > width) console.log(`${path} @ ${width} overflow:`, await page.evaluate(() => [...document.querySelectorAll("body *")]
        .map((el) => ({ right: Math.round(el.getBoundingClientRect().right), tag: el.tagName.toLowerCase(), pos: getComputedStyle(el).position, id: el.getAttribute("data-slot") || el.id || el.className.toString().slice(0, 40) }))
        .filter((x) => x.right > window.innerWidth).sort((a, b) => b.right - a.right).slice(0, 8)));
      expect(got, `${path} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width, inner: width });
      if (exp.container) expect(got?.container, `${path} container @ ${width}`).toBe(exp.container);
      if (width === 375) {
        expect(got?.topbar).toBe("sticky");
        expect(got?.sidebarDisplay).toBe("none");
      }
    }
  }
});

async function signInAs(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

test("signed-in 404, signed-in error and the / redirect use the shell Page layout", async ({ page }) => {
  await signInAs(page, "admin@example.test");
  for (const path of ["/dev-error?kind=notfound", "/dev-error", "/"] as const) {
    for (const width of [375, 800, 1024, 1280, 1440] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      const got = await pageBox(page);
      const exp = SHELL[width];
      expect(got, `${path} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width });
      if (exp.container) expect(got?.container, `${path} container @ ${width}`).toBe(exp.container);
    }
  }
});

for (const [email, paths] of [["staff@example.test", ["/need-map"]], ["board@example.test", ["/need-map", "/need-map?fas=1"]]] as const) {
  test(`need map uses the shell Page layout for ${email}`, async ({ page }) => {
    await signInAs(page, email);
    for (const path of paths) {
      for (const width of [375, 800, 1024, 1440] as const) {
        await page.setViewportSize({ width, height: 812 });
        await page.goto(path);
        const got = await pageBox(page);
        const exp = SHELL[width];
        expect(got, `${path} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width });
        if (exp.container) expect(got?.container, `${path} container @ ${width}`).toBe(exp.container);
      }
    }
  });
}

test("placeholder subtitle left edge equals the h1 left edge", async ({ page }) => {
  await signInAs(page, "admin@example.test");
  for (const width of [375, 1024, 1440] as const) {
    for (const path of ["/staff", "/admin", "/board"] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const edges = await page.evaluate(() => {
        const header = document.querySelector("[data-slot=page-header]"), h1 = header?.querySelector("h1");
        const sub = header?.querySelector(":scope > p:not([class])") ?? header?.nextElementSibling;
        return { h1: h1?.getBoundingClientRect().left ?? -1, sub: sub?.getBoundingClientRect().left ?? -2 };
      });
      expect(Math.abs(edges.sub - edges.h1), `${path} @ ${width}`).toBeLessThanOrEqual(1);
    }
  }
});

test("methodology uses the shell Page layout for staff and board (DS-08)", async ({ page }) => {
  for (const email of ["staff@example.test", "board@example.test"] as const) {
    await signInAs(page, email);
    for (const width of [375, 800, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/methodology");
      const exp = SHELL[width];
      expect(await pageBox(page), `/methodology ${email} @ ${width}`).toMatchObject({ left: exp.left, width: exp.width, scroll: width, ...(exp.container ? { container: exp.container } : {}) });
    }
    await page.context().clearCookies();
  }
});

test("team dashboard uses the shell Page layout for staff; board sees the signed-in 403 (DS-07a)", async ({ page }) => {
  for (const [email, path] of [["staff@example.test", "/dashboard"], ["staff@example.test", "/dashboard?compare=prior"], ["board@example.test", "/dashboard"]] as const) {
    await signInAs(page, email);
    for (const width of [375, 800, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto(path);
      const { left, width: w, container } = SHELL[width];
      expect(await pageBox(page), `${path} ${email} @ ${width}`).toMatchObject({ left, width: w, scroll: width, ...(container ? { container } : {}) });
    }
    await page.context().clearCookies();
  }
});

test("data freshness uses the shell Page layout for staff; board sees the signed-in 403 (DS-05a)", async ({ page }) => {
  for (const email of ["staff@example.test", "board@example.test"] as const) {
    await signInAs(page, email);
    for (const width of [375, 800, 1024, 1440] as const) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto("/data-freshness");
      const { left, width: w, container } = SHELL[width];
      expect(await pageBox(page), `/data-freshness ${email} @ ${width}`).toMatchObject({ left, width: w, scroll: width, ...(container ? { container } : {}) });
    }
    await page.context().clearCookies();
  }
});
