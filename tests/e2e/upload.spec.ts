import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const FIX = "tests/fixtures/intake";
const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze().then((r) => r.violations.map((v) => v.id));

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}

/** File → mapping → preview. The template headers match the keys, so step 2 is pre-filled. */
async function uploadToPreview(page: Page, file: string) {
  await page.goto("/staff/intake");
  await page.setInputFiles("#intake-file", `${FIX}/${file}`);
  await expect(page.getByText(/data rows found/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 2 of 3: Map columns" })).toBeVisible();
  await expect(page.locator("#map-county_fips")).toHaveValue("county_fips");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 3 of 3: Preview" })).toBeVisible();
}

test("staff can open /staff/intake; board gets 403", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/staff/intake"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Upload data" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download template" })).toHaveAttribute("href", "/api/intake/template?entity=case");
  await page.context().clearCookies();
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/intake"))?.status()).toBe(403);
});

test("a clean CSV previews with 0 errors and a disabled Save", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await uploadToPreview(page, "case-good.csv");
  await expect(page.locator("[data-slot=preview-summary]")).toHaveText("3 rows ready · 0 rows with errors");
  await expect(page.locator("td[data-error], button:has-text('Download error report')")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByText("Saving arrives in the next release")).toBeVisible();
});

test("a CSV with bad county, date order and enum shows errors and offers the report", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await uploadToPreview(page, "case-bad.csv");
  await expect(page.locator("[data-slot=preview-summary]")).toHaveText(/^0 rows ready · 4 rows with errors$/);
  const first = page.locator("td[data-error]").first();
  await expect(first).toContainText("Error");
  await expect(first).toHaveAttribute("title", /^✕ County code 99999 is not a Utah county$/);
  await expect(page.locator("td[data-error][title*='is before']")).toHaveCount(1);
  await expect(page.locator("td[data-error][title*='not allowed']")).toHaveCount(1);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download error report" }).click()]);
  expect(dl.suggestedFilename()).toBe("fas-case-errors.csv");
  await page.getByRole("button", { name: "Back" }).click();
  await page.selectOption("#map-county_fips", "");
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("County code (Utah FIPS)");
});

test("375 and 1024: no horizontal scroll, 44px targets, axe clean on each step", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await uploadToPreview(page, "case-bad.csv");
    for (const step of [3, 2, 1]) {
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^Step ${step} of 3`) })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `step ${step} @ ${width}`).toBe(width);
      expect(await axe(page), `step ${step} @ ${width}`).toEqual([]);
      const minTarget = await page.evaluate(() => {
        const els = [...document.querySelectorAll("main a, main button, main select, main input")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0);
        return Math.min(...els.map((r) => Math.min(r.width, r.height)));
      });
      if (width < 1024) expect(minTarget, `step ${step} targets @ ${width}`).toBeGreaterThanOrEqual(44);
      if (step > 1) await page.getByRole("button", { name: "Back" }).click();
    }
  }
});
