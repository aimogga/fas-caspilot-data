# Runbook: loading FAS's real data into production (F-604)

**Status: not yet executed. Real FAS data is gated on George (`human_gate: george-before-deploy`, Phase 6 legal gate in `docs/PRIVACY_AND_COMPLIANCE.md`).** Until every box in section 1 is ticked by George, the only data anywhere is synthetic or public, and production (`fas-caspilot-data.vercel.app`) keeps pointing at the synthetic `fas-dev` Supabase project (D-023).

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
- [ ] **Plans that offer the needed BAAs are purchased** (Supabase and Vercel both require a paid tier for a BAA). Money decisions go through Chief of staff (D-014).
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
3. **Do not run `supabase/seed.sql` and do not run `pnpm seed:synthetic`** against production. Production starts empty except for reference rows: the 29 `geo_county` rows, `source_registry`, the approved `need_score_config` and `match_config` versions. Those come from migrations, not from the seed.
4. **Create the FAS org row and the real user accounts** through Supabase Auth with `app_metadata.role` set to `admin`, `staff` or `board_viewer` and `app_metadata.org_id` set to the FAS org. No `example.test` accounts in production.
5. **Vercel**: add a production-only set of environment variables pointing at the new project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, a fresh `INGEST_TOKEN`, `CENSUS_API_KEY`, the alert webhook variables). Preview deployments keep the `fas-dev` values. Confirm the Ignored Build Step noted in D-014 is removed so `main` deploys.
6. **n8n**: point a production copy of each ingest workflow at the production ingest URLs with the fresh token, keep them inactive until step 7, and keep the dev copies pointing at `fas-dev`.
7. **Load the public data** by running the ingest workflows once (Census ACS, SAHIE, SAIPE first; the need score recompute after them). Check `/data-freshness` shows every source Current and the need map ranks all 29 counties.
8. **Smoke the empty app** as each role: `/api/health` returns 200 with both checks ok; `/staff` shows "not available yet" tiles; `/board` shows the public-data cards and "No closed cases this quarter"; `/need-map` works.

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

The dry run proves the exact clicks of section 5 against the synthetic generator's output, so the real load has no surprises.

1. Locally: `supabase start`, `supabase db reset` (migrations plus `seed.sql`), `pnpm dev`. Sign in as `admin@example.test`.
2. Use synthetic CSVs that match the templates: `tests/fixtures/intake/case-good.csv` (saves) and `case-bad.csv` (every row rejected with a reason) cover the `case` entity; for the other four entities, download each template from `/staff/intake` and fill a few rows by hand from the IDs the local seed created (the seed itself is loaded by `supabase db reset`, and `pnpm seed:synthetic --sql <file>` writes the same rows as SQL for the local database, not as CSVs).
3. Walk section 5 steps 2 to 4 with those files. Expect: `case-good.csv` saves and shows a batch ID; `case-bad.csv` saves nothing and lists every error; "Roll back this upload" removes the good batch and the list below shows it as Rolled back; the dashboards and the Word packet render.
4. Run the automated proof of the same path: `pnpm test` (intake validation, mapping, commit and rollback units), `pnpm test:db` (RLS per table × role against the local database), and in CI `pnpm test:e2e` (`upload.spec.ts`, `entry-forms.spec.ts`, `aggregate.spec.ts`, `packets.spec.ts`).
5. Attach to the F-604 issue: the CI run link, the local `test:db` output, and screenshots of the intake preview, the saved-batch message and the rollback message. That is the "dry run on synthetic data passes" evidence.

## 7. After the load

- **Agents stay out.** Production credentials are never added to Cursor Cloud secrets, Claude environments, GitHub Actions or the repo. The nightly audit and the staleness check keep reading `fas-dev`.
- **Previews keep synthetic data.** Any PR preview still points at `fas-dev`; e2e tests still use the `example.test` accounts there.
- **Retention and deletion.** A deletion request is honoured by rolling back the batch that holds the rows (or deleting the specific rows by ID with the service role from a logged session) and recording the request in `audit_log`.
- **Incident path.** If a real file ever lands in a non-production place (a preview, a ticket, a chat, a checkout): stop, tell George, delete it everywhere it landed, and record the incident with dates in the F-604 issue. Rotate any token that was in the same place.

## 8. Checklist summary for the F-604 issue

- [ ] Section 1 gates ticked by George, with the legal opinion and BAAs held by FAS.
- [ ] Section 3 evidence attached (migrations, RLS, health, freshness).
- [ ] Section 6 dry-run evidence attached (CI link, `test:db` output, screenshots).
- [ ] Section 5 performed; batch IDs and counts recorded; packet downloaded and read.
- [ ] `harness/DECISIONS.md` updated with the production project ref and the date real data went in.
