import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [375, 1024, 1440] as const;
const SHOTS = "/opt/cursor/artifacts/ds-04b";
const LEAKS = /at \w+ \(|\.tsx?:\d+|NEXT_PUBLIC_|SUPABASE_|Synthetic DS-04/;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

async function checkLayout(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 812 });
    await page.reload();
    const card = page.locator("[data-slot=status-card]");
    await expect(card).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
    expect(axe.violations, `${name} axe @ ${width}`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name} scroll @ ${width}`).toBeLessThanOrEqual(width);
    for (const box of await card.locator("a, button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))) {
      expect(box, `${name} target @ ${width}`).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
  }
}

test("404 renders the not-found card with status 404", async ({ page }) => {
  const res = await page.goto("/dev-error?kind=notfound");
  expect(res?.status()).toBe(404);
  const card = page.locator("[data-slot=status-card]");
  await expect(card.locator("h1")).toHaveText("We can't find that page");
  await expect(card.locator("[data-slot=status-eyebrow]")).toHaveText("Error 404 · Not found");
  await expect(page.locator("[data-slot=signed-out-bar]")).toBeVisible();
  await checkLayout(page, "404");
});

test("error page renders with status 500 and leaks nothing", async ({ page }) => {
  const res = await page.goto("/dev-error");
  expect(res?.status()).toBe(500);
  const card = page.locator("[data-slot=status-card]");
  await expect(card.locator("h1")).toHaveText("This page didn't load");
  await expect(card.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(await card.innerText()).not.toMatch(LEAKS);
  await checkLayout(page, "error");
});

test("403 for board on /staff shows plain-text guidance in the shell", async ({ page }) => {
  await signIn(page, "board@example.test");
  const res = await page.goto("/staff");
  expect(res?.status()).toBe(403);
  const card = page.locator("[data-slot=status-card]");
  await expect(card.locator("h1")).toHaveText("You don't have access to staff tools");
  await expect(card.locator("[data-slot=status-guidance]")).toHaveText("Ask your FAS admin to change your role.");
  await expect(card.locator("[data-slot=status-guidance] a, [data-slot=status-guidance] button")).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Go to Board dashboard" })).toHaveAttribute("href", "/board");
  await expect(card.locator("[data-slot=status-footnote] code")).toHaveText("/staff");
  await expect(page.locator("[data-slot=app-shell]")).toBeVisible();
  expect(await card.innerText()).not.toMatch(LEAKS);
  await checkLayout(page, "403");
});

test("403 for a user with no role shows Account not set up with a neutral breadcrumb", async ({ page }) => {
  await signIn(page, "norole@example.test");
  for (const path of ["/board", "/staff", "/admin"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(403);
    const card = page.locator("[data-slot=status-card]");
    await expect(card.locator("[data-slot=status-eyebrow]")).toHaveText("Error 403 · Account not set up");
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Account not set up");
  }
});

test("403 names the area for any letter case", async ({ page }) => {
  await signIn(page, "board@example.test");
  await page.goto("/403?from=%2FSTAFF");
  await expect(page.locator("[data-slot=status-card] h1")).toHaveText("You don't have access to staff tools");
  await page.goto("/403?from=%2FAdmin");
  await expect(page.locator("[data-slot=status-card] h1")).toHaveText("You don't have access to admin tools");
});
