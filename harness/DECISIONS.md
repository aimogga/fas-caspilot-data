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
Decision (superseded 2026-10-12): per recommendation: free/low tiers for Phases 0–5 (synthetic data); upgrade before Phase 6 based on the legal opinion. Decided by George in chat. · Date: 2026-10-08
Decision (2026-10-12): **George's current paid Vercel plan plus Supabase Pro** (Supabase up to $60/mo, per D-009). Decided by George Mogga; relayed by George Chief of staff at 10:01 PM MT. · Date: 2026-10-12

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
Decision: **PHQ-9 and GAD-7 now**, built as a pluggable instrument registry so OQ-45 and Y-OQ can be added later without schema rework. Store total scores only. The need-score weights stay open and are not decided here. Decided by George Mogga; relayed by George Chief of staff at 10:01 PM MT. · Date: 2026-10-12

### D-009 Cost caps
Decision:
- Cursor: $60 plan with $0 on-demand. When usage runs out, work pauses and resumes after the reset.
- No cap on parallel agents.
- Supabase Pro, up to $60/mo.
- Vercel: George's current paid plan.
- Nightly Audit: under $2 per run, on a GitHub Actions cron.
- In-app LLM: $25/mo, starting in Phase 5.

Decided by George Mogga; relayed by George Chief of staff at 10:01 PM MT. · Date: 2026-10-12

### D-017 County coverage (design)
Decision: **FAS covers all 29 Utah counties.** The need map shows all 29 counties. Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-018 Dashboard defaults (design, DS-07)
Decision: **The dashboard defaults are approved:** the latest complete quarter, M1 as the lead metric, and a 60-day never-started window. George's words: "Yes, use those dashboard defaults and that stale rule." Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12
Note: the prior-quarter comparison in DS-07 is a designer default that George has not approved.

### D-019 Manual foundation grants (design, DS-07)
Decision: **Manual foundation grants are shown** on the dashboard, tagged as manual entry (consistent with D-010). Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-020 County outlines (design, DS-06)
Decision: **The county outlines are approved** (Census county outlines; FAS service counties outlined on the need map). Decided by George Mogga; relayed by George Chief of staff. · Date: 2026-10-12

### D-021 Stale rule (design, DS-05)
Decision: **Data counts as stale once it is one update cycle overdue.** George's words: "Yes, use those dashboard defaults and that stale rule." (same approval as D-018) Decided by George Mogga; relayed by George Chief of staff at 9:58 PM MT. · Date: 2026-10-12

### D-022 Need-map bins placeholder (design, DS-06)
Decision: **Keep the 5 equal-count bins as a placeholder** until George sets the need-score weights. The need-score weights themselves are still open and are not decided here. Decided by George Mogga; relayed by George Chief of staff at 9:58 PM MT. · Date: 2026-10-12
