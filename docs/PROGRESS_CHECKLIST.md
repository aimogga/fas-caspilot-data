# FAS Evidence Progress Checklist

Last updated: 2026-10-12

## Summary

- **Done:** 6 of 44 features (14%): F-003, F-101, F-102, F-103, F-104 and F-105.
- **In progress:** F-202 SAHIE ingest (#86 plus #92, both with QA); F-601 nightly audit (partly working).
- **Next up:** F-201 source registry and ingest logging.
- **Blocked:** None right now. #77 Copilot pilot should unblock once main is merged into it (error-page layout fix landed in PR #90).

## Design system

- Rename to FAS Evidence: done (PR #28, merged at e20b7a0).
- Deck and PRD are FAS-only: done (PR #34, merged at f989572).
- Design workflow and DS specs: done (PR #32, docs/DESIGN_WORKFLOW.md).
- Design-system v1 source (sources 1/4): done (PR #35). Sources 2/4 screen plan part 1: done (PR #43, merged at 4913fba). Sources 3/4 screen plan part 2: done (PR #44, merged at a6a043b). Sources 4/4 mockups: done (PR #45, merged at 976dcc1; generator PR #46, merged at 96c712b).
- **DS-01a** Tailwind v4 + tokens: done (PR #33, squash-merged at cfab531). QA PASS and DESIGN APPROVED.
- **DS-01b** shadcn base components: done (PR #36, merged at 5a38f52).
- **DS-01c** layout and trust primitives: done (PR #37, merged at 4b59f96).
- DS-02/03/04 spec amendments (adopt DS-01c Page container): done (PR #40, merged at 488bbe6).
- **DS-02a** signed-in app shell (route move, role nav, desktop sidebar/rail, top bar): done (PR #41, squash-merged at 4176aae).
- **DS-02b** mobile menu button and nav sheet (with the sheet-header wordmark; the top-bar wordmark came in #41): done (PR #50, squash-merged at 515e046).
- DS-02 follow-ups (sheet focus-trap, scroll-lock and reduced-motion e2e, hidden nav items, board crumb "Board dashboard"): done (PR #54, squash-merged at 4f14df6, closes #49).
- Docs: checklist DS-02a done, F-601 refresh (PR #51, merged at 1f06fb3).
- Open issue #52: the nightly-audit unit test writes a RED fixture report into the gitignored harness/audits/.
- Docs follow-ups (design workflow refs, progress entries #42–#47, checklist): done (PR #48, merged at 9aae887).
- **DS-03** login: done (PR #56, squash-merged at 7ee6ca0). Page split layout, mapped errors (no raw Supabase text), Show/Hide toggle, 375/1024/1440 e2e and axe.
- DS-03 follow-up issues (open):
  - #57: Forgot password route (the link stays hidden until it exists).
  - #58: DS-03 follow-ups: Example chip, alert title, rate-limit copy (the Example chip and neutral rate-limit copy shipped in #56).
  - #59: after sign-in every role lands on / instead of its home (closed by PR #62).
  - #60: a signed-in user visiting /login sees the form (closed by PR #71).
- **DS-04** 403/404/error and role redirect: done. DS-04a role redirect, real 403 status, session expired (PR #62, squash-merged at 21c693b, closes #59); DS-04b 403, 404 and error pages (PR #64, squash-merged at b69df8b).
- DS-04 follow-up issues:
  - #63: prefix-based route guards so unknown paths can 404 (closed by PR #76).
  - #65: DS-04 design follow-ups (non-blocking; stays open, leftovers tracked in #91).
  - #66: auth hardening: Supabase session cookie isn't HttpOnly or Secure (closed by PR #82).
  - #67: DS-04 QA follow-ups: no-role e2e, parity entries, area names on 403.
- Docs: checklist DS-04 done, follow-ups, next #60 (PR #68, merged at 7291b82).
- CI: per-PR concurrency and docs-only fast path (PR #72, merged at 1f1e7ab).
- Copilot routing, instructions and task packet gates (PR #69, merged at 637d40f).
- Auth: prefix-based route guards so unknown paths 404 (PR #76 merged at 3125135, closes #63).
- #76 follow-up issues (open):
  - #78: breadcrumb shows "FAS Evidence" on encoded URLs like /%61dmin.
  - #79: guard-list check: fail on unguarded top-level routes (closed by PR #81).
- Auth: route guard coverage test (PR #81 by Engineer Bot, squash-merged at 438f7c0, 2026-10-12 21:41:17 UTC, closes #79).
- Auth: HttpOnly, Secure and SameSite=lax session cookies; logout clears them (PR #82, QA PASS and DESIGN APPROVED at 0729e7e, squash-merged at 3ba8f7f, 2026-10-12 21:52:03 UTC, closes #66). #66 done.
- #82 follow-up issues (open):
  - #84: login CSRF and cookie Max-Age.
  - #85: "sign-in unavailable" message.
  - #87: 403 breadcrumb.
- Docs: checklist and progress for #81 and #82, #66 done (PR #88, squash-merged at b4ed683, 2026-10-12 22:02:49 UTC).
- Fix: signed-in error page uses the role-shell content area (PR #90, QA PASS and DESIGN APPROVED at 2f0a13f, squash-merged at d1432ad, 2026-10-12 22:55:30 UTC, refs #65). #65 stays open; its leftovers are tracked in #91, which now includes a loading-skeleton note.
- #77 Copilot pilot: should unblock once main is merged into it (PR #90 landed the error-page layout).

## Decisions

- **D-015** Data-use ruling (FAS-only, grants only): merged (PR #38, at b7c2ec8).
- **D-016** GitHub admin standing permission: merged (PR #39, at 6fc8976).

## Phase 0: Getting ready

- [ ] **Not started** F-000 Plugin and tool inventory completed: a list of every tool we could use, marked use / maybe / avoid, with any that would send FAS data outside flagged.
- [ ] **Not started** F-001 Open decisions D-001 to D-010 decided: each open question has options and a recommendation, and George's choice is written down.
- [ ] **Not started** F-002 Phase 2 and 5 data sources verified: each public data source is checked to work, be current and be allowed for our use.
- [x] **Done** F-003 Cursor Cloud environment ready: the building robots can set up and run the app on a fresh computer, with passwords stored safely.

## Phase 1: Foundation

- [x] **Done** F-101 App shell with Supabase Auth and roles: people can sign in and out, and admins, staff and board members each only see the pages meant for them.
- [x] **Done** F-102 Database schema v1 with RLS deny-by-default: the database is built, and each organization can only see its own data; nothing is visible unless a rule allows it.
- [x] **Done** F-103 Synthetic data generator: about 200 realistic fake cases across Utah counties, so we can test without any real people's information.
- [x] **Done** F-104 CI pipeline: Every change is automatically tested and scanned for leaked secrets, and main can't be changed without passing checks.
- [x] **Done** F-105 Preview environments: Every PR gets its own preview site, connected only to the test database with fake data.

## Phase 2: Public data and county need

- [ ] **Not started** F-201 Source registry, ingest run logging and failure alerts: we keep a record of every data import and get an alert if one fails, with no duplicate data on re-runs.
- [ ] **In progress** F-202 Ingest: Census SAHIE uninsured by county: brings in how many people lack health insurance in each Utah county. Work is #86 plus #92, both with QA.
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

- [ ] **In progress** F-601 Nightly audit script: Nightly audit runs and fails on serious problems, but it's partial (feature_list status: failing, no evidence). Data freshness, data sanity, grants and cost checks are stubbed as SKIPPED; there's no `pnpm audit:nightly` script; it doesn't file its report as a PR or issue; it hasn't been run against a preview. The schedule has fired once (Oct 11, 15:47 UTC, about 6 hours after its 09:23 cron) and missed Oct 12, which was covered by a manual run. Backup trigger for a missed schedule: done (PR #47, merged at 04684db), and it hasn't fired on schedule yet.
- [ ] **Not started** F-602 Security review: a full check that data access rules, passwords and software are all safe.
- [ ] **Not started** F-603 Legal review gate: a written legal opinion on health privacy rules and court records, with required agreements signed.
- [ ] **Not started** F-604 Real-data onboarding runbook and migration: a step-by-step plan for loading FAS's real data, practiced first on fake data.
- [ ] **Not started** F-605 Board launch: board accounts created, board packet delivered and their feedback recorded.

---

Standing rule: this checklist is updated by a small QA-reviewed docs PR after every merge.
