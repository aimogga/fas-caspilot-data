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
    await expect(page.locator("[data-slot=packet-cover]")).toContainText(/Prepared \w{3} \d{4} · Data (as of \w{3} \d{4}|date not available yet)/);
    // DS-17: the title moved to the eyebrow; the h2 is the section's first sentence in words.
    await expect(page.locator("[data-slot=packet-section] [data-slot=section-eyebrow]")).toHaveText(ORDER.map((t, i) => `Section ${i + 1} of 6 · ${t}`));
    // The board's pictures sit inside FAS results and Outcomes (statewide board packet always has at least the wait picture in the seed).
    const pictures = page.locator("[data-slot=packet-pictures] [data-picture]");
    if (variant === "board") await expect(pictures.first()).toBeVisible();
    for (const c of await pictures.all()) await expect(c.getByRole("img")).toHaveAttribute("aria-label", /.+/);
    expect(await pictures.evaluateAll((els) => els.every((el) => ["fas-results", "outcomes"].includes(el.closest("[data-slot=packet-section]")?.id ?? "")))).toBe(true);
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
test("staff downloads the DOCX and CSV appendix with month-only filenames; board downloads the board packet only; bad format 400 (F-404)", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.goto("/staff/packets?variant=board&county=49035");
  const links = page.locator("[data-slot=packet-download]");
  await expect(links).toHaveText(["Download Word (.docx)", "Download CSV appendix"]);
  // The board packet is statewide, so its links carry no county even when the URL names one.
  await expect(links.first()).toHaveAttribute("href", "/api/packets/export?variant=board&county=&format=docx");
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
  // Board viewers download the statewide board packet from their dashboard; the county grant attachment stays staff-only.
  await page.goto("/board");
  const boardLinks = page.locator("[data-slot=packet-download]");
  await expect(boardLinks).toHaveText(["Download Word (.docx)", "Download CSV appendix"]);
  const boardDocx = await page.request.get("/api/packets/export?variant=board&format=docx");
  expect([boardDocx.status(), (await boardDocx.body()).subarray(0, 2).toString()]).toEqual([200, "PK"]);
  expect((await page.request.get("/api/packets/export?variant=grant&county=49035&format=csv")).status()).toBe(403);
});

// DS-17 (D-040): every figure tile explains itself; the controls and downloads say what they do; sections lead with words; print carries the footer on every sheet.
const PRIVACY = "Fewer than 11 families, so the number is hidden to protect privacy.";
// The first pointer action can land before hydration on CI, so the first hover re-tries until its face appears.
const hoverUntil = (target: ReturnType<Page["locator"]>, face: ReturnType<Page["locator"]>) =>
  expect(async () => { await target.hover(); await expect(face).toBeVisible({ timeout: 1500 }); }).toPass({ timeout: 30_000 });
// `app/(app)/staff/loading.tsx` (#262) streams the page behind a skeleton, so `goto` can resolve while the packet still sits in the hidden streaming container; wait for it.
const open = async (page: Page, url: string) => {
  expect((await page.goto(url))?.status()).toBe(200);
  await expect(page.locator("[data-slot=packet]")).toBeVisible();
};

test("AC2: figure tiles share one explain layer; hover, focus and Enter show the same words; a hidden tile says why with no value; Escape returns focus", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page, "/staff/packets?variant=grant&county=49035");
  const packet =page.locator("[data-slot=packet]"), card = packet.locator("[data-slot=explain-layer-card]");
  await expect(packet.locator("[data-slot=explain-layer]")).toHaveCount(1);
  const tiles = packet.locator("[data-slot=packet-figure]");
  expect(await tiles.count()).toBeGreaterThan(0);
  for (const t of await tiles.all()) await expect(t).toHaveAttribute("data-term", /.+/);
  const shown = tiles.filter({ hasNot: page.locator("[data-slot=suppressed]") }).first(), hidden = tiles.filter({ has: page.locator("[data-slot=suppressed]") });
  await expect(card).toHaveCount(0);
  await hoverUntil(shown, card);
  await expect(card).toContainText(/Value\s*\S/);
  await expect(card).toContainText(/Source\s*\S/);
  const words = await card.innerText();
  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);
  await shown.focus();
  expect(await card.innerText()).toBe(words);
  await page.keyboard.press("Enter");
  await expect(card).toHaveAttribute("role", "dialog");
  expect(await page.getByRole("dialog").innerText()).toBe(words);
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
  await expect(shown).toBeFocused();
  await shown.blur();
  if (await hidden.count()) {
    await hidden.first().hover();
    await expect(card).toContainText(/Why it's hidden\s*(Fewer than 11 families|Hidden so the smaller group|This number appears once)/);
    await expect(card).not.toContainText("Value");
    if ((await hidden.first().locator("[data-slot=suppressed]").innerText()).trim() === "fewer than 11") await expect(card).toContainText(PRIVACY);
    await page.mouse.move(0, 0);
  }
  // The words also live outside the card: the tile carries the label, the source and the as-of month.
  await expect(shown.locator("dt")).toHaveText(/\S/);
  await expect(shown.locator("dd").last()).toHaveText(/ · (as of \w{3} \d{4}|date not available yet)$/);
  expect(await axe(page)).toEqual([]);
});

test("AC3: Variant, County and both downloads carry hints that read the same on hover and on focus; 44 px triggers at 375", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/staff/packets?variant=grant&county=49035");
  const controls =page.locator("[data-slot=packet-controls]"), tip = page.locator("[data-slot=tooltip-content]").first();
  await expect(controls.locator("[data-slot=hint-trigger]")).toHaveCount(4);
  const same = async (name: string, pattern: RegExp) => {
    const trigger = controls.getByRole("button", { name: `About ${name}`, exact: true });
    await hoverUntil(trigger, tip);
    await expect(tip).toHaveText(pattern);
    const hovered = await tip.textContent();
    await trigger.focus();
    await expect(tip).toHaveText(hovered ?? "");
    await trigger.blur();
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-slot=tooltip-content]", { hasText: hovered ?? "" })).toHaveCount(0);
  };
  await same("Variant", /^Grant attachment is for a funder/);
  await same("County", /^Limits the grant attachment to one Utah county/);
  await same("Download Word (.docx)", /^A Word file of this packet.*month or quarter only/);
  await same("Download CSV appendix", /^A spreadsheet of the figures only.*month or quarter only\.$/);
  await expect(page.locator("#variant")).toHaveAccessibleName("Variant");
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, "/staff/packets?variant=grant&county=49035");
  const triggers = controls.locator("[data-slot=hint-trigger]");
  await expect(triggers).toHaveCount(4);
  for (const t of await triggers.all()) {
    await expect(t).toBeVisible();
    const b = (await t.boundingBox())!;
    expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
  }
});

test("AC4: each section shows an eyebrow with its number and title and a serif headline in words", async ({ page }) => {
  await signIn(page, "admin@example.test");
  await page.setViewportSize({ width: 1024, height: 900 });
  await open(page, "/staff/packets?variant=board");
  const sections =page.locator("[data-slot=packet-section]");
  await expect(sections).toHaveCount(6);
  for (const [i, s] of (await sections.all()).entries()) {
    await expect(s.locator("[data-slot=section-eyebrow]")).toHaveText(`Section ${i + 1} of 6 · ${ORDER[i]}`);
    const h2 = s.locator("h2");
    await expect(h2).toHaveText(/\S.*\.$/);
    await expect(h2).not.toHaveText(ORDER[i]!);
    expect(await h2.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/serif/i);
    await expect(s).toHaveAttribute("aria-labelledby", `${await s.getAttribute("id")}-lead`);
  }
  await expect(page.locator("[data-slot=packet]")).not.toContainText(/\bpct\b|\bFIPS\b/);
});

test("AC5 -print: hints, tooltips and the layer card never print; the footer is fixed at the foot of every sheet; sections start a page; tiles do not split", async ({ page }) => {
  await signIn(page, "staff@example.test");
  await page.setViewportSize({ width: 816, height: 1056 });
  await open(page, "/staff/packets?variant=grant&county=49035");
  const tile =page.locator("[data-slot=packet-figure]").first(), card = page.locator("[data-slot=explain-layer-card]");
  await hoverUntil(tile, card);
  await page.emulateMedia({ media: "print" });
  await expect(card).toBeHidden();
  await expect(page.locator("[data-slot=hint-trigger]").first()).toBeHidden();
  await expect(page.locator("[data-slot=packet-controls]")).toBeHidden();
  const footer = page.locator("[data-slot=packet-footer]");
  await expect(footer).toBeVisible();
  expect(await footer.evaluate((el) => [getComputedStyle(el).position, getComputedStyle(el).textAlign])).toEqual(["fixed", "center"]);
  expect(await page.locator("[data-slot=packet-section]").first().evaluate((el) => getComputedStyle(el).breakBefore)).toBe("page");
  expect(await tile.evaluate((el) => [getComputedStyle(el).breakInside, getComputedStyle(el).color])).toEqual(["avoid", "rgb(0, 0, 0)"]);
  await mkdir(ART, { recursive: true });
  await page.screenshot({ path: `${ART}/packet-ds17-print.png`, clip: { x: 0, y: 0, width: 816, height: 1056 } });
});

test("AC6: axe 0 serious or critical at 375, 1024 and 1440 with no horizontal overflow", async ({ page }) => {
  await signIn(page, "staff@example.test");
  for (const width of [375, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/staff/packets?variant=grant&county=49035");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `scroll @ ${width}`).toBeLessThanOrEqual(width);
    expect(await axe(page), `axe @ ${width}`).toEqual([]);
  }
});

test("a grant packet prepared for one seeded grant names it in month words and keeps it across Update and the downloads (F-403b)", async ({ page }) => {
  const id = "10101010-1010-1010-1010-101010101011";
  await signIn(page, "staff@example.test");
  expect((await page.goto(`/staff/packets?variant=grant&opportunity=${id}`))?.status()).toBe(200);
  await expect(page.locator("[data-slot=packet-for]")).toHaveText("Prepared for Synthetic Family Fund · Synthetic Foundation · closes Mar 2027");
  // F-403c: the staff-only note reads the seeded listing ("d"), which asks for no evidence; it is not part of the packet
  await expect(page.locator("[data-slot=packet-asks]")).toContainText("The listing names no outcome, cost or wait-time evidence.");
  await expect(page.locator("[data-slot=packet] [data-slot=packet-asks]")).toHaveCount(0);
  await expect(page.locator("[data-slot=packet-download]").first()).toHaveAttribute("href", new RegExp(`opportunity=${id}`));
  await page.selectOption("#county", "49035");
  await Promise.all([page.waitForURL(/county=49035/), page.getByRole("button", { name: "Update" }).click()]);
  await expect(page.locator("[data-slot=packet-for]")).toContainText("Synthetic Family Fund");
  await page.goto("/staff/packets?variant=grant&opportunity=not-a-uuid");
  await expect(page.locator("[data-slot=packet-for]")).toHaveCount(0);
  await expect(page.locator("[data-slot=packet-asks]")).toHaveCount(0);
});
