# Decisions Log

Format per decision: context → options → recommendation → cost/risk → **George's decision + date**. The Chief of Staff writes memos; George decides.

## Open

### D-001 Account and repo ownership
Options: (A) CasePilot-owned GitHub org, Vercel team and Supabase org under casepilot.io identities; (B) existing personal or ModernLine accounts.
Recommendation: **A.** CasePilot's Google Cloud already runs under a casepilot.io account; keep the product's code, hosting and data under CasePilot too, so it's clean to transfer, audit or sell later.
Decision: ___ · Date: ___

### D-002 Scheduler for data pulls and alerts
Options: (A) n8n at n8n.casepilot.io triggers ingest functions in the repo and sends alerts/digests; (B) Supabase scheduled jobs + Edge Functions only; (C) GitHub Actions cron.
Recommendation: **A**, with all transformation logic in `packages/ingest/` (tested in CI). n8n is already running on CasePilot's Google Cloud and is good at schedules and notifications. New workflows are created inactive; existing live workflows aren't edited without George.
Decision: ___ · Date: ___

### D-003 In-app LLM provider for strategy drafts
Options: xAI (Grok) API, Anthropic, OpenAI, or others, behind `lib/llm/`.
Criteria: reliable structured (JSON) output, data-retention terms, cost, and BAA availability if anything sensitive could ever reach it (the design sends aggregates only).
Recommendation: pick one provider for v1 after a 5-opportunity bake-off scored by QA on citation accuracy; keep the adapter so it can change.
Decision: ___ · Date: ___

### D-004 PDF and Word export method
Options: (A) print-optimized HTML route rendered to PDF with headless Chromium + a DOCX library; (B) a React PDF library; (C) a paid document API.
Recommendation: **A**: one design source for screen and print; no third party sees the data.
Decision: ___ · Date: ___

### D-005 Outcome questionnaires (FAS leadership decision)
Options: OQ-45 (adults) + YOQ (youth), which Utah's public mental health scorecards use, so results compare directly (confirm licensing cost); or PHQ-9 + GAD-7, which are free but have no Utah comparison.
Recommendation: OQ/YOQ if licensing is affordable; otherwise PHQ-9/GAD-7.
Decision: ___ · Date: ___

### D-006 Hosting plans and compliance tier
Questions: Supabase and Vercel plan levels, region, backups, and whether BAAs are available/needed before real provider data (see PRIVACY_AND_COMPLIANCE.md).
Recommendation: free/low tiers for Phases 0–5 (synthetic data); upgrade before Phase 6 based on the legal opinion.
Decision: ___ · Date: ___

### D-007 Cursor and MCP configuration
Questions: which MCP servers local vs. cloud agents may use; credentials scope.
Recommendation: Cursor's `mcp.json` currently points at the ModernLine n8n MCP server; for this repo, use the CasePilot n8n instance (dev workflows only). Enable Supabase MCP for dev/preview projects only, Vercel MCP read-mostly, Context7 for current library docs, Playwright MCP for QA. No MCP gets production credentials. See PLUGIN_INVENTORY.md.
Decision: ___ · Date: ___

### D-008 Multi-organization design
Recommendation: `org_id` on every FAS table and RLS by org from day one; no billing or self-service signup in v1.
Decision: ___ · Date: ___

### D-009 Cost caps
Set monthly caps for: Cursor Cloud Agents + Automations (Automations run in Max Mode and bill as cloud-agent usage), per-run cap for the Nightly Audit, in-app LLM API, Supabase, Vercel. Max parallel cloud agents (start: 2).
Recommendation: Chief of Staff proposes numbers from the Phase 0 cost estimate.
Decision: ___ · Date: ___

### D-010 Foundation opportunity inputs
Questions: how foundation opportunities get in (manual entry, CSV export from the foundation research tools FAS already uses, or both) and whether those tools' terms allow importing their data.
Recommendation: manual + CSV in v1; check each tool's export terms before automating.
Decision: ___ · Date: ___

## Decided
*(move items here with George's decision and date)*
