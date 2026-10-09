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

## 2026-10-09 04:50 (UTC) — Cloud Agent — packet TP-0005 / F-102 (part 1 of 3)
Did: 7 tables + app_role()/app_org_id() + deny-by-default RLS; seed org_id + second org/user; table-driven tests/db/rls.test.ts + catalog guard; pnpm test:db.
State: lint/typecheck/unit/e2e/test:db green vs local Supabase.
Evidence: this PR (TP-0005, issue #14).
Left: F-102 parts 2–3 (remaining tables). QA owns status.
Decisions: None. Public tables: signed-in SELECT only. org: SELECT own (admin/staff/board_viewer); UPDATE own by admin; no INSERT/DELETE.

## 2026-10-09 05:50 (UTC) — Cloud Agent — packet TP-0005 / F-102 QA FAIL fix
Did: org-norole seed user; user_metadata escalation test; guard probe via SUPABASE_DB_URL; REVOKE EXECUTE FROM anon; test:db loads `supabase status -o env` (no keys in repo).
State: lint/typecheck/unit/e2e/test:db green vs local Supabase.
Evidence: PR #15.
Left: QA re-check at new head.
Decisions: None. Public tables: signed-in SELECT only. org: SELECT own (admin/staff/board_viewer); UPDATE own by admin; no INSERT/DELETE.

## 2026-10-09 06:20 (UTC) — Cloud Agent — packet TP-0005 / F-102 QA FAIL #2
Did: same-org staff role-only escalation test + rpc app_role/app_org_id; reset user_metadata; partitioned guard probe; refuse psql unless URL hosts are loopback.
State: lint/typecheck/unit/e2e/test:db green vs local Supabase.
Evidence: PR #15.
Left: QA re-check at new head.
Decisions: None.
