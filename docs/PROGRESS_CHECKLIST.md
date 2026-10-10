# FAS Evidence Progress Checklist

Last updated: Oct 10, 2026

## Summary

- **Done:** 5 of 44 features (11%): F-003, F-101, F-102, F-103 and F-105.
- **In progress:** F-601 nightly audit (partly working), and renaming the product to "FAS Evidence".
- **Next up:** Phase 2 public data imports, starting with F-201 (a record of every data import and its results).
- **Blocked:** F-104 branch protection, pending George's GitHub Pro upgrade. Locking the main branch so checks must pass needs the paid plan. The automatic checks and secret scan already run on every change (PR #25).

## Phase 0: Getting ready

- [ ] **Not started** F-000 Plugin and tool inventory completed: a list of every tool we could use, marked use / maybe / avoid, with any that would send FAS data outside flagged.
- [ ] **Not started** F-001 Open decisions D-001 to D-010 decided: each open question has options and a recommendation, and George's choice is written down.
- [ ] **Not started** F-002 Phase 2 and 5 data sources verified: each public data source is checked to work, be current and be allowed for our use.
- [x] **Done** F-003 Cursor Cloud environment ready: the building robots can set up and run the app on a fresh computer, with passwords stored safely.

## Phase 1: Foundation

- [x] **Done** F-101 App shell with Supabase Auth and roles: people can sign in and out, and admins, staff and board members each only see the pages meant for them.
- [x] **Done** F-102 Database schema v1 with RLS deny-by-default: the database is built, and each organization can only see its own data; nothing is visible unless a rule allows it.
- [x] **Done** F-103 Synthetic data generator: about 200 realistic fake cases across Utah counties, so we can test without any real people's information.
- [ ] **Blocked** F-104 CI pipeline: every change is checked and scanned for leaked passwords automatically (working), but locking the main branch needs paid GitHub Pro.
- [x] **Done** F-105 Preview environments: Every PR gets its own preview site, connected only to the test database with fake data.

## Phase 2: Public data and county need

- [ ] **Not started** F-201 Source registry, ingest run logging and failure alerts: we keep a record of every data import and get an alert if one fails, with no duplicate data on re-runs.
- [ ] **Not started** F-202 Ingest: Census SAHIE uninsured by county: brings in how many people lack health insurance in each Utah county.
- [ ] **Not started** F-203 Ingest: Census SAIPE poverty by county: brings in poverty levels for each Utah county.
- [ ] **Not started** F-204 Ingest: ACS 5-year denominators: brings in population counts so rates can be calculated fairly.
- [ ] **Not started** F-205 Ingest: HRSA mental health HPSA: brings in which counties have a shortage of mental health providers.
- [ ] **Not started** F-206 Ingest: CDC PLACES county mental health measures: brings in county-level mental health estimates from the CDC.
- [ ] **Not started** F-207 Ingest: Utah Courts filings by county (workbook): brings in court case filing counts for each county.
- [ ] **Not started** F-208 Ingest: VA VetPop2023 county: brings in the number of veterans living in each county.
- [ ] **Not started** F-209 Data freshness panel: a screen showing how up to date each data source is, with stale ones clearly labeled.
- [ ] **Not started** F-210 County need score v1 with methodology page: one score per county showing where need is greatest, with a page explaining how it's calculated.
- [ ] **Not started** F-211 Utah county map explorer: a map of Utah colored by need; click a county to see its numbers and where they came from.

## Phase 3: FAS's own data and results

- [ ] **Not started** F-301 Spreadsheet upload with mapping and validation: staff can upload a spreadsheet, see any errors row by row, preview it, and undo an upload.
- [ ] **Not started** F-302 Manual entry forms: staff can type in cases, applications, approvals, services and outcomes one at a time, with every change logged.
- [ ] **Not started** F-303 Aggregate-only submissions: partners can send just totals for a period instead of individual cases, clearly labeled as totals.
- [ ] **Not started** F-304 Metrics M1–M6: the six core numbers that show how FAS is doing, filterable by date, county and referral source.
- [ ] **Not started** F-305 Outcome change metric O1: shows whether people's mental health scores improved after help, on common questionnaires.
- [ ] **Not started** F-306 Suppression and complementary suppression: small counts (under 11) are hidden in shared views so no one can be identified.

## Phase 4: Dashboards and reports

- [ ] **Not started** F-401 Team dashboard: one screen for staff with the key numbers, trends, data freshness and grant pipeline, each with its as-of date.
- [ ] **Not started** F-402 Board dashboard (print-friendly): a plain-language one-page view for the board that prints cleanly.
- [ ] **Not started** F-403 Evidence packet PDF: a ready-made PDF for grant applications and board packets, with no identifying details.
- [ ] **Not started** F-404 Evidence packet DOCX and CSV appendix: the same packet as an editable Word file plus a spreadsheet of the numbers.

## Phase 5: Grant finding and writing help

- [ ] **Not started** F-501 Grants.gov opportunity ingest: automatically finds federal grants that match FAS's work.
- [ ] **Not started** F-502 Foundation opportunities: manual entry and CSV import: staff can add private foundation grants by hand or by spreadsheet.
- [ ] **Not started** F-503 Eligibility filters and flags: checks whether FAS qualifies for each grant and clearly flags any requirement not met.
- [ ] **Not started** F-504 Fit score and 'How we matched' panel: rates how well each grant fits and explains why in plain terms.
- [ ] **Not started** F-505 Weekly grant digest: a weekly email of the best new grant matches, turned on only when George says so.
- [ ] **Not started** F-506 Award history from USAspending: shows past federal awards for similar grants, like typical size and how much went to Utah.
- [ ] **Not started** F-507 Foundation grant history (ProPublica / 990-PF): looks up what a foundation has given in the past, noting the year and any gaps.
- [ ] **Not started** F-508 Response strategy builder (cited drafts): drafts a grant response where every number links to its source; staff must approve before export.
- [ ] **Not started** F-509 Grant match eval set and regression gate: a test set of grants that makes sure match quality stays good over time.

## Phase 6: Safety checks and launch

- [ ] **In progress** F-601 Nightly audit script: Nightly audit runs and fails on serious problems, but it's partial: it doesn't yet check data freshness, data sanity, grants or cost, it doesn't file its report as a PR or issue, it hasn't been run against a preview, and the new schedule hasn't fired yet.
- [ ] **Not started** F-602 Security review: a full check that data access rules, passwords and software are all safe.
- [ ] **Not started** F-603 Legal review gate: a written legal opinion on health privacy rules and court records, with required agreements signed.
- [ ] **Not started** F-604 Real-data onboarding runbook and migration: a step-by-step plan for loading FAS's real data, practiced first on fake data.
- [ ] **Not started** F-605 Board launch: board accounts created, board packet delivered and their feedback recorded.

---

This checklist is updated after every merge.
