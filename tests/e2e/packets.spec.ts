import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const ART = "/opt/cursor/artifacts/f-403";
const ORDER = ["County need profile", "FAS results", "Outcomes", "Methodology and sources", "Suppression note", "Related-party disclosure"];
/** Any day-level date: ISO, slashed, `Jul 1, 2026` or `1 Jul 2026`. Month/quarter strings pass. */
const EXACT_DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}, \d{4}\b|\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/;
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const axe = (page: Page) => new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === "serious" || v.impact === "critical"));

test("board viewer gets 403 on /staff/packets and no Evidence packets nav item (F-403)", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto("/staff/packets?variant=board"))?.status()).toBe(403);
  await page.goto("/board");
  await expect(page.locator("[data-slot=sidebar] nav a", { hasText: "Evidence packets" })).toHaveCount(0);
});

for (const [variant, query, scope] of [["grant", "variant=grant&county=49035", "Salt Lake County"], ["board", "variant=board&county=49035", "Statewide"]] as const) {
  test(`${variant} packet renders six sections in order with no exact dates, prints without controls, and saves a Letter PDF (F-403)`, async ({ page }) => {
    await signIn(page, variant === "grant" ? "staff@example.test" : "admin@example.test");
    await page.setViewportSize({ width: 1024, height: 900 });
    expect((await page.goto(`/staff/packets?${query}`))?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=crumbs]")).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=sidebar] nav a[aria-current=page]")).toHaveText("Evidence packets");
    await expect(page.locator("[data-slot=packet-title]")).toHaveText(`FAS Evidence packet · ${variant === "grant" ? "Grant attachment" : "Board packet"} · ${scope}`);
    await expect(page.locator("[data-slot=packet-ribbon]")).toHaveText("DRAFT · for review");
    await expect(page.locator("[data-slot=packet-cover]")).toContainText(/Prepared \w{3} \d{4} · Data as of (\w{3} \d{4}|Not available yet)/);
    await expect(page.locator("[data-slot=packet-section] h2")).toHaveText(ORDER);
    const text = await page.locator("[data-slot=packet]").innerText();
    expect(text).not.toMatch(EXACT_DATE);
    expect(text).not.toMatch(/\$0\b|NaN|undefined|null|case_id/);
    expect(text).toMatch(/fewer than 11|hidden/i);
    await expect(page.locator("[data-slot=packet-footer]")).toHaveText(/^FAS Evidence · Counts under 11 are hidden · \w{3} \d{4}$/);
    expect(await axe(page)).toEqual([]);
    expect(await page.setViewportSize({ width: 375, height: 800 }).then(() => page.evaluate(() => document.documentElement.scrollWidth))).toBe(375);
    await page.setViewportSize({ width: 816, height: 1056 });
    const print = page.getByRole("button", { name: "Print / Save as PDF" });
    await expect(print).toBeVisible().then(() => page.emulateMedia({ media: "print" }));
    await expect(print).toBeHidden();
    await expect(page.locator("[data-slot=packet-controls]")).toBeHidden();
    await expect(page.locator("[data-slot=sidebar]")).toBeHidden();
    expect(await page.locator("[data-slot=packet-section]").first().evaluate((el) => getComputedStyle(el).breakBefore)).toBe("page");
    await page.screenshot({ path: `${ART}/packet-${variant}-page1.png`, clip: { x: 0, y: 0, width: 816, height: 1056 } });
    await page.pdf({ path: `${ART}/packet-${variant}.pdf`, format: "Letter", printBackground: true });
  });
}

/** F-404: DOCX + CSV appendix downloads through the signed-in context. The files land in the artifacts folder for the manual Word / Google Docs check. */
test("staff downloads the DOCX and CSV appendix with month-only filenames; board gets 403; bad format 400 (F-404)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.goto("/staff/packets?variant=board&county=49035");
  const links = page.locator("[data-slot=packet-download]");
  await expect(links).toHaveText(["Download Word (.docx)", "Download CSV appendix"]);
  await expect(links.first()).toHaveAttribute("href", "/api/packets/export?variant=board&county=49035&format=docx");
  await page.emulateMedia({ media: "print" });
  await expect(links.first()).toBeHidden();
  const docx = await page.request.get("/api/packets/export?variant=board&format=docx");
  expect([docx.status(), docx.headers()["content-type"]]).toEqual([200, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  expect(docx.headers()["content-disposition"]).toMatch(/^attachment; filename="fas-evidence-packet-board-statewide-\d{4}-\d{2}\.docx"$/);
  const docxBody = await docx.body();
  await mkdir(ART, { recursive: true });
  expect(docxBody.subarray(0, 2).toString()).toBe("PK");
  await writeFile(`${ART}/packet-board-statewide.docx`, docxBody);
  const csv = await page.request.get("/api/packets/export?variant=grant&county=49035&format=csv");
  expect([csv.status(), csv.headers()["content-type"]]).toEqual([200, "text/csv; charset=utf-8"]);
  expect(csv.headers()["content-disposition"]).toMatch(/^attachment; filename="fas-evidence-packet-grant-salt-lake-county-\d{4}-\d{2}\.csv"$/);
  const text = await csv.text();
  expect(text.startsWith("﻿section,label,value,unit,source,as_of,status\r\n")).toBe(true);
  expect(text).toMatch(/,fewer_than_11\r\n/);
  expect(text).not.toMatch(EXACT_DATE);
  await writeFile(`${ART}/packet-grant-salt-lake-county.csv`, text);
  expect((await page.request.get("/api/packets/export?variant=grant&format=xlsx")).status()).toBe(400);
  await page.context().clearCookies();
  await signIn(page, "board@example.test");
  expect((await page.request.get("/api/packets/export?variant=board&format=docx")).status()).toBe(403);
});
