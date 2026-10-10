# Progress Log

Append one entry per session, newest at the bottom. Keep entries short. Agents read the last 3 entries at the start of every session.

```
## YYYY-MM-DD HH:MM (TZ) — <agent> — <packet TP-____ / feature F-____>
Did: <what changed, 1–3 lines>
State: <compiles? tests green? app starts?>
Evidence: <PR / CI / screenshot links>
Left to do: <exact next steps if unfinished>
Decisions needed: <none | link to DECISIONS.md item>
```

## 2026-10-08 — George (via Claude) — kit seeded
Did: Seeded AGENTS.md, Cursor rules, specs, feature list (44 features, all failing), decisions, audit and QA checklists.
State: No application code yet.
Left to do: Chief of Staff runs Phase 0 (F-000 to F-003).
Decisions needed: D-001 to D-010 in DECISIONS.md.

## 2026-10-08 19:55 (UTC) — Cloud Agent — packet env-setup / feature F-003
Did: Added `.cursor/environment.json` plus install/start scripts (Docker with fuse-overlayfs, Supabase CLI 2.120.0, pnpm). Added a Next.js shell with `pnpm lint`, `typecheck`, `test`, and a local service check against Supabase. No auth, schema, or product screens.
State: `pnpm lint`, `typecheck`, and `test` are green. `GET /api/health` reports app and local Supabase up. Supabase project id is `fas-casepilot` with an empty seed.
Evidence: PR for the cloud environment.
Left to do: Phase 1 app shell (F-101) and schema (F-102). QA still owns F-003 status.
Decisions needed: D-001 to D-010 still open. Versions above are the cloud shell pins, not a Phase 1 decision.

## 2026-10-08 22:53 (UTC) — Cloud Agent — packet TP-0003 / F-601 (first slice)
Did: `.github/workflows/nightly-audit.yml` (cron 9 AM UTC, workflow_dispatch, PR). Checks: harness (evidence, AGENTS.MD cmds, doc refs, progress), secret scan (env/self-match fix), deps, build. 13 tests. Workflow green. Audit: Critical=none at main (branch self-match 572d640), HIGH braces CVE, MEDIUM missing test:db/test:e2e/seed:synthetic & PRs #3/#4/#5.
Evidence: PR #7
Left: F-601 full (Phase 6).
Decisions: None.

## 2026-10-09 03:30 (UTC) — Cloud Agent — packet TP-0004 / F-101
Did: Reject `//` path after URL normalize; `/api/health` public; redirect keeps query; restore page.module.css.
State: lint/typecheck/unit/e2e green vs local Supabase.
Evidence: PR #10.
Left: QA re-check. Denied-route 200 later.
Decisions: None.

## 2026-10-09 04:50 (UTC) — TP-0005 / F-102 part 1
Did: 7 tables + helpers + deny-by-default RLS; table-driven rls.test.ts; test:db from status -o env. Left: parts 2–3. Decisions: public SELECT-only; org SELECT own + known role; UPDATE admin own; no INSERT/DELETE.

## 2026-10-09 05:50 (UTC) — TP-0005 QA FAIL #1
Did: org-norole; user_metadata test; guard probe; REVOKE anon; keys from status -o env only.

## 2026-10-09 06:20 (UTC) — TP-0005 QA FAIL #2
Did: staff role-only + rpc helpers; partitioned probe; loopback host check.

## 2026-10-09 07:05 (UTC) — TP-0005 QA FAIL #3
Did: parse URLs at load; reject search/hash and PGHOST*; psql -h/-p/-U/-d + PGPASSWORD.

## 2026-10-09 07:35 (UTC) — TP-0005 QA FAIL #4
Did: reject dbname/user unless /^\w+$/; clear PGOPTIONS in sql() child env; unit tests for non-loopback SUPABASE_URL and conninfo dbnames.

## 2026-10-09 08:00 (UTC) — Cloud Agent — packet TP-0006 / F-102 part 2
Did: 8 FAS tables with org_id + same-org composite FKs; admin/staff SELECT/INSERT/UPDATE and admin DELETE via a policy DO loop; synthetic seed for orgs aaaa/bbbb; rls.test.ts matrix plus org-move/child-FK cases; localPgEnv() for psql child env.
State: lint/typecheck green; unit 60/60; test:db 490/490; e2e 5/5; `/api/health` ok vs local Supabase.
Left: F-102 part 3 (grants/exports). Decisions: none.

## 2026-10-09 08:35 (UTC) — Cloud Agent — TP-0006 QA FAIL
Did: INSERT via return-minimal then svc tag lookup+cleanup; table-driven 6 composite child FKs; catalog org_id NOT NULL on all 8 FAS tables.
Left: F-102 part 3. Decisions: none.

## 2026-10-09 09:25 (UTC) — Cloud Agent — packet TP-0007 / F-102 part 3
Did: 8 grants/export/audit tables with CHECK enums, org-scoped RLS (export_job created_by=auth.uid(), audit_log actor uuid append-only), view security_invoker guard, synthetic seed, rls matrix + ARCH catalog.
State: lint/typecheck green; unit 60/60; test:db 767/767; e2e 5/5; `/api/health` ok vs local Supabase.
Left: none (F-102 schema complete). Decisions: none.

## 2026-10-09 10:35 (UTC) — Cloud Agent — TP-0007 QA FAIL
Did: CHECK bogus inserts; guard true/on (ci) + false probe + matviews; pg_constraint PK/FKs; stamp_now() on audit_log.at / export_job.created_at.
Left: none. Decisions: none.

## 2026-10-09 12:25 (UTC) — Cloud Agent — TP-0007 QA FAIL #2
Did: exact CHECK defs in `$t has $def`; view probes off/0/no; REVOKE TRUNCATE,TRIGGER from anon/authenticated + catalog.
Left: none. Decisions: none.

## 2026-10-09 14:00 (UTC) — Cloud Agent — packet TP-0008 / F-103
Did: Pure seeded generator in `lib/synthetic/` (~200 cases, 29 UT counties); `pnpm seed:synthetic` loads local Supabase (idempotent f103 ids, keeps seed.sql fixtures) or `--sql` export; unit invariants + golden 20-case fixture. Renamed F-102 migrations to fas-dev versions (no content change).
State: lint/typecheck/unit 64/64; test:db 785/785 after seed; e2e 5/5; `/api/health` ok.
Evidence: https://github.com/aimogga/fas-caspilot-data/pull/21
Left: none (QA packet requested on the PR).
Decisions: none.

## 2026-10-09 14:27 (UTC) — Cloud Agent — TP-0008 QA FAIL / F-103
Did: Realism: followup ≥ last session/baseline; sessions/paid/auth vs award; outcome mix; all 12 providers; denied skip episodes/outcomes; weighted counties; vary court lag. Mutant invariants + toSql org/f103/idempotent test. Golden hand-recomputed.
State: lint/typecheck/unit 66/66; seed x2; test:db 785/785; e2e 5/5.
Evidence: PR #21.
Left: none (QA re-check).
Decisions: none.

## 2026-10-09 15:14 (UTC) — Cloud Agent — TP-0008 QA FAIL #2 / F-103
Did: Court order 1–30 days before referral (≥5 distinct gaps); followup mix ≥20% improve/flat/worsen (kills after-20-worsens). Golden unchanged.
State: lint/typecheck/unit/seed/test:db/e2e pending this commit.
Evidence: PR #21. Left: none. Decisions: none.

## 2026-10-09 16:02 (UTC) — Cloud Agent — packet TP-0009 / F-601
Did: Nightly audit exits non-zero on Overall RED or Critical; YELLOW/GREEN stay 0. Report printed to job log. Braces GHSA-vfj7-8cjw-p6xm reviewed ignore.
Left: none. Decisions: none.

## 2026-10-09 16:25 (UTC) — Cloud Agent — TP-0009 QA FAIL PR #22
Did: Fail-closed parse; GHSA-only ignore (unique id, ≤90-day expiry); scanner cannot-run RED.
Left: none. Decisions: none.

## 2026-10-09 18:42 (UTC) — Cloud Agent — TP-0009 QA FAIL #6 PR #22
Did: Exact severity match (upgrade RED, downgrade not GREEN); missing GHSA counted; second braces GHSA counted.
Left: none. Decisions: none.

## 2026-10-10 13:50 (UTC) — Cloud Agent — packet TP-0010 / F-601
Did: Moved Nightly Audit cron off the hour to `23 9 * * *`. Added fail-closed staleness check (`scripts/audit-staleness.mjs`) plus workflow cron `41 */6 * * *` that fails when main has no successful schedule-triggered Nightly Audit in 24h.
State: lint/typecheck/unit 136/136 green.
Left: none.
Decisions: none.

## 2026-10-10 14:05 (UTC) — Cloud Agent — TP-0010 QA FAIL PR #24
Did: Freshness uses created_at only; future-dated created_at (>5m after now) fails; 23h59m59s / exactly-24h literals; body-read throw exits 1; fetch AbortSignal.timeout.
State: lint/typecheck/unit 142/142 green.
Left: none. Decisions: none.

## 2026-10-10 14:15 (UTC) — Cloud Agent — TP-0010 QA FAIL #2 PR #24
Did: Injectable timeoutMs; abort-stub test exits 1 within 1s; FETCH_TIMEOUT_MS < 5min job cap.
State: lint/typecheck/unit 144/144 green.
Left: none. Decisions: none.

## 2026-10-10 14:22 (UTC) — Cloud Agent — TP-0010 QA FAIL #3 PR #24
Did: Same AbortSignal covers headers and body read; spy asserts default FETCH_TIMEOUT_MS; body-read abort exits 1 in <1s.
State: lint/typecheck/unit 146/146 green.
Left: none. Decisions: none.

## 2026-10-10 15:05 (UTC) — Cloud Agent — packet TP-0011 / F-104
Did: Added `.github/workflows/ci.yml` (`ci` + `secret-scan` jobs) on PR/push to main. Secret scan reuses `scripts/nightly-audit.mjs --secrets-only` (working-tree scan) and fails on a planted secret. Local Supabase + Playwright chromium for `test:db` / e2e smoke.
State: lint/typecheck/unit 157/157 green. Awaiting this PR's CI run.
Left: none (supervisor: branch protection + GitHub secret scanning toggle).
Decisions: none.

## 2026-10-10 15:22 (UTC) — Cloud Agent — TP-0011 QA FAIL PR #25
Did: Secret scan now flags ghp/gho/ghu/ghs/ghr/github_pat, service_role JWTs (decode payload), sb_secret_, remote postgres URLs with passwords, AWS_SECRET_ACCESS_KEY; dropped example/test_ skip (placeholders only). Planted-format tests; lock paths scanned; ci.yml SHA pins + start logs; structure test.
State: lint/typecheck/unit 176/176 green.
Left: none.
Decisions: none.

## 2026-10-10 15:39 (UTC) — Cloud Agent — TP-0011 QA FAIL #2 PR #25
Did: Replaced string-ban ci.yml test with parseYaml+assertCi (in-tree subset parser). Check steps must be exact allowlisted runs; rejects job/step if and continue-on-error. Negatives: if ${{ false }}, `; exit 0`, --passWithNoTests, echo, || :. Start log prints migrate/seed only.
State: lint/typecheck/unit 175/175 green.
Left: none.
Decisions: none.

## 2026-10-10 15:52 (UTC) — Cloud Agent — TP-0011 QA FAIL #3 PR #25
Did: Removed ci.yml structure test and scripts/ci-structure.mjs (B5 bypasses; 396/400, follow-up packet). Kept ci.yml (both jobs, PR/push, concurrency, timeouts, SHA pins, migrate/seed log) and the full secret scanner + planted-format tests.
State: lint/typecheck/unit 168/168 green.
Left: structure guard in a follow-up (actionlint + exact-key allowlist).
Decisions: none.

## 2026-10-10 20:50 (UTC) — Cloud Agent — packet TP-0012 / user-visible product name
Did: User-visible product name is now FAS Grants; org name Family Advocacy Services on login, document title, PageLayout header/footer, and product-facing docs (PRD, deck, progress checklist). Unit + e2e assert login/title show FAS Grants and rendered pages have no CasePilot.
State: lint/typecheck/unit 172/172 green; e2e 7/7 green.
Left: none.
Decisions: none.

## 2026-10-10 21:16 (UTC) — Cloud Agent — packet TP-0012 / user-visible product name
Did: Corrected product name from FAS Grants to FAS Evidence in branding, UI, product-facing docs, and tests. Login/title assert FAS Evidence; rendered pages must not contain FAS Grants or CasePilot.
State: lint/typecheck/unit 172/172 green; e2e 7/7 green.
Left: none.
Decisions: none.

## 2026-10-10 22:25 (UTC) — Cloud Agent — DS-01a design review
Did: Removed inline `--primary` style; base-layer input/button border+radius; `--input` 0.60/0.55; `--breakpoint-*: initial`. Kept `page.module.css`.
State: lint/typecheck/unit 175/175; build green; e2e 9/9.
Left: none.
Decisions: none.

## 2026-10-10 23:30 (UTC) — Cloud Agent — DS-01b shadcn + design review
Did: shadcn@4.21.4; `@/lib/utils` cn (no `cn@0.4.0`); focus `var(--ring)` 2px; `--border`; tap-min <1024; `/ui` gallery with disabled/error/icons.
State: HW = git diff --numstat origin/main minus pnpm-lock.yaml.
Left: none.
