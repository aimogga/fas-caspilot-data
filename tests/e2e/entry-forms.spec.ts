import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze().then((r) => r.violations.map((v) => v.id));

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

/** Controlled fields drop values set before React hydrates, so wait for the form's marker before filling anything. */
async function openEntry(page: Page) {
  await page.goto("/staff/entry");
  await page.locator("[data-slot=entry-form][data-hydrated]").waitFor();
}

/** Fills the three required Case fields and saves; returns the new row id from the status line. */
async function saveCase(page: Page): Promise<string> {
  await openEntry(page);
  await page.selectOption("#entry-court_involved", "yes");
  await page.fill("#entry-referral_date", "2024-03-01");
  await page.selectOption("#entry-county_fips", "49035");
  await page.getByRole("button", { name: "Save" }).click();
  const status = page.locator("[data-slot=entry-saved]");
  // When the save never confirms, print the form (alerts, field errors, problem line) so the failing run says why.
  await status.waitFor({ timeout: 10_000 }).catch(async () => console.log("entry form after Save:", await page.locator("[data-slot=entry-form]").innerText()));
  await expect(status).toContainText("Saved Case");
  return (await status.getAttribute("data-id")) ?? "";
}

test("staff can open /staff/entry; board gets 403", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/staff/entry"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Enter data" })).toBeVisible();
  await page.context().clearCookies();
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/entry"))?.status()).toBe(403);
});

test("an empty Case shows required errors next to each field, an alert count, and saves nothing", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await openEntry(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-slot=entry-alert]")).toHaveText(/^3 fields need attention/);
  await expect(page.locator("#entry-county_fips-error")).toHaveText("✕ County code (Utah FIPS) is required");
  await expect(page.locator("#entry-referral_date[aria-invalid=true][aria-describedby~=entry-referral_date-error]")).toBeVisible();
  await expect(page.locator("#entry-court_involved")).toBeFocused();
  await expect(page.locator("[data-slot=entry-saved]")).toHaveCount(0);
});

test("a valid Case saves; its id becomes the parent of a valid Application; date order is checked inline", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const caseId = await saveCase(page);
  await page.getByRole("button", { name: "Add another" }).click();
  await page.selectOption("#entry-entity", "application");
  await page.fill("#entry-case_id", caseId);
  await page.fill("#entry-application_date", "2024-05-01");
  await page.fill("#entry-decision_date", "2024-04-01");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#entry-decision_date-error")).toHaveText("✕ Decision date (2024-04-01) is before Application date (2024-05-01)");
  await page.fill("#entry-decision_date", "2024-05-15");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-slot=entry-saved]")).toContainText("Saved Application");
});

test("375 and 1024: no horizontal scroll, 44px targets, 16px inputs, axe clean", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await openEntry(page);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator("[data-slot=entry-alert]")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `@ ${width}`).toBe(width);
    expect(await axe(page), `@ ${width}`).toEqual([]);
    const { minTarget, fontPx } = await page.evaluate(() => {
      const els = [...document.querySelectorAll("main a, main button, main select, main input")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
      return { minTarget: Math.min(...els.map((r) => Math.min(r.width, r.height))), fontPx: getComputedStyle(document.querySelector("#entry-referral_date")!).fontSize };
    });
    expect(fontPx).toBe("16px");
    if (width < 1024) expect(minTarget, `targets @ ${width}`).toBeGreaterThanOrEqual(44);
  }
});
