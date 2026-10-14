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
Did: shadcn@4.21.4; pin `cn@0.4.0`; card/separator untouched generator; focus `var(--ring)` 2px; `--border`; tap-min <1024; gallery disabled/error/icons.
State: HW = git diff --numstat origin/main minus pnpm-lock.yaml, card.tsx, separator.tsx.
Left: none.

## 2026-10-10 23:40 (UTC) — Cloud Agent — DS-01b B4
Did: Native buttons keep tap-min at every width; only `[data-slot=button]` drops it at lg. e2e Sign In/Out ≥44 at 1280.
State: recount vs main minus lockfile, card, separator.
Left: none.

## 2026-10-11 02:48 (UTC) — Cloud Agent — packet DS-01c
Did: Layout + trust primitives; gallery; moved body side padding to `[data-slot=page]` (16px mobile / 24 tablet / 32 desktop). Unit: SuppressedCell never a count, FreshnessChip always text, SourceFooter `asOf` required.
State: lint/typecheck/unit 180/180; e2e 11/11; screenshots 375/1024/1440.
Left: none.
Decisions: none.

## 2026-10-11 03:35 (UTC) — Cloud Agent — DS-01c design review
Did: Scoped card padding to `[data-pad]`; ErrorState Retry only with onRetry/href; FreshnessChip glyph `aria-hidden`; scroll hint only on overflow; EmptyState `headingLevel` default h2; PageHeader actions full-width below 768 only.
Left: none.

## 2026-10-11 03:55 (UTC) — Cloud Agent — DS-01c design+QA
Did: ErrorState on destructive Alert + icon; Page only on `/ui`; restored body pad and login/403/PageLayout from main; box e2e vs main at 375/1280. Extras: left `th`, NotPublished reason, SuppressedCell single announce.
Left: none.

## 2026-10-11 04:10 (UTC) — Cloud Agent — DS-01c double gutter
Did: `body:has(> [data-slot=page]) { padding-inline: 0 }` so `/ui` gutters are 16/24/32. Legacy routes unchanged. Gallery e2e asserts h1 left 16/24/32/152 at 375/800/1024/1440.
Left: none.

## 2026-10-12 14:17 (UTC) — Cloud Agent — PR #42 checklist update
Did: docs/PROGRESS_CHECKLIST.md refresh for 2026-10-12 (merged at 0bf09dd).
Left: none.

## 2026-10-12 14:29 (UTC) — Cloud Agent — design sources PR #43, PR #44, PR #45, PR #46
Did: screen plan part 1 §0–3 (PR #43, 4913fba), part 2 §4–7 (PR #44, a6a043b), mockups + HTML sources (PR #45, 976dcc1), mockup generator gen.py (PR #46, 96c712b). Unblocks DS-02 source gating.
Left: none.

## 2026-10-12 14:30 (UTC) — Cloud Agent — PR #47 Nightly Audit backup trigger
Did: CI backup trigger that runs the Nightly Audit when the schedule is missed (merged at 04684db).
Left: none.

## 2026-10-12 14:45 (UTC) — Cloud Agent — PR #48 docs follow-ups
Did: DESIGN_WORKFLOW names both screen-plan files; progress entries for PR #42–#47; checklist sources 2–4 and #47 (merged at 9aae887).
Left: none.

## 2026-10-12 16:07 (UTC) — Cloud Agent — PR #41 DS-02a signed-in app shell
Did: route move to app/(app), role nav per screen-plan §1.2, desktop sidebar/rail, top bar with wordmark below 768px (squash-merged at 4176aae). Split per QA: mobile sheet is PR #50 (DS-02b, in review); deferred e2e and hidden nav items are issue #49.
Left: PR #50, issue #49.

## 2026-10-12 16:26 (UTC) — Cloud Agent — PR #51 checklist DS-02a
Did: checklist DS-02a done, DS-02b in review, F-601 note made truthful; progress entries for PR #41 and PR #48 (merged at 1f06fb3).
Left: none.

## 2026-10-12 16:40 (UTC) — Cloud Agent — PR #50 DS-02b mobile top bar and nav sheet
Did: menu button, nav sheet with sheet-header wordmark (untouched shadcn sheet.tsx; the top-bar wordmark came in PR #41), 20px hamburger, 12px mobile top-bar padding, 375 e2e (open by button; close by Esc, scrim and Close with focus return; 44px targets; axe) (squash-merged at 515e046).
Left: issue #49 (focus trap, scroll lock, reduced motion e2e, hidden nav items); issue #52 (audit fixture leak).

## 2026-10-12 16:51 (UTC) — Cloud Agent — PR #54 DS-02 follow-ups
Did: 375 e2e for sheet focus trap, scroll lock and reduced motion; HIDDEN_LABELS (19 §1.2 names) asserted absent in unit and e2e; board crumb "Board dashboard" (squash-merged at 4f14df6, closes #49).
Left: scroll-lock e2e should assert actual scroll (#55).

## 2026-10-12 17:00 (UTC) — Cloud Agent — PR #53 checklist DS-02b
Did: checklist DS-02b done (PR #50), DS-02 follow-ups done (PR #54, closes #49), PR #51 and issue #52 noted, next up DS-03; progress entries for PR #50, PR #51 and PR #54 (merged at af9a3ee).
Left: none.

## 2026-10-12 17:56 (UTC) — Cloud Agent — PR #56 DS-03 login
Did: /login in the DS-01c Page with the split layout (one column below 1024), DS-02 wordmark, Show/Hide (aria-pressed), 48px fields and button on mobile, mapped errors with neutral copy and a focused role=alert, missing-config alert without env names, skeleton fallback, sample-card Example chip; e2e at 375/1024/1440 plus layout parity (squash-merged at 7ee6ca0).
Left: issues #57 (forgot password), #58 (DS-03 follow-ups), #59 (role home after sign-in), #60 (signed-in user on /login).

## 2026-10-12 18:35 (UTC) — Cloud Agent — PR #62 DS-04a role redirect, real 403, session expired
Did: `/` redirects each role to its home; middleware rewrites denied routes to `/403?from=…` with a real 403 status and cookies kept; expired sessions return to `/login?redirect=…&reason=expired` with an info alert; dev health UI moved to `app/(dev)/health` behind the dev gate; `roleHome` and `hadSession` with unit tests; role-redirect e2e (squash-merged at 21c693b, fixes #59).
Left: DS-04b pages in PR #64; prefix guards in #63.

## 2026-10-12 19:15 (UTC) — Cloud Agent — PR #64 DS-04b 403, 404 and error pages
Did: shared status card, signed-out 56px wordmark bar, 403 in the shell with an "Account not set up" variant and plain-text guidance "Ask your FAS admin to change your role.", not-found/error/global-error pages (reference only, no stack or env names), dev-only /dev-error route, global body padding removed, layout parity for /403 and signed-out screens, status-pages e2e at 375/1024/1440 with axe; DS-04 spec records the a/b split and deviations (squash-merged at b69df8b).
Left: #63, #65, #66, #67; next #60.

## 2026-10-12 20:00 (UTC) — Cloud Agent — PR #61 checklist DS-03 (merged at 7506eb5)
Did: checklist DS-03 login done (PR #56 at 7ee6ca0), next up DS-04, follow-up issues #57–#60 listed; progress entry for PR #56.
Left: none.

## 2026-10-12 20:00 (UTC) — Cloud Agent — PR #70 copilot-setup-steps workflow
Did: `.github/workflows/copilot-setup-steps.yml` for the Copilot cloud agent (Node 22, pnpm, frozen install, Playwright Chromium; read-only permissions, no secrets; does not touch ci) (squash-merged at 881f7ae).
Left: none.

## 2026-10-12 20:00 (UTC) — Cloud Agent — PR #71 signed-in user on /login
Did: middleware redirects a signed-in user on /login to a safe ?redirect= or the role home; no role goes to /403 "Account not set up"; `signedInLoginTarget` unit tests; e2e at 375 and 1440 (squash-merged at d4e1541, fixes #60).
Left: none.

## 2026-10-12 20:00 (UTC) — Cloud Agent — PR #68 checklist DS-04
Did: checklist DS-04 done (#62 at 21c693b, #64 at b69df8b), #59 closed, open follow-ups #63, #65, #66, #67, next up #60; progress entry for PR #64 (PR #68 merged at 7291b82).
Left: none.

## 2026-10-12 20:01 (UTC) — Cloud Agent — PR #72 CI concurrency and docs-only fast path
Did: one CI run per PR (a new push cancels the older run; main pushes not cancelled); docs-only PRs skip Supabase, `test:db`, Playwright install and `test:e2e` (merged at 1f1e7ab).
Left: the fast path matches all of `docs/`, so non-Markdown files there also skip DB and E2E; restrict it to `.md`.

## 2026-10-12 20:07 (UTC) — Cloud Agent — PR #69 Copilot routing
Did: `.github/copilot-instructions.md`, `harness/COPILOT_ROUTING.md`, task packet George-gated list with real FAS data and escalation path, UI PR evidence gates, focus ring per DS-01b, AGENTS.md renamed to FAS Evidence, concurrency one Cursor cloud agent plus one Copilot agent (merged at 637d40f).
Left: D-009 budget caps and the open money questions for George.

## 2026-10-12 20:14 (UTC) — Cloud Agent — PR #75 checklist #68, #72, #69
Did: checklist and progress entries for #68, #72 and #69 with API merge times; concurrency sentence in DESIGN_WORKFLOW step 2 (PR #75 merged at 4a27989).
Left: none.

## 2026-10-12 21:13 (UTC) — Cloud Agent — PR #76 prefix route guards
Did: `/admin`, `/staff` and `/board` guarded by prefix on a canonical path (decoded, lowercased, slashes collapsed, dot segments resolved); unknown paths reach 404; backslash and `//` tricks return 400; no-role users get a real 403 outside `/403`, `/login` and sign-out; unit and e2e route-guard tests (PR #76 merged at 3125135, closes #63).
Left: #78 (breadcrumb on encoded URLs), #79 (guard-list check); next #66 cookie flags.

## 2026-10-12 21:30 (UTC) — Cloud Agent — #79 route guard coverage test
Did: `lib/auth/route-guard-coverage.test.ts` walks `app/` for page.* and route.* (.tsx/.ts/.jsx/.js, or next.config `pageExtensions` if set; QA fix) (route groups stripped, `_private` skipped) and fails if any route is not `/`, under a guarded prefix or in `isPublicRoute`; dynamic segments outside a guarded prefix fail; `/reports` asserted to fail. Runs in `pnpm test` inside the required `ci` job.
Left: QA.

## 2026-10-12 21:22 (UTC) — Engineer Supivisor Bot — PR #80 checklist #76
Did: checklist and progress for #76 (#63 closed), next up #66 cookie flags; added the missing progress entry for PR #75 (PR #80 squash-merged at a0d9c7b, 2026-10-12 21:22:35 UTC).
Left: none.

## 2026-10-12 21:41 (UTC) — Engineer Bot — PR #81 route guard coverage test
Did: QA passed; route guard coverage test squash-merged at 438f7c0 (2026-10-12 21:41:17 UTC), closes #79.
Left: none.

## 2026-10-12 21:52 (UTC) — Cloud Agent — PR #82 auth cookie flags
Did: Supabase auth cookies set HttpOnly, Secure and SameSite=lax; logout clears them. QA PASS and DESIGN APPROVED at 0729e7e; squash-merged at 3ba8f7f (2026-10-12 21:52:03 UTC), closes #66.
Left: #84 (login CSRF and cookie Max-Age), #85 (sign-in unavailable message), #87 (403 breadcrumb).

## 2026-10-12 21:50 (UTC) — Cloud Agent — issue #83 / feature F-202
Did: packages/ingest/sahie + inactive n8n (PR #86). QA FAIL 80d2b6c.
Left: QA.

## 2026-10-12 22:40 (UTC) — Cloud Agent — F-202 QA fix on #86
Did: reject bad cells; fail closed on partial set; census-sahie migration; n8n pending #89; merge origin/main (#82).
Left: QA re-check.

## 2026-10-12 22:00 (UTC) — Engineer Supivisor Bot — PR #88 checklist #81 and #82 (squash-merged at b4ed683, 2026-10-12 22:02:49 UTC)
Did: checklist and progress for #81 and #82 (#66 done); #61 entry sha moved to its heading; next F-201, F-202 (#83) in progress by Engineer Bot; #77 Copilot pilot blocked on #65.
Left: none.

## 2026-10-12 22:05 (UTC) — Cloud Agent — #65 error page shell layout
Did: signed-in `app/error.tsx` uses `ErrorFrame` → `ShellFrame` so the content area matches the role shell (80/696 at 800; sidebar from 1024; 1200 max). Signed-out stays on `SignedOutFrame`. Brought PR #77's signed-in 404/error/`/` layout-parity assertion.
Left: CI + secret-scan, then ready.

## 2026-10-12 22:40 (UTC) — Cloud Agent — #65 error frame review fixes
Did: `loadErrorViewer` returns email; `ErrorFrame` passes `user.email ?? "Signed in"` like `AppShell`. Session reject or 4s timeout falls back to `SignedOutFrame` (`lib/status/error-frame.test.ts`). Did not touch the signed-out bar or `/403` copy (#91).
Left: CI + secret-scan.

## 2026-10-12 22:55 (UTC) — Cloud Agent — PR #90 signed-in error page in the role shell
Did: signed-in error page uses the role-shell content area, refs #65. QA PASS and DESIGN APPROVED at 2f0a13f; squash-merged at d1432ad (2026-10-12 22:55:30 UTC).
Left: #65 stays open, leftovers in #91 (now includes a loading-skeleton note); #77 should unblock once main is merged into it.

## 2026-10-12 23:16 (UTC, commit time) — Engineer Supivisor Bot — PR #93 checklist #88 and #90
Did: checklist and progress for #88 (b4ed683) and #90 (d1432ad); #65 open with leftovers in #91; #77 no longer blocked once main is merged in; F-202 in progress as #86 plus #92, both with QA.
Left: none.

## 2026-10-12 22:55 (UTC) — Cloud Agent — issue #89 / feature F-202
Did: SAHIE n8n entry: SahieHttp fetch→parse→fill→load, POST /api/ingest/sahie with fail-closed INGEST_TOKEN, inactive n8n HTTP to $env.FAS_INGEST_SAHIE_URL and no hardcoded year. Moved F-202 progress after #82.
State: lint/typecheck/unit 286/286 green. Live POST without token 401; unset secret still 401.
Evidence: PR #92.
Left: QA. #83 stays open until QA checks the whole flow.
Decisions: none.

## 2026-10-12 23:13 (UTC) — Cloud Agent — PR #92 QA FAIL
Did: spy `load` tests so SahieHttp.run never loads a 28-county or unparseable payload, and asserts source, checksum, and year; added PR #88 and PR #90 to their progress entries.
Left: QA re-check.

## 2026-10-12 23:29 (UTC) — Cloud Agent — PR #92 merge main (#93)
Did: Merged origin/main. Kept main's #88 and #90 entries; dropped the moved copies and (PR #88)/(PR #90) tags; F-202 stays after #82; named PR #93.
Left: QA re-check.

## 2026-10-12 23:50 (UTC) — QA — PR #97 flip F-202 passing
Did: F-202 set to passing in harness/feature_list.json with evidence: PR #86 QA PASS at 513d3b0 (squash-merged at 2d44deb, 2026-10-12 22:40:43 UTC) and PR #92 QA PASS at 6741f21 (squash-merged at 5f547d3, 2026-10-12 23:46:49 UTC). Live fas-dev ingest at 23:46:22 UTC loaded 58 rows (29 counties × 2 indicators, 2024); re-run at 23:46:31 UTC stayed at 58 with 0 duplicates. Checklist: 7 of 44 done. Closes #83.
Left: follow-up to log SahieHttp ingest errors server-side (no secrets).

## 2026-10-12 21:30 (UTC) — Copilot — PR #77 DS-04 follow-ups (#67)
Did: no-role breadcrumb "Account not set up" via `crumbFor` in `lib/shell/nav.ts` (roles with a home unchanged); `areaName` is case-insensitive and matches sub-paths; placeholder subtitles use `PageHeader` description; e2e for no-role 403 and area-name case in `status-pages.spec.ts`; layout-parity entries for signed-in 404, error and `/`, plus subtitle-left equals h1-left.
Also: crumb uses the canonical path (fixes #78).
Left: UI evidence (screenshots, axe, mockup comparison) needs a run with local Supabase.

## 2026-10-13 01:32 (UTC) — Cloud Agent — PR #102 docs DS-05 (F-209)
Did: Added `docs/design/specs/DS-05.md` (Data freshness panel / F-209), copied unchanged from design handoff. Docs only; no code or real data. Split from DS-05/06/07 batch (510 lines > 400).
Left: Engineer starts from merged or linked spec. DESIGN_WORKFLOW step 2 already matched the concurrency wording; no edit.

## 2026-10-13 01:55 (UTC) — Cloud Agent — PR #105 / feature F-203
Did: claim F-203. `packages/ingest/saipe` (poverty_count, poverty_rate; fail closed on rejects, <29 counties, mixed vintages), `SaipeHttp` + token-gated POST /api/ingest/saipe with secret-free server-side error log (#96 pattern), inactive n8n/census-saipe.json ($env only), census-saipe source_registry migration.
State: lint/typecheck/unit 309/309 green; real SAIPE 2024 sanity check 58 rows, 29 counties.
Left: QA; test:db in CI.
Decisions: none.

## 2026-10-13 02:35 (UTC) — QA — PR #108 flip F-203 passing
Did: F-203 set to passing in harness/feature_list.json with evidence: PR #105 QA PASS at af26c70 (squash-merged at 6f65d72, 2026-10-13 02:31:48 UTC). Live fas-dev ingest at 02:31:07 UTC loaded 58 rows (29 counties × 2 indicators, 2024); re-run at 02:31:13 UTC stayed at 58 with 0 duplicates. Added "PR #102" to the DS-05 entry heading. Features passing: 8 of 44.
Left: none for F-203.

## 2026-10-13 01:32 (UTC) — Cloud Agent — PR #103 docs DS-06 (F-211)
Did: Added `docs/design/specs/DS-06.md` (County need map explorer / F-211), copied unchanged from design handoff. Docs only; no code or real data. Split from DS-05/06/07 batch (510 lines > 400).
Left: Engineer starts from merged or linked spec. DESIGN_WORKFLOW step 2 already matched the concurrency wording; no edit.

## 2026-10-13 01:32 (UTC) — Cloud Agent — PR #104 docs DS-07 (F-401)
Did: Added `docs/design/specs/DS-07.md` (Team dashboard / F-401), copied unchanged from design handoff. Docs only; no code or real data. Split from DS-05/06/07 batch (510 lines > 400).
Left: Engineer starts from merged or linked spec. DESIGN_WORKFLOW step 2 already matched the concurrency wording; no edit.

## 2026-10-12 23:46 (UTC) — Cloud Agent — PR #95 health probe from env URL
Did: `/api/health` probes `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` with the publishable `apikey`; falls back to local `127.0.0.1:54321` only when the URL is unset. Closes #12.
State: lint/typecheck/unit 286/286 green; local `/api/health` ok vs GoTrue.
Evidence: https://github.com/aimogga/fas-caspilot-data/pull/95
Left: CI + secret-scan, then QA.
Decisions: none.

## 2026-10-13 00:21 (UTC) — Cloud Agent — PR #95 QA FAIL health status
Did: `SupabaseHealthProbe.responds` now returns `response.ok` (2xx only). Injected-fetch tests: reject → false, timeout → false, 503 → false, 200 → true.
State: lint/typecheck/unit 301/301 green.
Evidence: https://github.com/aimogga/fas-caspilot-data/pull/95
Left: CI + secret-scan, then QA re-check.
Decisions: none.

## 2026-10-13 03:30 (UTC) — Cloud Agent — PR #95 timeout-test mutation gap
Did: merged origin/main (progress.md conflict kept both sides). Timeout test mock now resolves 200 when no abort signal is passed, so removing `AbortSignal.timeout` fails it; a non-aborting signal makes it time out.
State: lint/typecheck/unit green.
Left: CI + secret-scan, preview, QA re-check.
Decisions: none.

## 2026-10-13 03:52 (UTC) — Cloud Agent — PR #115 docs reporting rule
Did: Created `harness/preferences.md` with standing Reporting rule (George, 2026-10-12): FAS bots report to Chief of staff on merges, completed features, blockers, and anything needing George; short note with what landed / PR / tests; never George directly; new packets inherit.
Left: QA review of docs PR.

## 2026-10-13 04:10 (UTC) — Grok Bot — PR #117: DECISIONS.md, George decisions of 2026-10-12
Did: recorded D-005, D-006 and D-009 as decided, plus design decisions D-017 to D-022 (29 counties, dashboard defaults, manual foundation grants, county outlines, stale rule, placeholder bins). Unblocks QA on #116.
Left: QA check. Need-score weights still open.

## 2026-10-13 02:43 (UTC) — Cloud Agent — PR #109 / feature F-204
Did: Census ACS 5-year ingest (packages/ingest/acs5, lib/ingest/acs-http.ts reusing SahieHttp helpers, POST /api/ingest/acs with Bearer INGEST_TOKEN and secret-free error log, public route entry, inactive n8n/census-acs.json with $env.FAS_INGEST_ACS_URL, migration 20261013024000_f204_census_acs_source.sql UUID f2040000-0000-4000-8000-00000000c204 commercial_ok=false per D-015). Variables: B01003_001E (total_population), B11001_001E (total_households), B21001_002E (veteran_population). Mirrors F-203 SAIPE pattern. Fixture tests all 29 counties with checksum guard. Year auto-computed: Nov+ uses current-1, else current-2.
State: lint/typecheck/unit 323/323 green.
Evidence: PR #109.
Left: QA mutation tests, test:db.
Decisions: none.

## 2026-10-13 04:06 (UTC) — UX/UI Design Bot — PR #116 George decisions 2026-10-12
Did: PR #116 applies George's 2026-10-12 decisions to DS-05 (stale rule approved), DS-06 (all 29 counties with FAS counties outlined + `FAS county` text, `Show FAS counties only` filter off by default via `?fas=1`, Census outlines approved, bins labelled `Placeholder bins`) and DS-07 (dashboard defaults approved; `Manual entry` tag for hand-entered foundation grants). Extra scope ruled in by Chief. Follow-up to merged #102/#103/#104. QA fixes: placeholder label on legend title, long bullets split, this entry.
Left: QA re-review; secret-scan run at new sha; #113 (DS-06a) and #114 (DS-07a) need updates to match; O1 outcomes card waits on F-305 (D-005 decided); real FAS data gated.
Decisions: none new (recorded in specs).

## 2026-10-13 04:45 (UTC) — Grok Bot — PR #118: census-sahie commercial_ok=false (Refs #107)
Did: follow-up migration 20261013050000 sets commercial_ok=false for census-sahie (D-015); merged migration 20261012223000 untouched; tests/db/sahie-load.test.ts asserts the flag. Merged main (latest: f6d85bd). PR body says Refs #107. Not applied to any database.
Left: QA re-check; apply to fas-dev after merge, then close #107.

## 2026-10-13 01:24 (UTC) — Grok Bot — PR #100: F-002 source cards
Did: 14 source cards in docs/research/ (sam_entity and ut_transparency are TODO stubs). Each card has 'Permitted for FAS grant use' and required notices; full sample calls (Census/SAM API calls in double quotes so keys expand); SAHIE bulk vs API names labelled; cross-refs name files. ut_courts data verified with a browser User-Agent (default curl UA gets 406, an access limit on the box); AOC confirmation requested 2026-10-12 8:39 AM MT, not for grant packets until confirmed. Merged main (latest: 258edb6).
Left: TODO stubs; ut_courts from another network; QA re-check.

## 2026-10-13 01:24 (UTC) — Grok Bot — PR #98: F-000 plugin inventory
Did: landed harness/PLUGIN_INVENTORY.md (Grok, Cursor local + Cloud, n8n; Use/Maybe/Avoid with reasons and an FAS-data column). Aligned with D-009 (cron labelled an implementation choice); added user-Supabase--casepilot and user-Refero rows; live read-only n8n inventory (2 workflows); GitHub Actions row lists real workflows; D-001/002/005/006/007/009 shown decided; proposals renamed P-1 to P-5; recounted by script (83 rows: Use 14 · Maybe 24 · Avoid 45). Merged main (latest: 258edb6).
Left: QA re-check; George sign-off.

## 2026-10-13 01:24 (UTC) — Grok Bot — PR #99: F-001 decision memos
Did: added harness/DECISION_MEMOS.md (options, recommendation, cost, risk for D-001 to D-010). Every memo now matches main's DECISIONS.md: D-001 to D-004, D-007, D-008 and D-010 decided 2026-10-08; D-005, D-006 and D-009 decided 2026-10-12; old cost numbers labelled superseded proposals; cron labelled an implementation note; resale wording removed (D-015). Merged main (latest: 258edb6) and took main's DECISIONS.md.
Left: QA re-check; George sign-off.

## 2026-10-13 05:22 (UTC) — Grok Bot — PR #125: preview-report standing rule
Did: Added standing Reporting rule in harness/preferences.md from George (2026-10-12, 11:21 PM MT, via Chief of staff): whenever something user-visible merges and is ready to look at, report to George Chief of staff with a direct preview link (git-main or PR preview), the page path to open, and which test login to use.
Left: none for this docs change.

## 2026-10-13 03:30 (UTC) — Engineer Bot — PR #111 / feature F-201
Did: claim F-201. Reused source_registry/ingest_run; pre-load failures now write an error ingest_run.
`IngestAlert` posts a redacted payload (with the failed ingest_run id) to INGEST_ALERT_WEBHOOK_URL
on a failed POST /api/ingest/sahie, and never throws. Inactive n8n/ingest-failure-alert.json.
Tests: idempotency, simulated failure alert, lowercase "bearer" rejected, pinned SAHIE checksum.
State: lint/typecheck/unit green; synthetic data only.
Left: QA; live fas-dev evidence needs fas-dev Supabase credentials and INGEST_ALERT_WEBHOOK_URL (not in repo secrets).
Decisions: none.

## 2026-10-13 03:45 (UTC) — Cloud Agent — PR #114 claim F-401 (DS-07a PR 1)
Did: claim F-401. `/dashboard` route guarded to admin and staff (board 403 via middleware). Page header plus M1, M2, M3, M5, M4 table, M6 and O1 cards, each showing `Not available yet` with no value or footer. M4 is an accessible table (caption, `th scope`, numbers right-aligned, fixed layout for 375). Synthetic only: no data wired.
State: lint/typecheck/unit green; each guard mutation-checked.
Left: nav unhide and crumb (lib/shell/nav.ts, held for #77), filters, freshness and pipeline widgets, e2e and layout-parity, then DS-07b/c.
Decisions: none.

## 2026-10-13 05:46 (UTC) — Cloud Agent — PR #110 / feature F-204 tests
Did: merged origin/main (01a6a56) after #109 squash; added acs-http test that a failed primary ACS year plus loaded fallback tags every row with the fallback vintage and period (mutation-checked: deleting `year = fallback;` in AcsHttp.run fails it). Earlier #110 commits: acs-http tests, docs/DATA_SOURCES.md, tests/db/acs-load.test.ts.
State: unit tests green on Node 22.
Evidence: PR #110.
Left: CI + secret-scan, preview, QA.
Decisions: none.

## 2026-10-13 06:10 (UTC) — Grok Bot (QA) — PR #126 (qa/flip-f204): flip F-204
Did: flipped F-204 to passing in harness/feature_list.json with evidence (QA PASS on PR #110 at 98ff670, merged a54e1de; part 1 PR #109 merged abc93bb). All three acceptance criteria and both tests proven.
Left: none.

## 2026-10-13 03:55 (UTC) — Cloud Agent — PR #113 / feature F-211 (DS-06a, PR 1 of 3)
Did: claim F-211. `/need-map` (all roles) table: 29 counties by rank, score, bin, latest-vintage indicators, status; `Not available yet` / `Not published`; source footer; empty and error states.
Fixes (UX + QA on 08350b0): scroll region with sticky County, right-aligned numbers, display names and units, per-column source + vintage + as-of, placeholder bins, ErrorState body.
Left: seed + seeded e2e in stacked #119 (D-012); nav and crumb (#77's nav.ts), layout-parity, DS-06b map, DS-06c tiles.
Decisions: none.

## 2026-10-13 04:40 (UTC) — Cloud Agent — PR #119 / feature F-211 (DS-06a part 2, after #113)
Did: local/CI-only synthetic seed: approved `v2-synthetic`, newer unapproved `v3-draft`, 26 scored counties with a tie (Cache = Davis), 3 not published (Daggett, Piute, Wayne).
State: e2e asserts rank order, the tie, bins, Not published last and the footer version. Nothing written to hosted fas-dev by this PR.
Left: QA at head.

## 2026-10-13 10:17 (UTC) — Grok Bot (nightly cleanup) — PR #128: docs/harness drift sync
Did: docs-only sync to main. PROGRESS_CHECKLIST marks F-203/F-204 Done (passing in feature_list.json; 9 of 44). PLAN, COPILOT_ROUTING, NIGHTLY_AUDIT and grok/roles/nightly_audit.md now match D-009 ($60 plan, $0 on-demand, no parallel-agent cap, Actions cron, no Automations). NIGHTLY_AUDIT cron matches nightly-audit.yml (`23 9 * * *` UTC). AGENTS.md layout lists real app/(app) routes and notes lib/metrics, lib/grants and supabase/functions are not in the repo yet. 10-privacy.mdc no longer cites the missing lib/metrics/suppression.ts (lands with F-306).
State: no code, workflow, package.json or feature status changes.
Left: QA.
Decisions: none.

## 2026-10-13 10:14 (UTC) — Grok Bot — nightly: kill orphan PageLayout (PR #127)
Did: Deleted unused `components/PageLayout.tsx` (zero importers; only path strings in tests). Dropped PageLayout paths from `lib/branding.test.ts` and `lib/ds-01c.test.ts`. Removed unused `export type { ErrorViewer }` re-export from `components/status/error-viewer.ts` (ErrorFrame imports the type from lib).
State: no local checkout; CI must run smoke (`pnpm lint && pnpm typecheck && pnpm test`).
Evidence: PR nightly/kill-pagelayout.
Left: QA review.
Decisions: none.

## 2026-10-13 10:20 (UTC) — Grok Bot — nightly: share census ingest helpers (PR #129)
Did: Extended `packages/ingest/census-table.ts` with shared checksum, Utah FIPS set, `CENSUS_NOT_PUBLISHED`, `num` (ACS keeps `-` via extraNulls), `fetchJson`, and `requireCountyCoverage`. ACS/SAHIE/SAIPE call those; deleted dead ACS mixed-vintages check in `requireComplete` (parse always sets `period: ''`) and its hand-built test case. FIPS left source-local (SAIPE drop non-Utah vs SAHIE/ACS 49xxxx). Did not touch `lib/ingest/*-http.ts`, ingest-alert, #106, or `feature_list.json`.
Left: QA on PR; later naming cleanup for acs5 folder (#106 conflict).

## 2026-10-13 10:20 (UTC) — Grok Bot (nightly audit) — nightly cleanup: ingest HTTP parity (PR #130)
Did: ACS and SAIPE ingest failures now record an error `ingest_run` (`recordFailure`) and fire `IngestAlert.notify`, same as SAHIE. One shared skeleton in `SahieHttp` (`ingest` + `respond`) used by all three routes; deleted the duplicate `logFailure` redactors (logs now redact via `IngestAlert`); dropped unused `AcsRunOpts`, `SaipeRunOpts`, `SahieLoad`. ACS year fallback unchanged.
State: scoped vitest (lib/ingest + packages/ingest, 64 tests) green on Node 22, scoped tsc and eslint clean in a scratch tree built from API-fetched files. Full CI must still run.
Left: CI + QA.
Decisions: none.

## 2026-10-13 13:48 (UTC) — Grok Bot — PR #131: F-000/F-001 sign-off cleanup
Did: George approved F-000 (PR #98, merged as feaa7d2) and F-001 (PR #99, merged as 9aad6c0) on 2026-10-12 at 11:20 PM MT, relayed by Chief of staff. Flipped both to passing in harness/feature_list.json (AC met; human_gate none; evidence links). Marked both Done in docs/PROGRESS_CHECKLIST.md (11 of 44). No open issues or george-before-merge labels remained on those PRs.
Left: QA.

## 2026-10-13 05:20 (UTC) — Grok Bot — PR #123 / feature F-201 follow-up
Did: GitHub-issue fallback in IngestAlert when the n8n webhook throws, returns non-2xx, or is Cloudflare-challenged; warns with the HTTP status on failure. Env INGEST_ALERT_GITHUB_TOKEN/REPO in .env.example.
State: lint/typecheck/unit green (Node 22); live preview test opened #124 for run 12d2feb7 (closed).
Left: QA re-review; retarget to main after #111 merges. #122 (Cloudflare rule) is still the root-cause fix.
Decisions: none.

## 2026-10-13 03:20 (UTC) — Engineer Bot — PR #112 / feature F-601 nightly audit data checks
Did: claim F-601. `pnpm audit:nightly` script.
Data freshness: active sources within cadence, failures in last 24h, RED on 2 nights in a row.
Data sanity: 29 counties, ±20% rows vs previous vintage, null spike; via Supabase REST.
SKIPPED without SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY; report "Data freshness" line filled.
State: lint/typecheck/unit green; synthetic fixtures only.
Left: QA; nightly-audit.yml reads fas-dev SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY repo secrets (D-016); grants, suppression/RLS/views, deploy health and cost stay SKIPPED until their keys or schema exist.
Decisions: none.
Update: grants (key-usage via grants source ingest_run, 14d pursuing deadlines), RLS+view guard via rpc/rls_guard_violations, main CI via GITHUB_TOKEN now real; suppression/no-cell<11 (no views yet), deploy health (VERCEL_TOKEN), cost (Cursor/LLM usage keys) still SKIPPED.

## 2026-10-13 15:27 (UTC) — Cloud Agent — PR #132 docs DS-08 (F-210)
Did: Added `docs/design/specs/DS-08.md` (Need score methodology / F-210), copied unchanged from design handoff. Docs only; no code or real data.
Left: Engineer starts DS-08a from merged or linked spec; fix drift in-budget (nav.ts HIDDEN_LABELS, CRUMB /need-map + /methodology, ErrorState Try again).

## 2026-10-13 15:45 (UTC) — Grok Bot — PR #133 / feature F-601 deploy health (check 5)
Did: `checkDeploys` in `scripts/nightly-audit.mjs`: latest production and preview Vercel deployments must be READY (ERROR → RED, other/none → YELLOW, HTTP error → YELLOW "could not query", no token → SKIPPED); folds into buildHealth/overall. `nightly-audit.yml` passes `secrets.VERCEL_TOKEN/VERCEL_PROJECT_ID/VERCEL_TEAM_ID`.
State: lint/typecheck/tests green on Node 22; 8 mutations killed; synthetic fixtures only.
Left: suppression / no-cell-<11 (no views yet) and cost (needs Cursor/LLM usage keys) remain todo/SKIPPED.
Decisions: none.
Update: ignore CANCELED deployments (latest non-canceled per target, limit 20); mutation killed.
Update 2: raw Vercel data showed all 24 production deploys CANCELED (none ever READY; project live=false), same rows for the audit's params; query now uses state=READY,ERROR, so production reports 'none found' (YELLOW) until a production deploy succeeds.
Update 3: test pins empty-production → 'none found' (YELLOW) with preview READY and no 'could not query'; none-found mutation killed.

## 2026-10-13 16:25 (UTC) — Grok Bot — PR #134: D-023 production on fas-dev Supabase
Did: George approved (2026-10-13 10:15 AM MT, via Chief of staff) pointing production at the synthetic fas-dev Supabase (zlizvzpatfyhdydfmxef). Added Production target to NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY in Vercel; redeployed main to production (dpl_CvktaAt4NoDuEY4ELk1ohFtDtPwH, READY). Recorded D-023.
State: /api/health ok:true (app ok, supabase ok); /login 200; QA verified staff/admin/board@example.test sign in on production (fas-dev).
Left: QA.
Decisions: D-023.

## 2026-10-13 17:06 (UTC) — Grok Bot — PR #137: n8n ingest alert shared-secret header
Did: Generated a 32-byte secret (never printed) and stored it as repo secret INGEST_ALERT_SECRET and Vercel sensitive env INGEST_ALERT_SECRET (Preview + Production). In n8n created Header Auth credential XYit0wFy8TngKt2F (header X-FAS-Alert-Secret) and set workflow HAlHEECkaQGTQ9sX (ingest-failure-alert, active) Webhook node to headerAuth. IngestAlert.notify now sends X-FAS-Alert-Secret from INGEST_ALERT_SECRET, omitted when unset; repo workflow JSON synced.
State: ingest-alert tests 16/16, tsc and eslint clean. Unauthenticated probe POST got HTTP 403 "Authorization data is wrong!" from n8n (no cf-mitigated challenge).
Left: QA; merge before relying on n8n delivery (until merged, deployed code posts without the header and falls back to the GitHub issue).
Decisions: none (implements D-024 context).
Update: QA fix — test secret is now the scanner-allowed placeholder 'not-a-secret' (secret-scan clean); added a no-leak test (console logs, GitHub fallback headers, issue body); 4 leak mutations killed; 17/17 tests.

## 2026-10-13 17:05 (UTC) — Grok Bot — PR #136: George 10-13 approvals; F-201 interim alert AC
Did: Recorded George's 11:03 AM MT 2026-10-13 approvals verbatim (via Chief of staff) as D-024 (GitHub-issue alert interim exception), D-025 (weights stored as fractions, shown as points), D-026 (weights v1 50/50 then v2 30/20/30/10/10), D-027 (George applies Cloudflare fix). Updated F-201 acceptance criteria (n8n primary, GitHub-issue fallback, webhook secret rejection, nightly audit YELLOW). #122 resolved 2026-10-13 (Bot Fight Mode off).
State: F-201 status stays failing; human_gate unchanged; status_note removed from feature_list (context kept here).
Left: QA.
Decisions: D-024, D-025, D-026, D-027.

## 2026-10-14 03:53 (UTC) — Cloud Agent — PR #174 / feature F-503 eligibility rules
Did: `lib/grants/` pure rules layer for Phase 5. `types.ts` (DB-shaped `OpportunityInput` from the `opportunity` row, `OrgProfile` with `unknown` on every field, `Flag`, `EligibilityResult`), `eligibility.ts` (one function per GRANT_MATCHING.md check: applicant_type, geography, close_date, sam_registration, audit_required, cost_share, min_years_operating, award_size, theme_overlap, loi_required; `checkEligibility` composes them, flags sorted by severity then code; `FLAG_CODES`; `toMatchFlags`/`fromMatchFlags` for `match_result.flags` jsonb), `profile.ts` (`FAS_PROFILE_SYNTHETIC`, `profileFromOrgRow`, `loadOrgProfile`). Checks the data cannot answer emit an `info` flag `Could not check <x>: <field> missing`, never a silent pass; `eligible` is false on any blocker, `'unknown'` when any check could not run. 8 synthetic fixtures in `tests/fixtures/grants/opportunities.json`; 13 tests. No UI, no schema, no F-501 paths touched.
State: lint, typecheck, 409 unit tests, `next build --webpack` green; D-012 ≈ 395 hand-written lines.
Left: F-504 fit score + "How we matched" panel consume `EligibilityResult.checks` (eligibility certainty) and `toMatchFlags`. `org` has only name/ein/uei/state/settings; profile facts (is_501c3, sam_status, service_counties, annual_budget_usd, populations_served, program_themes, has_audited_financials, years_operating) are read from `org.settings` jsonb until a future migration adds typed columns (listed for that packet). Real FAS profile values are George-gated. Geography is keyword-based (Utah mention or "located in <State>" restriction); a NOFO that lists eligible states in a table will read as national.
Decisions (for George): close-date warning window 21 days (doc's value, configurable); award floor above 50% of annual budget = too large (warning); award ceiling under $10,000 = too small (info); SAM.gov registration assumed required for every `grants_gov` opportunity; cost share and LOI are warnings, audit and minimum-years are blockers.

## 2026-10-14 04:22 (UTC) — Cloud Agent — PR #178 / feature F-504 fit score
Did: Fit score v0 + "How we matched" panel on top of F-503. Migration `20261014041000_f504_match_config.sql`: `match_config` (id, weights jsonb as fractions of 1 per D-025, params jsonb, approved_by/approved_at; RLS on, SELECT for authenticated, no app writes), seed row `v0-draft` (mission_fit 0.30, eligibility_certainty 0.20, evidence_readiness 0.15, award_size_fit 0.15, geography 0.10, effort_vs_time 0.10; `approved_by` NULL), `match_result.config_id` + unique (org_id, opportunity_id, config_id). `lib/grants/score.ts` (pure: one scorer per doc component, `points = round(weight × value × 100)`, weights validated to sum to 1, every component stores label/weight/value/points/max/reason/source_refs; any blocker caps the score at 0 and adds a `blocker_cap` reason component; `toMatchResultRow`). `lib/grants/match-query.ts` (`recompute`: newest approved config only, none → `{ scored: 0, reason: 'no approved config' }` and no writes; open opportunities = close_date null or ≥ today; upsert on org/opportunity/config. `list`: stored rows for the approved config joined to `opportunity`, open only, score desc). UI `/staff/grants/matches` (`app/(app)/staff/grants/matches/page.tsx`, `components/grants/MatchPanel.tsx`): header `WORKSPACE / Grant matches / Scored against the <id> rules · N open opportunities · as of Mon YYYY`, ResponsiveTable (Opportunity+funder, Closes, Score right-aligned tabular, Eligibility text, `How we matched` button with aria-expanded/aria-controls) and an inline panel that renders only the stored component strings and flags (severity as a word). States: no approved config → `Matching is not switched on yet`; no rows → `No open opportunities yet`; load failure → ErrorState. Nav `Grant matches` under Workspace + crumb. Seed: approved `v0-synthetic-test` + 2 synthetic opportunities + their stored `match_result` rows (local/CI only). Tests: `lib/grants/score.test.ts` (golden `tests/golden/match-scores.json` for all 8 fixtures, per-component invariants, reasons/source_refs, blocker cap, weight validation, row shape, no-approved-config → no writes), e2e `tests/e2e/match-explanation.spec.ts` (board 403, staff 200, order by score, panel text equals seed strings, axe at 375/1024, no horizontal scroll); nav/shell/layout-parity updated additively.
State: lint, typecheck, unit tests, `next build --webpack` green locally; D-012 399 hand-written lines. `test:db` and e2e run in CI only (no Docker here).
Left: `POST /api/grants/recompute` (n8n trigger) was cut to stay under the 400-line cap; add it with the n8n workflow packet (handler = `MatchQuery.recompute` per org behind `SahieHttp.tokenOk`, plus `isPublicRoute` entry). `evidence_readiness` reads `match_config.params.evidence_available` (empty in v0) until `lib/metrics` exists. `rls.test.ts` does not yet enumerate `match_config` (guard RPC covers RLS-on + policy). Approving a real config (set `approved_by`) is George-gated like need-score v1.
Decisions (for George): v0 weights stored as fractions 0.30/0.20/0.15/0.15/0.10/0.10 (doc points ÷ 100); any blocker (ineligible) caps the score at 0 and the panel shows a "Blocker · Score capped at 0: <message>" component; geography tiers Utah 1.0 / regional 0.75 / national 0.5; effort vs time = days to close ÷ `prep_days` (30) capped at 1; mission fit = matched themes ÷ `themes_for_full_credit` (3) capped at 1; evidence readiness scores 1 when the text asks for no outcomes/cost/timeliness evidence, else the share FAS has loaded; award-size "too small" info flag scores 0.5, warnings 0; copy: "Matching is not switched on yet / An admin approves the matching rules before scores appear."

## 2026-10-14 04:47 (UTC) — Cloud Agent — PR #183 / feature F-504c recompute route
Did: `POST /api/grants/recompute` (`app/api/grants/recompute/route.ts`, force-dynamic, POST only) backed by `lib/grants/recompute-http.ts`: bearer `INGEST_TOKEN` via `SahieHttp.tokenOk` (401 missing/wrong/unset), service-role client via `SahieHttp.db`, optional body `{ org_id }` (absent → every row in `org`), 200 `{ results: [{ org_id, scored, config_id, reason? }] }` from `MatchQuery.recompute` per org, 400 on malformed body, generic 500 with env values redacted in logs (`IngestAlert.payload`). `isPublicRoute` gains `/api/grants/recompute` on its own line. `n8n/grants-recompute-weekly.json`: inactive, Mondays 09:00 UTC, POST `$env.FAS_GRANTS_RECOMPUTE_URL` with `Bearer {{$env.INGEST_TOKEN}}`. `tests/db/rls.test.ts` enumerates `match_config` as a PUBLIC table (SELECT for admin/staff/board_viewer, no app writes, anon and no-role denied; probe row `v0-draft`) and in ARCH. Migration `20261014044500_f504c_match_config_role_policy.sql` recreates `match_config_sel` with `app_role() IN ('admin','staff','board_viewer')` so it reads like `need_score_config` (the F-504 policy was `USING (true)` for any authenticated user, which the matrix would have failed on the no-role actors). Tests: `lib/grants/recompute-http.test.ts` (8: 401 x4, 400 x5 bodies, no-approved-config with stubbed client and no `match_result` write, scored path, 500 with no token/key in logs, unconfigured db → 500, n8n JSON inactive/$env-only/weekly/no URL or literal token).
State: lint, typecheck, 423 unit tests, `next build --webpack` green (route listed); 229 hand-written lines after two follow-up commits (scanner-allowed test placeholders; four pre-existing rls.test.ts lines over 300 chars wrapped, whitespace only). `test:db` is CI-only (no Docker here) — the `match_config` matrix rows and the new migration are UNVERIFIED locally. No `ingest_run` row is written (recompute is not an ingest and has no `source_registry` row; provenance lives in `match_result.config_id` + `computed_at`).
Left: QA; set `FAS_GRANTS_RECOMPUTE_URL` and `INGEST_TOKEN` in n8n before activating the workflow (team, D-014). Approving a config (`approved_by`) stays George-gated. Stacking: merge after #178; sibling of #180/F-504b (shared lines: `isPublicRoute`, progress.md only).
Decisions (for George): `match_config` SELECT narrowed to app roles (new migration) rather than any authenticated user; weekly Monday 09:00 UTC cadence; recompute returns per-org results and never writes without an approved config.
Fix (05:10Z): migration renamed to `20261014045500_f504c_match_config_role_policy.sql`; the `20261014044500` stamp collided with F-504b's `20261014044500_f504b_match_config_v1.sql` on #182 and Supabase rejects duplicate versions once both land.
