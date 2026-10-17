# Runbook: loading FAS's real data into production (F-604)

**Status: not yet executed. Dry run scripted and passing (section 6, 2026-10-17). Real FAS data is gated on George (`human_gate: george-before-deploy`, Phase 6 legal gate in `docs/PRIVACY_AND_COMPLIANCE.md`).** Until every box in section 1 is ticked by George, the only data anywhere is synthetic or public, and production (`fas-caspilot-data.vercel.app`) keeps pointing at the synthetic `fas-dev` Supabase project (D-023).

This runbook is written so that a person with the Supabase, Vercel and n8n logins can perform the load without an engineer present, and so the dry run in section 6 proves the steps on synthetic data first. Each step says who does it and what evidence to keep.

## 0. Roles and the one rule

| Who | May do |
|---|---|
| George | Signs off every gate in section 1; performs or watches the real load (section 5); owns the first sign-in of real users. |
| Engineer Supervisor / team | Creates the production Supabase project, applies migrations, sets secrets, runs the dry run, and stays on call. Never touches a real FAS file. |
| Cloud agents (Cursor, Claude, Copilot) | Nothing in production. They never receive production credentials and never see a real file (`AGENTS.md` golden rule 2; `docs/ARCHITECTURE.md` Environments). |

The one rule: **a real FAS file is opened only on George's machine or inside the production app, never in a repo checkout, a preview, a ticket, a screenshot or a chat.**

## 1. Gates that must be closed first (George)

- [ ] **Legal opinion in hand** on the HIPAA basis for provider session data and whether Business Associate Agreements are needed with Supabase, Vercel and any LLM provider (`docs/PRIVACY_AND_COMPLIANCE.md`, "Legal gates before real data"). Keep the opinion and any signed BAAs in FAS's own records, not in the repo.
- [ ] **Plans that offer the needed BAAs are purchased** (Supabase and Vercel both require a paid tier for a BAA). Money decisions go through Chief of staff (D-014). The Supabase org (Casepilot) is on the Free plan as of 2026-10-17.
- [ ] **Security review (F-602) reported clean**: RLS tests per table × role, secret scan, dependency audit, Supabase advisors.
- [ ] **Production Supabase project created** (section 3), separate from `fas-dev` (`zlizvzpatfyhdydfmxef`). The other project in the account, `dhlvtisumrvhnqbeidlt`, is not FAS and must not be used.
- [ ] **Dry run passed on synthetic data** (section 6) with the evidence attached to the F-604 issue.
- [ ] **Retention period decided** for case-level rows and the deletion-request procedure agreed (`docs/PRIVACY_AND_COMPLIANCE.md` rule 9).

## 2. What the load consists of

Real data enters only through the app's own intake paths. There is no bulk SQL import and no engineer-side script that reads a real file.

| Path | Route | Who uses it | Notes |
|---|---|---|---|
| CSV upload | `/staff/intake` (staff or admin) | FAS staff, George | Download the template, fill it in, upload, map columns, check the preview, then save. Rows are validated before anything is written; a batch can be rolled back. |
| Manual entry | `/staff/entry` | FAS staff | One record at a time, same validation. |
| Aggregate totals | `/staff/entry` (aggregate form) | FAS staff | For numbers FAS only has as totals. Always labelled Σ Aggregate. |

The five CSV entities and their templates (`GET /api/intake/template?entity=…`): `case`, `application`, `authorization`, `delivery`, `outcome`. Load them in that order, because each later entity references the IDs of the one before it.

Fields that are **not collected** and have no column in any template: clinical notes, diagnoses, substance-use treatment details, court documents, names, addresses, ZIP codes. Only that a court order exists and its date (rule 6). If a FAS spreadsheet contains such columns, they are left unmapped; the mapping step does not offer them a destination.

Every saved batch writes an `upload_batch` row (counts of rows saved and rejected, the mapping used, who saved it) and an `audit_log` row. Every displayed number traces back to that batch.

## 3. Production environment setup (team, before the gate closes)

Do this on a branch-free day with the team on call. Nothing here touches real data yet.

1. **Create the production Supabase project** in the FAS organization. Name it so it cannot be confused with `fas-dev`. Record its project ref in `harness/DECISIONS.md` as a new decision superseding D-023. Enable the BAA on the project if the plan offers one.
2. **Apply the migrations** from `supabase/migrations/` in order with the Supabase CLI (`supabase db push --linked` against the production ref, or the dashboard's migration runner). Never hand-edit an applied migration; a fix is a new file (golden rule 6). Confirm every table shows RLS enabled and forced.
3. **Do not run `supabase/seed.sql` and do not run `pnpm seed:synthetic`** against production. Production starts empty except for reference rows that migrations insert: the 29 Utah `geo_county` rows (`20261017180000_f604_geo_county_utah.sql`; before that migration only the seed had them, so a fresh project rejected every county code), `source_registry`, and the approved `need_score_config` and `match_config` versions. Check: `select count(*) from geo_county where state = 'UT'` returns 29.
4. **Create the FAS org row** with `name = 'Family Advocacy Services'`, `state = 'UT'` and `uei = 'CZ9FYJUKH2S9'`. That UEI is public, and was verified Active on SAM.gov on 2026-10-17, expiring 2027-09-15 (`docs/research/sam_entity.md`). Then **create the real user accounts** through Supabase Auth with `app_metadata.role` set to `admin`, `staff` or `board_viewer` and `app_metadata.org_id` set to the FAS org. No `example.test` accounts in production.
5. **Vercel**: add a production-only set of environment variables pointing at the new project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, a fresh `INGEST_TOKEN`, `CENSUS_API_KEY`, `SIMPLER_GRANTS_API_KEY`, `SOCRATA_APP_TOKEN` (optional), the alert webhook variables and `INGEST_ALERT_SECRET`, and George's `SAM_API_KEY` for the weekly SAM registration check). `.env.example` lists every name; values never go in the repo. Preview deployments keep the `fas-dev` values. Confirm the Ignored Build Step noted in D-014 is removed so `main` deploys.
6. **Supabase Auth**: on the paid plan, turn on leaked-password protection (Auth → Passwords). Set a minimum length of 12 with mixed character types. Turn off sign-ups, since accounts are created by an admin. F-602 deferred this to production.
7. **n8n**: point a production copy of each ingest workflow (including `sam-registration-weekly`) at the production ingest URLs with the fresh token, keep them inactive until step 8, and keep the dev copies pointing at `fas-dev`.
8. **Load the public data** by running the ingest workflows once (Census ACS, SAHIE, SAIPE first; the need score recompute after them). Check `/data-freshness` shows every source Current and the need map ranks all 29 counties.
9. **Smoke the empty app** as each role: `/api/health` returns 200 with both checks ok; `/staff` shows "not available yet" tiles; `/board` shows the public-data cards and "No closed cases this quarter"; `/need-map` works.

Evidence to keep: the migration output, a screenshot of the RLS column in the dashboard, the health JSON, and the freshness page.

## 4. Preparing the files (George, on his machine)

1. Export from FAS's current system one CSV per entity, using the templates from `/staff/intake` as the column list. Keep only the columns the template names.
2. Replace any client name or address with the stable internal case ID that FAS already uses; the app stores IDs, not names.
3. Dates as `YYYY-MM-DD`. Counties as Utah FIPS codes (`49035` for Salt Lake). Income band as the letter the template lists.
4. Keep the files in FAS's own encrypted storage. Do not email them, do not upload them anywhere but the production app.

## 5. The real load (George performs or approves; one team member on call)

1. Sign in to production as an admin account. Confirm the header reads **FAS Evidence** with no "Synthetic data" badge.
2. For each entity in order (`case`, `application`, `authorization`, `delivery`, `outcome`):
   1. Open `/staff/intake`, upload the file, map the columns, and read the preview. The preview lists every rejected row with the reason; fix the file or accept the rejections.
   2. Save. Note the batch ID the page shows ("Saved N rows as batch …").
   3. If anything looks wrong, use "Roll back this upload" on the same page (or the Roll back action in the upload list below it) before loading the next entity. Rollback removes exactly that batch's rows and writes its own audit record.
3. Open `/dashboard` and `/board`. Every card shows either a number, "n<11", or "No closed cases this quarter". Counts under 11 are hidden by the database views, not by the page, so a small FAS is expected to see several hidden cells; that is correct behaviour.
4. Download the board packet as Word from `/board` and read it once as a board member would: no names, no exact dates, no cell under 11. The export route refuses to produce a file that fails those checks (HTTP 422), so a successful download is itself evidence.
5. Record in the F-604 issue: the batch IDs, rows saved and rejected per entity, who performed the load, and the date. No data values.

## 6. Dry run on synthetic data (team; required before section 5)

The dry run is scripted, so it proves the load path on every CI run as well as on demand.

**Automated: `tests/db/real-load-dry-run.test.ts`.** It runs in `pnpm test:db` locally and in CI. It plays a brand-new production project:
1. It creates a fresh org "FAS Dry Run (synthetic)" and a fresh admin account, the way section 3 step 4 does.
2. It loads all five entities in section 5 order through the same server path as `/staff/intake` → `/api/intake/commit`: server-side validation, then `intake_commit` under the admin's own access rules. Each file has 40 synthetic rows across all 29 counties.

It checks:
- **Section 3:** the migration alone carries the 29 Utah counties.
- **Section 5 step 2:** a file with a bad county saves nothing and names the column.
- **Section 5 step 2:** each entity saves 40 rows as one committed batch, with one `intake.commit` audit row, and every row is stamped with the org and batch.
- **Section 2:** a column outside the template (`diagnosis`) is never stored, in any table or in the audit log.
- **Section 5 step 3:** the shared M1, M4 and M6 views show the load and never a count under 11. The 10-case income band is hidden.
- **Section 5 step 2.3:** a rollback removes exactly that batch, marks it `rolled_back`, writes `intake.rollback`, and a second rollback is refused (409).

It deletes everything it created, so it can run any number of times.

**To run it:**
1. `supabase start`
2. `supabase db reset`
3. `pnpm test:db`, or for this file alone: `pnpm exec vitest run -c vitest.db.config.mts tests/db/real-load-dry-run.test.ts`, with the `supabase status -o env` values exported as `pnpm test:db` does

**Visual check (optional, before the real load):** sign in locally as `admin@example.test` and click through section 5 with `tests/fixtures/intake/case-good.csv` and `case-bad.csv`, so the person doing the real load has seen the screens once.

**Evidence for the F-604 issue:** the CI run link where `test:db` passed on `main`, and the local `test:db` output.

## 7. After the load

- **Agents stay out.** Production credentials are never added to Cursor Cloud secrets, Claude environments, GitHub Actions or the repo. The nightly audit and the staleness check keep reading `fas-dev`.
- **Previews keep synthetic data.** Any PR preview still points at `fas-dev`; e2e tests still use the `example.test` accounts there.
- **Retention and deletion.** A deletion request is honoured by rolling back the batch that holds the rows (or deleting the specific rows by ID with the service role from a logged session) and recording the request in `audit_log`.
- **Incident path.** If a real file ever lands in a non-production place (a preview, a ticket, a chat, a checkout): stop, tell George, delete it everywhere it landed, and record the incident with dates in the F-604 issue. Rotate any token that was in the same place.

## 8. Checklist summary for the F-604 issue

- [ ] Section 1 gates ticked by George, with the legal opinion and BAAs held by FAS.
- [ ] Section 3 evidence attached (migrations, RLS, health, freshness).
- [ ] Section 6 dry-run evidence attached (CI link and local `test:db` output for `real-load-dry-run.test.ts`).
- [ ] Section 5 performed; batch IDs and counts recorded; packet downloaded and read.
- [ ] `harness/DECISIONS.md` updated with the production project ref and the date real data went in.
