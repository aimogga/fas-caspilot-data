import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// F-508j. The strategy is a stored synthetic row (service role); the application writer runs on the fake adapter (STRATEGY_FAKE_LLM=1), so no AI call is made.
try { process.loadEnvFile(".env.local"); } catch { /* CI writes .env.local; locally the shell may export the same vars */ }
const OPP = "10101010-1010-1010-1010-101010101012", ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ADMIN = "11111111-1111-1111-1111-111111111111";
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const output = { opportunity_id: OPP, status: "DRAFT", criteria_map: [{ criterion: "Need for the project", fas_position: "FAS pays for therapy for court-referred families.", evidence: [], gaps: [], confidence: "medium" }],
  suggested_ask: null, risks: ["Few Utah awards."], narrative_outline: ["Need"], inferences: [] };

async function seedStrategy(): Promise<string> {
  const snapshot = { opportunity_id: OPP, built_at: "2026-10-16T00:00:00Z", facts: [], abstracts: [] };
  return (await db().from("strategy_draft").insert({ org_id: ORG, opportunity_id: OPP, snapshot, output, citation_report: { ok: true, claims: [], copied: [] }, status: "DRAFT", created_by: ADMIN }).select("id").single()).data!.id as string;
}
async function signIn(page: Page, email: string) {
  await page.goto("/login"); await page.fill("#email", email); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
const APP_URL = /\/staff\/grants\/applications\/([0-9a-f-]{36})$/;

test("an approved strategy writes the application once, staff reopen it, and the Word download is audited", async ({ page, browser }) => {
  test.setTimeout(90000); const id = await seedStrategy();
  await signIn(page, "admin@example.test"); await page.goto(`/staff/grants/strategy/${id}`);
  await expect(page.getByRole("button", { name: /application/ })).toHaveCount(0); // not before approval
  await page.getByRole("button", { name: "Approve draft" }).click();
  await page.getByRole("button", { name: "Write the application" }).click();
  await page.waitForURL(APP_URL, { timeout: 60000 }); const appId = APP_URL.exec(page.url())![1]!;
  await expect(page.locator("li[data-section] h3").first()).toContainText("Need for the project");

  const staff = await (await browser.newContext()).newPage(); await signIn(staff, "staff@example.test");
  await staff.goto(`/staff/grants/strategy/${id}`);
  await expect(staff.locator("[data-slot=application-drafts] li")).toHaveText([/^Draft, open for edits · started /]);
  await staff.getByRole("button", { name: "Open the latest application" }).click();
  await staff.waitForURL(APP_URL); expect(APP_URL.exec(staff.url())![1]).toBe(appId); // no duplicate draft
  await expect(staff.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
  expect((await db().from("application_draft").select("id").eq("strategy_draft_id", id)).data).toHaveLength(1);
  for (const width of [375, 1024]) { await staff.setViewportSize({ width, height: 900 }); await staff.goto(`/staff/grants/strategy/${id}`);
    expect((await new AxeBuilder({ page: staff }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]); }
  // F-508k: the Applications tab lists the draft (month-only date) and opens it; no sideways scroll at 375.
  for (const width of [375, 1024]) { await staff.setViewportSize({ width, height: 900 }); await staff.goto("/staff/grants/applications");
    const row = staff.locator(`[data-slot=application-list] tr[data-application="${appId}"]`);
    await expect(row).toContainText("Draft, open for edits"); await expect(row).toContainText(/Not yet/); await expect(row).toContainText(/[A-Z][a-z]{2} \d{4}/);
    expect(await staff.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect((await new AxeBuilder({ page: staff }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]); }
  await staff.locator(`tr[data-application="${appId}"] a`).click(); await staff.waitForURL(APP_URL); expect(APP_URL.exec(staff.url())![1]).toBe(appId);

  expect((await page.request.get(`/api/grants/applications/${appId}/docx`)).status()).toBe(409); // not approved: no file, no audit row
  await page.goto(`/staff/grants/applications/${appId}`); await page.getByRole("button", { name: "Approve draft" }).click();
  await expect(page.getByRole("link", { name: "Download Word" })).toBeVisible();
  expect((await page.request.get(`/api/grants/applications/${appId}/docx`)).status()).toBe(200);
  const jobs = (await db().from("export_job").select("id,type,created_by").eq("type", "application-docx").eq("params->>application_id", appId)).data ?? [];
  expect(jobs).toEqual([expect.objectContaining({ type: "application-docx", created_by: ADMIN })]);
  expect((await db().from("audit_log").select("id").eq("action", "application.download").eq("entity_id", jobs[0]!.id)).data).toHaveLength(1);
});

test("board gets 403 on the strategy screen, the applications list and the application download", async ({ page }) => {
  const id = await seedStrategy(); await signIn(page, "board@example.test");
  expect((await page.goto(`/staff/grants/strategy/${id}`))?.status()).toBe(403);
  expect((await page.goto("/staff/grants/applications"))?.status()).toBe(403);
  expect((await page.request.get("/api/grants/applications/00000000-0000-4000-8000-000000000000/docx")).status()).toBe(403);
});
