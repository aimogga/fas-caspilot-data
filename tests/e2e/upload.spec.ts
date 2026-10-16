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

/** The wizard only handles the file input once React has hydrated, so wait for its marker before touching the form. */
async function openIntake(page: Page) {
  await page.goto("/staff/intake");
  await page.locator("[data-slot=wizard-steps][data-hydrated]").waitFor();
}

/** File → mapping → preview. The template headers match the keys, so step 2 is pre-filled. */
async function uploadToPreview(page: Page, file: string) {
  await openIntake(page);
  await page.setInputFiles("#intake-file", `${FIX}/${file}`);
  await expect(page.getByText(/data rows found/)).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 2 of 3: Match columns" })).toBeVisible();
  await expect(page.locator("#map-county_fips")).toHaveValue("county_fips");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 3 of 3: Preview" })).toBeVisible();
}

test("staff can open /staff/intake; board gets 403", async ({ page }) => {
  await signIn(page, "staff@example.test");
  expect((await page.goto("/staff/intake"))?.status()).toBe(200);
  // DS-18a AC4: eyebrow, a serif headline in words, the dropzone card with its helper sentence.
  await expect(page.locator("[data-slot=page-header] p").first()).toHaveText("WORKSPACE");
  await expect(page.getByRole("heading", { level: 1, name: "Add FAS records from a spreadsheet" })).toBeVisible();
  await expect(page.locator("[data-slot=dropzone]")).toContainText(/Drop a CSV here or choose one from your computer/);
  await expect(page.locator("#intake-file")).toHaveAttribute("aria-describedby", "intake-file-help");
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
    await openIntake(page);
    await page.setInputFiles("#intake-file", idsCsv(ids));
    for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("[data-slot=preview-summary]")).toHaveText("2 rows ready · 0 rows with errors");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status")).toHaveText(/^Saved 2 rows as batch [0-9a-f]{8}$/);
    return (await page.getByRole("status").textContent())!.slice(-8);
  };
  const first = await commit(), row = page.locator(`tr[data-batch="${first}"]`);
  // DS-18a AC3: status in words with one hint (hover text = focus text), type in words, the row at least 44 px tall at 375.
  await expect(row.locator("td").nth(1)).toHaveText("Case records");
  await expect(row.locator("td").nth(3)).toHaveText("2");
  const status = row.locator("[data-slot=batch-status] [data-slot=hint-trigger]");
  await expect(status).toHaveText(/Saved$/);
  const tip = page.locator("[data-slot=tooltip-content]").first();
  await expect(async () => { await status.hover(); await expect(tip).toHaveText("These rows are in the database and count in every view. Roll back removes them."); }).toPass();
  await page.mouse.move(0, 0);
  await status.focus();
  await expect(tip).toHaveText("These rows are in the database and count in every view. Roll back removes them.");
  await status.blur();
  await page.setViewportSize({ width: 375, height: 900 });
  expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await page.setViewportSize({ width: 1280, height: 900 });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Roll back this upload" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Step 1 of 3: Choose file" })).toBeVisible();
  await expect(row.locator("[data-slot=batch-status]")).toHaveText(/Rolled back$/);
  await expect(row.getByRole("button", { name: /Roll back/ })).toHaveCount(0);
  const second = await commit(); // same ids again: only possible because the rollback deleted the first batch's rows
  page.once("dialog", (d) => d.accept());
  await page.locator(`tr[data-batch="${second}"]`).getByRole("button", { name: /Roll back/ }).click();
  await expect(page.locator(`tr[data-batch="${second}"] [data-slot=batch-status]`)).toHaveText(/Rolled back$/);
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
  // DS-18a AC1: every error cell keeps data-error and explains itself through a Hint (hover = focus), never a native title.
  await expect(page.locator("td[title]")).toHaveCount(0);
  const triggers = page.locator("td[data-error] [data-slot=hint-trigger]"), tip = page.locator("[data-slot=tooltip-content]").first();
  const n = await triggers.count();
  expect(n).toBeGreaterThanOrEqual(3);
  await expect(triggers.first()).toHaveText("Error");
  await expect(triggers.first()).toHaveAttribute("aria-label", "Error: County code 99999 is not a Utah county");
  const reasons: string[] = [];
  for (let i = 0; i < n; i++) {
    // Each read is self-identifying: the cell's own aria-label names the reason, so a tooltip left open by the previous cell cannot satisfy it.
    const cell = triggers.nth(i), reason = ((await cell.getAttribute("aria-label")) ?? "").replace(/^Error: /, "");
    expect(reason).toMatch(/\S/);
    await expect(async () => { await cell.hover(); expect(await tip.textContent()).toBe(reason); }).toPass();
    reasons.push(reason);
  }
  await page.mouse.move(0, 0);
  expect(reasons[0]).toBe("County code 99999 is not a Utah county");
  expect(reasons.filter((r) => r.includes("is before"))).toHaveLength(1);
  expect(reasons.filter((r) => r.includes("not allowed"))).toHaveLength(1);
  await triggers.first().focus();
  await expect(tip).toHaveText(reasons[0]);
  await triggers.first().blur();
  // DS-18a AC2: at step 3 the two earlier steps are ticked and the current one is marked.
  await expect(page.locator("[data-slot=wizard-steps] li[data-state=done]")).toHaveCount(2);
  await expect(page.locator("[data-slot=wizard-steps] li[aria-current=step]")).toHaveText(/Preview$/);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download error report" }).click()]);
  expect(dl.suggestedFilename()).toBe("fas-case-errors.csv");
  await page.getByRole("button", { name: "Back", exact: true }).click(); // "Roll back batch …" also matches a loose "Back"
  await page.selectOption("#map-county_fips", "");
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(page.getByRole("alert").filter({ hasText: /^Choose a column/ })).toContainText("County code (Utah FIPS)"); // Next.js adds its own route-announcer alert
});

test("375, 1024 and 1440: no horizontal scroll, 44px targets, axe clean on each step", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024, 1440] as const) {
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
      if (step > 1) await page.getByRole("button", { name: "Back", exact: true }).click();
    }
  }
});
