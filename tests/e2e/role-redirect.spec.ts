import { expect, test, type Page } from "@playwright/test";

const ROLES = [
  ["admin@example.test", "/admin"],
  ["staff@example.test", "/staff"],
  ["board@example.test", "/board"],
] as const;

async function signIn(page: Page, email: string, path = "/login") {
  await page.goto(path);
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.getByRole("button", { name: "Sign in" }).click()]);
}

for (const width of [375, 1440] as const) {
  test(`each role lands on its home after sign-in and on / at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [email, home] of ROLES) {
      await signIn(page, email);
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${home}$`));
      await page.context().clearCookies();
    }
  });
}

test("board on /staff and /admin gets a real 403 with the requested path", async ({ page }) => {
  await signIn(page, "board@example.test");
  for (const path of ["/staff", "/admin"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(403);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator("[data-slot=status-eyebrow]")).toContainText("403");
  }
});

test("staff on /admin gets a real 403", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(403);
});

test("an expired session returns to login with the redirect and an info alert", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "sb-127-auth-token", value: "expired", url: baseURL! }]);
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fstaff&reason=expired$/);
  const alert = page.locator("[data-slot=alert][data-reason=expired]");
  await expect(alert).toHaveAttribute("role", "status");
  await expect(alert).toContainText("Your session has ended.");
  await page.context().clearCookies();
  await signIn(page, "staff@example.test", "/login?redirect=%2Fboard&reason=expired");
  await expect(page).toHaveURL(/\/board$/);
});

test("a fresh visit without a session shows no expired alert", async ({ page }) => {
  await page.goto("/staff");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fstaff$/);
  await expect(page.locator("[data-slot=alert][data-reason=expired]")).toHaveCount(0);
});

for (const width of [375, 1440] as const) {
  test(`a signed-in user on /login goes to their home or a safe redirect at ${width} (#60)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "staff@example.test");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.locator("#email")).toHaveCount(0);
    await page.goto("/login?redirect=%2Fboard");
    await expect(page).toHaveURL(/\/board$/);
    await page.goto("/login?redirect=https%3A%2F%2Fevil.example%2F");
    await expect(page).toHaveURL(/\/staff$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });

  test(`a signed-in user with no role on /login sees Account not set up at ${width} (#60)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, "norole@example.test");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/403$/);
    await expect(page.locator("[data-slot=status-eyebrow]")).toHaveText("Error 403 · Account not set up");
    await expect(page.locator("#email")).toHaveCount(0);
  });
}

test("a user with no role on /staff gets a real 403 Account not set up with a neutral breadcrumb", async ({ page }) => {
  await signIn(page, "norole@example.test");
  for (const path of ["/staff", "/board"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(403);
    await expect(page.locator("[data-slot=status-eyebrow]")).toHaveText("Error 403 · Account not set up");
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Account not set up");
  }
});
