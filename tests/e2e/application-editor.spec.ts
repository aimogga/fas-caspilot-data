import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// F-508h. The draft is what a mocked adapter would have written: stored synthetic rows inserted with the service role, so no AI call is made.
try { process.loadEnvFile(".env.local"); } catch { /* CI writes .env.local; locally the shell may export the same vars */ }
const OPP = "10101010-1010-1010-1010-101010101010", ORG = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", ADMIN = "11111111-1111-1111-1111-111111111111";
const IND = `public_indicator:${"4".repeat(8)}-4444-4444-4444-${"4".repeat(12)}`;
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const section = (key: string, heading: string, body: string, limit: object) => ({ key, heading, criterion: heading, body, citation_ids: [IND], assumptions: ["A partner clinic hosts sessions."], points: 10, limit, status: "ok", reasons: [] });

async function seedDraft(): Promise<string> {
  const snapshot = { opportunity_id: OPP, built_at: "2026-10-15T00:00:00Z", abstracts: [], facts: [{ citation_id: IND, label: "Uninsured rate, county FIPS 49035, 2023", values: { value: 12.4 }, source: { source_id: "census-sahie", vintage: "2023" } }] };
  const s = await db().from("strategy_draft").insert({ org_id: ORG, opportunity_id: OPP, snapshot, output: {}, citation_report: {}, status: "approved", created_by: ADMIN }).select("id").single();
  const sections = [section("s1", "Need for the project", "In our county 12.4% of people have no health insurance.", { kind: "words", value: 50, max_words: 50, max_chars: null }), section("s2", "Approach", "We pay licensed therapists directly.", { kind: "none_stated" })];
  return (await db().from("application_draft").insert({ org_id: ORG, opportunity_id: OPP, strategy_draft_id: s.data!.id, sections, created_by: ADMIN }).select("id").single()).data!.id as string;
}
async function signIn(page: Page, email: string) {
  await page.goto("/login"); await page.fill("#email", email); await page.fill("#password", "testpass123");
  await Promise.all([page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 }), page.click("button[type=submit]")]);
}
async function edit(page: Page, key: string, body: string) {
  const li = page.locator(`li[data-section=${key}]`);
  await li.getByText("Edit this section").click(); await li.locator("textarea").fill(body); await li.getByRole("button", { name: "Save section" }).click();
  await expect(li.locator("[data-slot=section-body]")).toHaveText(body);
}

test("board gets 403 on an application draft", async ({ page }) => {
  await signIn(page, "board@example.test");
  expect((await page.goto(`/staff/grants/applications/${await seedDraft()}`))?.status()).toBe(403);
});

test("staff edits with history and an uncited-number warning, cannot approve, and sees no send action", async ({ page }) => {
  test.setTimeout(60000); const id = await seedDraft(); await signIn(page, "staff@example.test");
  expect((await page.goto(`/staff/grants/applications/${id}`))?.status()).toBe(200);
  await expect(page.locator("[data-slot=draft-banner]")).toHaveText("DRAFT, prepared with AI assistance; review before submission");
  await expect(page.locator("li[data-section] h3")).toHaveText(["Need for the project10 points", "Approach10 points"]);
  await expect(page.locator("[data-slot=word-count]")).toHaveText(["10 of 50 words", "5 words · No limit stated"]);
  await expect(page.locator("li[data-section=s1] [data-slot=assumptions]")).toContainText("A partner clinic hosts sessions.");
  await page.locator("[data-slot=citations] [data-slot=explain-trigger]").first().focus(); // D-040: the chip opens the explain card on focus
  await expect(page.locator("[data-slot=hover-card-content] [data-slot=explain-content]")).toContainText("census-sahie 2023"); await page.keyboard.press("Escape");
  await edit(page, "s2", "We pay licensed therapists directly for 900 families.");
  await expect(page.locator("li[data-section=s2] [data-slot=uncited]")).toContainText("This number has no source. Add a source or remove it before approval.");
  await expect(page.locator("li[data-section=s2] [data-slot=needs-edit]")).toContainText("900 has no matching cited value");
  expect((await db().from("application_draft_edit").select("before,after").eq("application_draft_id", id)).data).toEqual([{ before: "We pay licensed therapists directly.", after: "We pay licensed therapists directly for 900 families." }]);
  await expect(page.getByRole("button", { name: "Approve draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /submit|email|send/i })).toHaveCount(0);
  await expect(page.locator("[data-slot=portal-note]")).toContainText("FAS submits through the funder’s own portal");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("admin approval is blocked by the warning, then allowed; Word downloads only once approved", async ({ page }) => {
  test.setTimeout(60000); const id = await seedDraft(); await signIn(page, "admin@example.test");
  await page.goto(`/staff/grants/applications/${id}`);
  expect((await page.request.get(`/api/grants/applications/${id}/docx`)).status()).toBe(409);
  await expect(page.locator("[data-slot=download-off]")).toHaveText("Download Word");
  await edit(page, "s2", "We pay 900 therapists.");
  await expect(page.getByRole("button", { name: "Approve draft" })).toBeDisabled();
  await edit(page, "s2", "We pay licensed therapists.");
  await page.getByRole("button", { name: "Approve draft" }).click();
  await expect(page.locator("[data-slot=page-header] p").last()).toContainText("Approved, read-only");
  await expect(page.getByText("Edit this section")).toHaveCount(0);
  const res = await page.request.get(await page.getByRole("link", { name: "Download Word" }).getAttribute("href") ?? "");
  expect([res.status(), res.headers()["content-type"]]).toEqual([200, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Start a new version to edit" }).click(); // criterion 3: a change starts a new version
  await page.waitForURL((u) => /\/staff\/grants\/applications\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.endsWith(id));
  await expect(page.locator("[data-slot=page-header] p").last()).toContainText("Draft, open for edits");
  await expect(page.getByText("Edit this section").first()).toBeVisible();
  expect((await db().from("application_draft").select("status").eq("id", id).single()).data?.status).toBe("approved");
});
