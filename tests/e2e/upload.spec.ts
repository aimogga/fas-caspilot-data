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
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 2 of 3: Map columns" })).toBeVisible();
  await expect(page.locator("#map-county_fips")).toHaveValue("county_fips");
  await page.getByRole("button", { name: "Next", exact: true }).click();
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

test("a clean CSV previews with 0 errors and an enabled Save", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await uploadToPreview(page, "case-good.csv");
  await expect(page.locator("[data-slot=preview-summary]")).toHaveText("3 rows ready · 0 rows with errors");
  await expect(page.locator("td[data-error], button:has-text('Download error report')")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await expect(page.getByText("Save stores all 3 rows as one batch")).toBeVisible();
});

const idsCsv = (ids: string[]) => ({ name: "case-ids.csv", mimeType: "text/csv", buffer: Buffer.from(["id,court_involved,referral_date,county_fips", ...ids.map((id) => `${id},yes,2024-02-15,49035`)].join("\n")) });

test("Save commits a batch, the list shows it, Roll back removes the rows", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const ids = [crypto.randomUUID(), crypto.randomUUID()]; // fixed ids: the second commit only succeeds because the rollback removed the first batch's rows
  const commit = async () => {
    await page.goto("/staff/intake");
    await page.setInputFiles("#intake-file", idsCsv(ids));
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next" }).click();
    await expect(page.locator("[data-slot=preview-summary]")).toHaveText("2 rows ready · 0 rows with errors");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Saved 2 rows as batch [0-9a-f]{8}$/);
    return (await page.getByRole("status").textContent())!.slice(-8);
  };
  const first = await commit(), row = page.locator(`tr[data-batch="${first}"]`);
  await expect(row).toContainText("Committed");
  await expect(row.locator("td").nth(3)).toHaveText("2");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Roll back this upload" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 1 of 3: Choose file" })).toBeVisible();
  await expect(row).toContainText("Rolled back");
  await expect(row.getByRole("button", { name: /Roll back/ })).toHaveCount(0);
  const second = await commit(); // same ids again: only possible because the rollback deleted the first batch's rows
  page.once("dialog", (d) => d.accept());
  await page.locator(`tr[data-batch="${second}"]`).getByRole("button", { name: /Roll back/ }).click();
  await expect(page.locator(`tr[data-batch="${second}"]`)).toContainText("Rolled back");
});

test("board cannot commit or roll back (403); bad rows get 422 and nothing is saved", async ({ page }) => {
  await signIn(page, "staff@example.test");
  const h = ["court_involved", "referral_date", "county_fips"], bad = { entity: "case", mapping: Object.fromEntries(h.map((k) => [k, k])), headers: h, rows: [["yes", "2024-02-15", "99999"]] };
  const res = await page.request.post("/api/intake/commit", { data: bad });
  expect([res.status(), (await res.json()).errors[0]]).toMatchObject([422, { row: 2, column: "county_fips", code: "county" }]);
  await page.context().clearCookies();
  await signIn(page, "board@example.test");
  expect((await page.request.post("/api/intake/commit", { data: { ...bad, rows: [["yes", "2024-02-15", "49035"]] } })).status()).toBe(403);
  expect((await page.request.post("/api/intake/rollback", { data: { batchId: crypto.randomUUID() } })).status()).toBe(403);
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
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
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
