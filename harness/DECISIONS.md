# Decisions Log

Format per decision: context → options → recommendation → cost/risk → **George's decision + date**. The Chief of Staff writes memos; George decides.

## Open

*(none)*

## Decided
*(move items here with George's decision and date)*

### D-001 Account and repo ownership
Options: (A) CasePilot-owned GitHub org, Vercel team and Supabase org under casepilot.io identities; (B) existing personal or ModernLine accounts.
Recommendation: **A.** CasePilot's Google Cloud already runs under a casepilot.io account; keep the product's code, hosting and data under CasePilot too, so it's clean to transfer, audit or sell later.
Decision: **A**, per recommendation. Decided by George in chat. · Date: 2026-10-08
Note (2026-10-10): selling the data or a paid product is ruled out by D-015.

### D-002 Scheduler for data pulls and alerts
Options: (A) n8n at n8n.casepilot.io triggers ingest functions in the repo and sends alerts/digests; (B) Supabase scheduled jobs + Edge Functions only; (C) GitHub Actions cron.
Recommendation: **A**, with all transformation logic in `packages/ingest/` (tested in CI). n8n is already running on CasePilot's Google Cloud and is good at schedules and notifications. New workflows are created inactive; existing live workflows aren't edited without George.
Decision: **A**, per recommendation, including the inactive-by-default and no-edits-to-live-workflows rules. Decided by George in chat. · Date: 2026-10-08

### D-003 In-app LLM provider for strategy drafts
Options: xAI (Grok) API, Anthropic, OpenAI, or others, behind `lib/llm/`.
Criteria: reliable structured (JSON) output, data-retention terms, cost, and BAA availability if anything sensitive could ever reach it (the design sends aggregates only).
Recommendation: pick one provider for v1 after a 5-opportunity bake-off scored by QA on citation accuracy; keep the adapter so it can change.
Decision: per recommendation: run the 5-opportunity bake-off scored by QA on citation accuracy, pick the v1 provider from its result, and keep the `lib/llm/` adapter. Decided by George in chat. · Date: 2026-10-08

### D-004 PDF and Word export method
Options: (A) print-optimized HTML route rendered to PDF with headless Chromium + a DOCX library; (B) a React PDF library; (C) a paid document API.
Recommendation: **A**: one design source for screen and print; no third party sees the data.
Decision: **A**, per recommendation. Decided by George in chat. · Date: 2026-10-08

### D-006 Hosting plans and compliance tier
Questions: Supabase and Vercel plan levels, region, backups, and whether BAAs are available/needed before real provider data (see PRIVACY_AND_COMPLIANCE.md).
Recommendation: free/low tiers for Phases 0–5 (synthetic data); upgrade before Phase 6 based on the legal opinion.
Decision (2026-10-08): per recommendation: free/low tiers for Phases 0–5 (synthetic data); upgrade before Phase 6 based on the legal opinion. Decided by George in chat. · Date: 2026-10-08
Update (2026-10-12): the **plan levels only** are superseded: **Supabase Pro (up to $60/mo) and George's current paid Vercel plan**. Decided by George Mogga; relayed by George Chief of staff at 10:01 PM MT. · Date: 2026-10-12
Still in force from 2026-10-08: the upgrade before Phase 6 based on the legal opinion.

### D-007 Cursor and MCP configuration
Questions: which MCP servers local vs. cloud agents may use; credentials scope.
Recommendation: Cursor's `mcp.json` currently points at the ModernLine n8n MCP server; for this repo, use the CasePilot n8n instance (dev workflows only). Enable Supabase MCP for dev/preview projects only, Vercel MCP read-mostly, Context7 for current library docs, Playwright MCP for QA. No MCP gets production credentials. See PLUGIN_INVENTORY.md.
Decision: per recommendation. Decided by George in chat. · Date: 2026-10-08

### D-008 Multi-organization design
Recommendation: `org_id` on every FAS table and RLS by org from day one; no billing or self-service signup in v1.
Decision: per recommendation. Decided by George in chat. · Date: 2026-10-08

### D-010 Foundation opportunity inputs
Questions: how foundation opportunities get in (manual entry, CSV export from the foundation research tools FAS already uses, or both) and whether those tools' terms allow importing their data.
Recommendation: manual + CSV in v1; check each tool's export terms before automating.
Decision: per recommendation: manual + CSV in v1; check each tool's export terms before automating. Decided by George in chat. · Date: 2026-10-08

### D-011 Lint and test stack
Context: PR #1 tried Biome + `node --test` to keep the lockfile under the diff cap; AGENTS.md specifies ESLint + Vitest. PR #3 shipped ESLint + Vitest (`eslint.config.mjs`, `vitest.config.mts`) and PR #1 was closed as superseded.
Decision: **ESLint for lint, Vitest for tests**, matching AGENTS.md. Smoke check stays `pnpm lint && pnpm typecheck && pnpm test`. Adopted with George's merge of PR #3 (84e8f09). · Date: 2026-10-08

### D-012 Diff cap: what counts toward max_diff_lines
Context: F-003 (PR #3, setup-flow Cloud Agent environment) came in at 624 changed lines excluding `pnpm-lock.yaml` and the generated `supabase/config.toml`, over the 400-line `max_diff_lines` in the packet template. George approved a one-time setup exception on 2026-10-08 and merged PR #3 (84e8f09).
Options: (A) count every changed line; (B) exclude lockfiles (`pnpm-lock.yaml`) and tool-generated files (e.g. `supabase/config.toml` from `supabase init`), but list them by name in the PR body; (C) keep counting everything and grant one-off exceptions case by case.
Cost/risk: low. The risk is a large hand-edit hidden in a "generated" file; QA checks that excluded files match their generator.
Decision: **B.** Lockfiles and tool-generated files don't count toward `max_diff_lines`; every PR lists the excluded files by name in its body, and QA checks they match their generator. Decided by George in chat. · Date: 2026-10-08
Clarification: the 400-line cap counts hand-written lines **added plus deleted**. Lockfiles and tool-generated files stay excluded and are still listed by name. George's words, answering QA's question "Should deleted lines count toward D-012's 400-line PR cap?": "Count added and deleted lines toward the 400-line cap, as QA has been doing." Decided by George in chat with QA at 9:28 PM MT. · Date: 2026-10-08

### D-013 Who merges
Decision: George no longer reviews or merges PRs. The Engineer Supervisor squash-merges a PR and deletes its branch once QA posts PASS on every acceptance criterion, with evidence, at the PR's current head sha; if the head moves after the PASS, QA re-checks first. `human_gate` is `none` for ordinary code and docs packets. After each merge or QA verdict, the Engineer Supervisor sends Chief of staff the test results plus 2–3 next-step options with a recommendation, and doesn't start the next packet until George's pick is relayed (unless it's already on the approved PLAN). Confirmed by George 2026-10-08. · Date: 2026-10-08

### D-014 Production approvals
Decision: Once QA PASSes at the current head sha and the preview works, the team may merge, deploy to production, apply production DB migrations, and create, edit and activate n8n workflows on n8n.casepilot.io without asking George. Only money or plan decisions go to George, through Chief of staff. Still gated on George (`human_gate: george`): real FAS data (Phase 6 legal gate; synthetic only until then), outbound emails, and acceptance-criteria changes. Note: Vercel project fas-caspilot-data currently skips production builds via an Ignored Build Step, which must be removed when production deploys start. Confirmed by George 2026-10-08. · Date: 2026-10-08
Supersedes: earlier gate lists that kept production deploys, production migrations and n8n workflow changes on George.

### D-015 Data use: FAS-only, grants only
Context: earlier planning notes described FAS Evidence as a product CasePilot could later offer or sell to other nonprofits, and asked Deep Research to clear sources for a future paid product.
Decision: Public and FAS data in FAS Evidence is used only (1) for FAS to measure and validate the problem it solves, and (2) to provide or attach that data in FAS's grant applications for government grants and through GrantAdvance. No resale, no paid product, no other use. Docs and copy that implied commercial or paid reuse are corrected to match. Decided by George Mogga; relayed by George Chief of staff (agent message to the Engineer Supervisor) on 2026-10-10 at 8:47 PM MT. · Date: 2026-10-10

### D-016 GitHub admin standing permission
Decision: The team (Engineer Supervisor, QA bot, Engineer Bot, UX/UI Design Bot) may do any GitHub admin needed on aimogga/fas-caspilot-data without asking George. That includes deleting merged branches, auto-delete of head branches, Actions secrets, repo settings and workflows. Admin actions use the shared GH_SECRETS_TOKEN (never printed or committed). Still gated on George: money or plan changes, real FAS data, emails in George's name, and acceptance-criteria changes. The QA gate and the main ruleset are unchanged. This does not permit weakening, disabling or bypassing the main ruleset, its required checks (ci, secret-scan), CI, the secret scan, the nightly audit or the staleness check. Any change to those, whether a ruleset edit, an Actions setting or a workflow file, goes through a PR with QA PASS at the head sha before merge. Decided by George Mogga; relayed by George Chief of staff (agent message to the Engineer Supervisor) on 2026-10-10 at 9:11 PM MT. · Date: 2026-10-10

### D-005 Outcome questionnaires
Options: OQ-45 (adults) + Y-OQ (youth), which Utah's public mental health scorecards use (licensing cost to confirm); or PHQ-9 + GAD-7, which are free but have no Utah comparison.
Decision: **PHQ-9 and GAD-7 now.**
- Built as a pluggable instrument registry, so OQ-45 and Y-OQ can be added later without schema rework.
- Store total scores only (per Chief of staff's 10:02 PM MT 2026-10-12 relay of George's 10:01 PM decision).
- The need-score weights stay open and are not decided here.

Decided by George Mogga; relayed by George Chief of staff at 10:01 PM MT. · Date: 2026-10-12

### D-009 Cost caps
Decision (locked; decided by George Mogga, relayed by George Chief of staff at 10:01 PM MT):
- Cursor: $60 plan with $0 on-demand.
- Supabase Pro, up to $60/mo.
- Vercel: George's current paid plan.
- Nightly Audit: under $2 per run.
- In-app LLM: $25/mo, starting in the grants phase (Phase 5).

From George's 7:55 PM MT relay: no cap on parallel agents; when usage runs out, work pauses and resumes after the reset.
Implementation note (not George's words): the Nightly Audit runs on a GitHub Actions cron.
· Date: 2026-10-12

### D-017 County coverage (design)
Decision: **The board shows all 29 Utah counties, with FAS's service counties highlighted.** Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-018 Dashboard defaults (design, DS-07)
Decision: **The dashboard defaults are approved:** the latest complete quarter, M1 as the lead metric, and a 60-day never-started window. George's words: "Yes, use those dashboard defaults and that stale rule." Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12
Note: the prior-quarter comparison in DS-07 is a designer default that George has not approved.

### D-019 Manual foundation grants (design, DS-07)
Decision: **Manual foundation grants are shown** on the dashboard, tagged as manual entry (consistent with D-010). Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-020 County outlines (design, DS-06)
Decision: **The county outlines are approved** (Census county outlines). Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-021 Stale rule (design, DS-05)
Decision: **Data counts as stale once it is one update cycle overdue.** George's words: "Yes, use those dashboard defaults and that stale rule." (same approval as D-018) Decided by George Mogga; relayed by George Chief of staff at 9:58 PM MT. · Date: 2026-10-12

### D-022 Need-map bins placeholder (design, DS-06)
Decision: **Keep the 5 equal-count bins as a placeholder** until George sets the need-score weights. The need-score weights stay open and are not decided here. In-scope ruling by George Chief of staff (not a George decision). · Date: 2026-10-12

### D-023 Production uses fas-dev Supabase (ops)
Decision: **Production (fas-caspilot-data.vercel.app, Vercel production branch main) uses the synthetic fas-dev Supabase (zlizvzpatfyhdydfmxef), with no real FAS data, until a real prod project exists.** Decided by George Mogga; relayed by George Chief of staff at 10:15 AM MT. · Date: 2026-10-13

### D-024 GitHub-issue alerts as interim F-201 exception (ops)
Decision: **Until #122 (Cloudflare challenge on the n8n webhook) is resolved, a GitHub issue labeled `ingest-alert` counts as the F-201 failure alert, as a time-limited exception.** George's words: "Approve 1: GitHub-issue alerts count for F-201 as a time-limited exception" Decided by George Mogga; relayed by George Chief of staff at 11:03 AM MT. · Date: 2026-10-13

### D-025 Need-score weight storage (data)
Decision: **Need-score weights are stored as fractions and shown as points.** George's words: "Approve 2: store weights as fractions, show them as points" Decided by George Mogga; relayed by George Chief of staff at 11:03 AM MT. · Date: 2026-10-13

### D-026 Need-score weights v1 → v2 (data)
Decision: **Start at v1 = SAIPE poverty 50, SAHIE uninsured 50; then v2 = SAIPE poverty 30, SAIPE child poverty 20, SAHIE uninsured 30, ACS single-parent households 10, ACS no-vehicle households 10.** George's words: "Approve 3: start at poverty 50 and uninsured 50, then the later weights as listed" Decided by George Mogga; relayed by George Chief of staff at 11:03 AM MT. · Date: 2026-10-13
Note: this supersedes the "weights stay open" part of D-022; the bins placeholder itself is not changed here.

### D-027 Cloudflare fix done by George (ops, #122)
Decision: **George applies the Cloudflare fix himself; the team sends him the steps.** George's words: "Approve 4: send me the Cloudflare fix steps and I'll do it" Decided by George Mogga; relayed by George Chief of staff at 11:03 AM MT. · Date: 2026-10-13

### D-028 Harness gate script and hook (process)
Decision: **Deterministic PR rules run as code, not instructions.** `pnpm gate` (`scripts/pr-gate.mjs`) runs lint, typecheck, unit tests, the secret scan over tracked and untracked files, the D-012 count (added + deleted vs `origin/main`; lockfiles, markdown, binaries and the files in `harness/generated-files.json` are excluded and named), the 300-char line check on changed code files, and the progress.md append-only check, and prints one `step | requirement | verdict | evidence` row per rule. `scripts/pr-gate-hook.mjs` with `.claude/settings.json` runs the gate before any `git push` from a Claude Code session and blocks the push when a row fails. Harness scripts and hooks: `scripts/nightly-audit.mjs` (nightly audit and the CI secret-scan), `scripts/audit-staleness.mjs`, `scripts/test-db.mjs`, `scripts/pr-gate.mjs`, `scripts/pr-gate-hook.mjs`, `.claude/settings.json`. From George's harness prompt (2026-10-13, layer 3); George approved the plan in chat. · Date: 2026-10-13

### D-029 Branch per packet, worktrees, no shared files (process)
Decision: **One branch and one PR per packet, built in its own git worktree from `origin/main`.** `git fetch && git merge origin/main` at the start of every step; never rebase or force-push; two packets never edit the same file in the same window. `harness/progress.md` and `docs/PROGRESS_CHECKLIST.md` are the only shared files: each packet appends its entry once, last, right before its PR opens; a merge conflict there is resolved append-only (both entries kept, the branch's own last). George approved one branch per packet on 2026-10-13 (supersedes the single-branch rule for harness runs). · Date: 2026-10-13

### D-030 Test fixture secrets (process)
Decision: **Any secret-shaped fixture value in a test is the literal `not-a-secret`** (on the scanner's `PLACEHOLDERS` list). The scanner reads git-tracked files only, so a local scan must include untracked files; `pnpm gate` does. Lesson: #137 and #141 each lost a CI round to a made-up token. · Date: 2026-10-13

### D-031 QA gates to pre-check (process)
Decision: **Before a PR opens:** no changed code line over 300 chars; the PR body has `Refs F-xxx` (or `Closes #n`) and names every excluded generated file; the branch is 0 behind `main`. `pnpm gate` enforces the first and prints the others as manual rows. Source: QA verdicts on #137 and #141. · Date: 2026-10-13

### D-032 Merge train for stacked PRs (process)
Decision: **Stacked PRs merge with merge commits, in dependency order, each once `ci` and `secret-scan` pass on its head.** A train branch is its predecessor's branch plus its own change (the predecessor is merged in, never rebased); a stacked PR targets its parent until the parent merges, then GitHub retargets it to `main` and deletes the merged branch. Merge commits, not squash, for train PRs (D-013 squash stays for single PRs): squashing a parent rewrites its history and turns every child into a conflict (lesson: #141 → #151). `ci.yml` runs on every `pull_request` whatever its base, because the retarget to `main` fires no new run. D-012 for a train PR is measured against its parent branch until the parent merges; a reviewer's count against `main` includes the predecessors' work and is not a finding. `harness/progress.md` merges with `merge=union`. Merge order and per-PR evidence live in the supervisor's `checks.md`. George: "actions is back on, start merging in stack order" (2026-10-14). · Date: 2026-10-14

### D-033 Board page reads through a server-only service-role client (privacy, #168)
Decision: **The board dashboard computes its suppressed aggregates server-side with the service-role key (`lib/supabase/service.ts`) and never with the viewer's session.** F-102 RLS gives `board_viewer` no access to FAS record tables, so a board page built on the viewer's client was empty. The service client exists only in server code (it throws in a browser), only `SUPABASE_SERVICE_ROLE_KEY` enables it, and the page still applies rule 4 suppression (n < 11, complementary) before anything reaches the browser. Raw rows never leave the server. Flagged to George as a privacy design decision; reverse by giving `board_viewer` SELECT policies on the F-304 metric views instead. · Date: 2026-10-14

### D-034 Lessons from the merge train (engineering)
Decision: **Three rules from the 39-PR train.** (1) API routes insert `audit_log` rows without RETURNING (`.insert(row)`, never `.insert(row).select()`): the table's SELECT policy is admin-only, so a staff insert with RETURNING is rejected by RLS and the route reports a failed audit entry after the record saved. (2) Client forms that tests drive expose `data-hydrated` (`lib/use-hydrated.ts`, a `useSyncExternalStore` hook) and the e2e waits for it before typing: controlled inputs drop anything set before React hydrates, and native submits fire before the handler exists. (3) `[data-slot=table-scroll]` is `position: relative` and becomes a focusable named region when it overflows: Tailwind's `sr-only` is `position: absolute`, so unpositioned scrollers let hidden cell text widen the page at 375 px, and axe requires keyboard access to a real scroller. e2e files that walk many routes or run axe set their own `test.setTimeout`; assertions on shared-database state (freshness rows, pipeline counts) match loosely because specs run in any order. · Date: 2026-10-14
