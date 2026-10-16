import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/ds-05a";
const HEADERS = ["Source", "Latest vintage", "Last successful run", "Cadence", "Status"];

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

for (const [email, admin] of [["staff@example.test", false], ["admin@example.test", true]] as const) {
  test(`data freshness page for ${email}: table, statuses, nav, axe, screenshots (DS-05a, F-209)`, async ({ page }) => {
    await signIn(page, email);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect((await page.goto("/data-freshness"))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data freshness");
    await expect(page.locator("[data-slot=page-header] p").first()).toHaveText("WORKSPACE");
    await expect(page.locator("[data-slot=page-header] p").nth(1)).toContainText(/^\d+ public sources: /);
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page], [data-slot=crumbs]")).toHaveText(["Data", "Data · Freshness"]);
    await expect(page.locator("thead th")).toHaveText(admin ? [...HEADERS, "Latest load"] : HEADERS);
    // DS-16a AC5: the source column is words, never a registry code.
    for (const th of await page.locator("tbody th[scope=row]").all()) await expect(th.locator("span").first()).not.toHaveText(/^[a-z0-9]+[-_][a-z0-9_-]+$/);
    const stale = page.locator("tr[data-row=example-monthly-source]");
    await expect(stale).toContainText(/Example monthly source.*Example owner.*Monthly.*Stale since \w{3} \d{1,2}, \d{4}\s*·\s*\d+ days/s);
    // Every cell carries its md:hidden mobile label ("Last successful run: "); textContent includes it at any width.
    await expect(stale.locator("td").nth(1)).toHaveText(/^Last successful run:\s*\w{3} \d{1,2}, \d{4}$/);
    const failed = page.locator("tr[data-row=example-failed-source]");
    await expect(failed).toContainText(/Example failed source.*Quarterly.*Failed on \w{3} \d{1,2}, \d{4}/s);
    await expect(failed.locator("td").nth(1)).toHaveText(/^Last successful run:\s*\w{3} \d{1,2}, \d{4}$/);
    // DS-16a AC3: admins get the run cell in words and the full id in its card; staff never see a run id or the column.
    if (admin) {
      const runCell = failed.locator("[data-slot=run]");
      await expect(runCell).toHaveText(/^Latest load:\s*\w{3} \d{1,2}, \d{4}\s*·\s*Failed$/);
      await runCell.locator("[data-slot=explain-trigger]").hover();
      await expect(page.locator("[data-slot=hover-card-content] [data-slot=explain-content]")).toContainText(/Latest load.*Run id\s*dddddddd-dddd-dddd-dddd-ddddddddddd3.*Started.*Status\s*Failed/s);
      await page.mouse.move(0, 0);
    } else {
      await expect(page.locator("main")).not.toContainText(/Latest load|dddddddd/);
    }
    const statuses = await page.locator("tbody tr").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-status") ?? ""));
    const ranks = statuses.map((s) => ["failed", "stale", "not_published", "current"].indexOf(s));
    expect(ranks, "rows sorted Failed → Stale → Not published → Current").toEqual([...ranks].sort((a, b) => a - b));
    // DS-16a AC4: every status is a glyph, a word and a date, inside one hint trigger.
    const STATUS = /^Status:\s*\W*(Current\s*(·\s*)?loaded \w{3} \d{1,2}, \d{4}|Stale since \w{3} \d{1,2}, \d{4}\s*(·\s*)?\d+ days?|Failed(\s*on \w{3} \d{1,2}, \d{4})?|Not published\s*(·\s*)?no load yet)$/; // the badge word and the dated words are sibling elements: the middot is dropped in the chip
    for (const row of await page.locator("tbody tr").all()) {
      await expect(row.locator("[data-slot=status]")).toHaveText(STATUS);
      await expect(row.locator("[data-slot=status] [data-slot=hint-trigger]")).toHaveCount(1);
    }
    await expect(page.locator("[data-slot=freshness-summary]")).toHaveText(/^\d+ public sources: .*\.\s*\W*Failed$/);
    await expect(page.locator("[data-slot=source-footer]")).toHaveText(/^Public sources · as of \w{3} \d{1,2}, \d{4}\. A source is stale once its last good load is older than its usual cycle\.$/);
    // DS-16a AC1 + AC2: the cadence hint and the vintage card read the same on hover and on keyboard focus.
    const cadence = stale.locator("[data-slot=cadence] [data-slot=hint-trigger]");
    await cadence.hover();
    const cadenceHover = await page.locator("[data-slot=tooltip-content]").first().textContent();
    expect(cadenceHover).toBe("Monthly: a new load is expected every 31 days. The source counts as stale once its last good load is older than that.");
    await page.mouse.move(0, 0);
    await cadence.focus();
    await expect(page.locator("[data-slot=tooltip-content]").first()).toHaveText(cadenceHover ?? "");
    await page.keyboard.press("Escape");
    const vintage = failed.locator("[data-slot=vintage] [data-slot=explain-trigger]");
    await expect(vintage).toHaveText(/^(Latest .+|No load yet)$/);
    await vintage.hover();
    const face = page.locator("[data-slot=hover-card-content] [data-slot=explain-content]");
    const vintageHover = await face.textContent();
    expect(vintageHover).toMatch(/^Latest vintage(The newest release|Nothing from this source).*Source\s*Example failed source/s);
    await page.mouse.move(0, 0);
    await vintage.focus();
    await expect(face).toHaveText(vintageHover ?? "");
    await page.keyboard.press("Escape");
    for (const width of [375, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/data-freshness");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-slot=freshness-summary]"), `summary visible @ ${width}`).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
      if (width < 1024) for (const t of await page.locator("tbody [data-slot=hint-trigger], tbody [data-slot=explain-trigger]").all()) expect((await t.boundingBox())?.height ?? 0, `44 px @ ${width}`).toBeGreaterThanOrEqual(44);
      const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(violations, `axe @ ${width}`).toEqual([]);
      if (!admin) await page.screenshot({ path: `${ART}/data-freshness-${width}.png`, fullPage: true });
    }
  });
}

test("board gets a real 403 with the DS-04 card and no Data freshness nav item (DS-05a)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/data-freshness"))?.status()).toBe(403);
  await expect(page.locator("[data-slot=status-card]")).toContainText(/Error 403 · No permission.*You don't have access to this page.*Board member/s);
  await expect(page.locator("[data-slot=status-card] code")).toHaveText("/data-freshness");
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Data freshness" })).toHaveCount(0);
});

for (const [email, home, navigates] of [["staff@example.test", "/staff", true], ["admin@example.test", "/admin", true], ["board@example.test", "/board", false]] as const) {
  test(`top-bar aggregate chip for ${email}: worst seeded status, ${navigates ? "links to" : "never links to"} /data-freshness (DS-05b, F-209)`, async ({ page }) => {
    await signIn(page, email);
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(home);
      const chip = page.locator("[data-slot=topbar-sub] [data-slot=freshness-chip]");
      // The chip renders client-side after a browser Supabase query; allow a slow dev server, and show the bar when it never appears.
      await chip.waitFor({ state: "attached", timeout: 20_000 }).catch(async () => console.log(`topbar-sub @ ${width}:`, await page.locator("[data-slot=topbar-sub]").innerHTML()));
      await expect(chip, `chip @ ${width}`).toBeVisible();
      await expect(chip).toHaveAttribute("data-status", "failed");
      await expect(chip).toHaveText(/^\W*Last run failed$/);
      await expect(chip.locator("[aria-hidden]")).toHaveText("✕");
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
      if (width === 375) expect((await chip.boundingBox())?.height ?? 0, "44px target below 1024").toBeGreaterThanOrEqual(44);
    }
    const chip = page.locator("[data-slot=topbar-sub] [data-slot=freshness-chip]");
    if (navigates) {
      await expect(chip).toHaveAttribute("href", "/data-freshness");
      await chip.click();
      await page.waitForURL("**/data-freshness");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Data freshness");
      await expect(page.locator("[data-slot=freshness-summary]")).toContainText("Failed");
    } else {
      await expect(chip).not.toHaveAttribute("href", /.*/);
      expect(await chip.evaluate((el) => el.tagName)).toBe("SPAN");
      await chip.click();
      expect(new URL(page.url()).pathname).toBe(home);
    }
  });
}
