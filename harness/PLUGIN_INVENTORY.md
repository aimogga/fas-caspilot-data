# Plugin, MCP and Integration Inventory

> Phase 0, F-000. Filled in by the Chief of Staff on 2026-10-08 (MT), from the reviewed box draft (Rev 2). **Status update 2026-10-12:** the Cursor Cloud Agents and Automations rows now match the repo's current verdicts (George's plan has Cloud Agents; Automations aren't on it, so the Nightly Audit runs as a GitHub Actions cron). Sections lower down that say "pending upgrade" record the 2026-10-08 review.
> Originally seeded from the integrations on George's Claude account. This draft re-checks what is **actually** connected on the Grok side (live tool catalog and light read-only calls on 2026-10-08), what the repo declares for Cursor, and what the docs assume about n8n. Nothing here was created or changed in any service.

**Rules that apply to every row (from the kickoff + `docs/PRIVACY_AND_COMPLIANCE.md`):** synthetic data only until the Phase 6 gate · least privilege · no FAS data goes to a third party without a DECISIONS.md entry · anything not marked **Use** needs a DECISIONS.md entry before a packet may list it in `plugins_allowed`.

**Column key**
- **Verdict:** **Use** / Maybe / Avoid.
- **FAS data → 3rd party?** **Yes** = using the tool for its purpose here would send FAS data (real or derived) outside CasePilot's own stack · **No** = it never touches FAS data · **Only if misused** = safe for its intended use, but someone could paste or route FAS data into it. Synthetic data only until Phase 6 applies regardless.
- **Verified?** ✅ = confirmed live on 2026-10-08 · ⚠️ = partly confirmed · ❓ = unverified, needs George or the Engineer Supervisor to confirm.

---

## Core build tools
*Template rows kept. "Cursor (local + Cloud Agents)" is split into two rows so the Cloud Agents status (pending George's plan upgrade) is visible.*

| Tool | Where | Verdict | Use it for | Guardrails | FAS data → 3rd party? | Verified? |
|---|---|---|---|---|---|---|
| Cursor (local IDE agent) | Build | **Use** | Local coding; reviewing Cloud Agent PRs | Dev/preview credentials only; `.cursor/rules/*` always on | Only if misused (code and synthetic data go to Cursor's model providers) | ❓ plan, IDE config and MCPs not visible to Grok |
| Cursor Cloud Agents | Build | **Use** | One cloud agent per packet (F-003, PLAN working limits) | George will upgrade the Cursor plan to include Cloud Agents (2026-10-08). Flip to **Use** once the upgrade is live **and** D-009 caps are set: on-demand usage must be enabled with a hard spend limit before the first run (cursor.com/docs/account/billing/spend-limits). Max 2 in parallel; dev/preview secrets only | Only if misused (code + synthetic data go to the selected model's provider) | ❓ upgrade not yet confirmed |
| Cursor Automations | Build | Avoid | Not on George's plan; Nightly Audit runs as a GitHub Actions cron instead | Comes with the Cursor plan upgrade (Automations are on Pro and above, not Start). Each run is a Cloud Agent billed at API rates using the model's **maximum** context window (cursor.com/docs/cloud-agent/automations). Flip to **Use** once the upgrade is live and the D-009 per-run and monthly caps are set | Only if misused | ❓ upgrade not yet confirmed |
| Cursor Bugbot / PR review (if enabled) | Build | Maybe | Second-opinion review on PRs | Doesn't replace QA | Only if misused | ❓ |
| GitHub (`aimogga/fas-caspilot-data`, private) | Build | **Use** | Repo, Issues (packets), PRs, Actions CI | Branch protection on main (F-104). Repo is under the personal `aimogga` account; D-001 recommends a CasePilot org | No (repo must never hold real data) | ✅ read via cursor-github |
| GitHub Actions | Build | **Use** | CI (F-104). Also a possible Nightly Audit fallback (D-002 option C) | Secret scanning on; no production secrets | No | ❓ no workflows exist yet |
| Supabase MCP | Cursor | **Use** (dev/preview only) | Schema inspection, migrations on dev, advisors | Never connected to production project | No while on dev/synthetic. **Yes** if pointed at production | ❓ Cursor side. A Grok-side Supabase connector also exists (see Grok table) |
| Vercel MCP | Cursor | **Use** (read-mostly) | Deployment status, logs, preview URLs | Promotions to production need George | No (preview/synthetic) | ❓ Cursor side |
| Shadcn UI MCP | Cursor | **Use** | UI components and blocks | — | No | ⚠️ in the Cursor marketplace (cursor.com/marketplace/shadcn); install not confirmed |
| n8n MCP | Cursor | Maybe *(template said Use)* | Create/inspect schedule + alert workflows | CasePilot instance, dev only; new workflows inactive; don't edit live ones (D-002, D-007). **D-007 says Cursor's `mcp.json` currently points at the ModernLine n8n MCP server, which is the wrong instance** | Only if misused | ❓ no official Cursor plugin found; community `n8n-mcp` or `n8n-as-code` would be needed |
| Context7 (docs MCP) | Cursor | Maybe → recommended | Current library docs so agents don't use outdated APIs | Add in Phase 0 if not installed | Only if misused (queries go to Upstash) | ⚠️ in the Cursor marketplace (cursor.com/marketplace/upstash); install not confirmed |
| Playwright MCP | Cursor/QA | Maybe → recommended | QA screenshots of dashboards and exported PDFs | Preview environments only | No (preview/synthetic) | ❓ Cursor side. A Grok-side Playwright connector exists |

## Connected business tools (seeded list)
*Seeded from the Claude account. The "On Grok side?" column shows whether the same tool is connected to this Grok account.*

| Tool | Verdict | Reason | On Grok side? | FAS data → 3rd party? |
|---|---|---|---|---|
| Google Drive | Maybe | For storing finished board packets and docs for humans. Never the source of truth for data. Storing real packets after Phase 6 puts FAS-Shareable data in Google, so that needs a decision | Yes (`user-Google-drive`, ready + skill) | Only if misused until Phase 6, then **Yes** |
| Gmail (via n8n Gmail node) | Maybe | The weekly digest could send through n8n's Gmail node. Digest content is grant matches only, never client data. Agents never send email directly | Yes (`user-Gmail--casepilot-llc`, see Grok table) | Only if misused |
| Google Calendar | Avoid (v1) | Not needed. Maybe later for grant deadline reminders | Yes (`user-Google-calendar`) | Only if misused |
| PDF Tools | Maybe | QA inspection of exported PDFs | No. Grok equivalent is poppler on the box | No (exports are synthetic before Phase 6) |
| Canva | Avoid (core) | Manual design only; the app must generate packets itself | No | Only if misused |
| Claude in Chrome / Control Chrome / macOS control | Avoid | Desktop control isn't reproducible in cloud builds and is risky with credentials | No (Claude-only) | Only if misused |
| Stripe | Avoid (v1) | No billing in v1 | No | No |
| HubSpot, Clay, Vibe Prospecting | **Avoid for FAS data** | Sales and CRM tools. FAS client data must never go to them. Might help CasePilot's own sales later | HubSpot + Clay yes; Vibe no | **Yes** if ever used with FAS data |
| Apify (scraping) | Avoid | Prefer official APIs. PRD non-goals and DATA_SOURCES "Avoid" both forbid scraping | Yes (`user-Apify` + 5 skills) | Only if misused |
| Buffer, OpusClip | Avoid | Not relevant to this build | Buffer yes (wrong account, see below); OpusClip no | Only if misused |

## Grok-side tools

### Per-bot summary (template table)
*Verified only for the Chief of Staff instance (this account). All six bots run on George's Grok account, which shares one connector set and one box, so the other bots probably see the same tools. That's unverified. The **Tools it should use** column is a proposed least-privilege allowlist, not a description of what each bot can technically reach.*

| Bot | Tools it should use (proposed allowlist) | Repo access needed | Notes |
|---|---|---|---|
| Chief of Staff | cursor-github (read), web search/fetch, box shell + file generation, routines, Google Drive (harness docs only) | Read; write to harness/ via PR | Verified tool set below. Can technically reach far more than it needs (see Gaps) |
| Engineer Supervisor | cursor-github (Issues/packets, PR review, merge), Vercel (`user-Vercel-xai`, read-mostly), Supabase (dev/preview only, after D-001/D-007), Vercel + Supabase skills, engineering-workflow skills | Write (packets, PR review, merge) | Owns F-003, which waits on George's Cursor plan upgrade and the D-009 caps |
| Engineer Bot | None directly. Works through Cursor | Via Cursor only | Cursor config unverified |
| Deep Research | Web search/fetch, box shell (sample API calls to public endpoints), box browser for public pages only | Write to docs/research/ via PR | Needs web access ✅. Never put FAS data in search queries |
| QA Bot | cursor-github (read, CI status), Playwright (preview only), box shell (poppler, python-docx to inspect exports) | Read + CI + preview access | Only bot that edits feature statuses |
| Nightly Audit | cursor-github (read), Supabase advisors (read, dev only), Vercel (read) | Read; PRs for doc drift only | Runs as a Cursor Automation once the plan upgrade is live; needs the D-009 per-run cap |

### Grok connector inventory (live catalog, 2026-10-08)
*Sources: GetDynamicTools catalog and namespace statuses. Account identity is confirmed only where a read-only identity call was made. `GetMcpServerStatus` and `SearchPlugins` weren't available to this subagent, so namespace status comes from the catalog's `namespaceStatus` field.*

| Connector (namespace) | Status | Account (how confirmed) | Verdict | Reason | FAS data → 3rd party? |
|---|---|---|---|---|---|
| cursor-github | ready | `mogga1991` (George Mogga) + `aimogga` ✅ get_me | **Use** | Only connector that can read the repo. Has write/merge/delete tools across both accounts; restrict to the bots that need it | No |
| cursor-origin | ready | Origin-hosted repos (not checked) | Avoid | Repo lives on GitHub, not Origin. Not needed | Only if misused |
| user-GitHub-xai | ready | `modernline-developer` ✅ get_me | Avoid | Wrong account (ModernLine). Can't see the repo | Only if misused |
| user-Vercel-xai | ready | Team "aimogga's projects" ✅ list_teams | Maybe | Matches the planned stack. Read-mostly for deployment status/logs once the project exists. D-001 recommends a CasePilot-owned team instead | No (preview/synthetic) |
| user-Vercel | ready | **Unknown**: list_teams returns 0 teams; `/v2/user` returns 404 "User not found" | Avoid | Can't tell which account it is. Don't use until identified or removed | Only if misused |
| user-Vercel--aimogga | ready | **Unknown**: same results as above, despite the "aimogga" label | Avoid | Same as above. Three Vercel connectors is two too many | Only if misused |
| user-Supabase | ready | Not checked (no calls made) ❓ | Maybe | Planned stack. Very powerful: execute_sql, apply_migration, create_project, merge_branch, pause_project. Dev/preview only, after D-001/D-007 confirm the org/project | No on dev. **Yes** if pointed at production |
| user-Google-drive | ready | Not checked ❓ | Maybe | Harness docs and finished packets for humans. Not the source of truth | Only if misused; **Yes** for real packets after Phase 6 |
| user-Google-sheets | ready | Not checked ❓ | Maybe | Handy for George reviewing plans and trackers. Never FAS records | Only if misused |
| user-Google-calendar | ready | Not checked ❓ | Avoid (v1) | Not needed in v1 | Only if misused |
| user-Gmail--casepilot-llc | ready | "casepilot llc" (tool descriptions) | Avoid | Agents never send email directly (template + F-505's `george-before-send` gate). The digest goes through n8n | **Yes** if used to send FAS data |
| user-Gmail (personal) | **not found** | — | Avoid | Named in the kickoff but **not present** in the catalog today | n/a |
| user-Hubspot--casepilot | ready | "casepilot" (namespace label) | **Avoid** | CRM. Never touches FAS data | **Yes** |
| user-Clay | ready | Not checked | **Avoid** | Prospecting/enrichment. Never touches FAS data | **Yes** |
| user-Apify | ready | Not checked | **Avoid** | Scraping is out of scope. Use official APIs | Only if misused |
| user-Buffer-xai | ready | hello@stillcoolsleep.com (per kickoff; not re-checked) | **Avoid** | **Not George's company.** Social posting. Not relevant | **Yes** if anything were posted |
| user-Linear | ready (**installed**) | Not checked | Avoid (v1) | Packets are GitHub Issues (AGENTS.md). A second tracker would split the source of truth | Only if misused |
| user-Sentry | ready (**installed**) | Not checked | Maybe | Error monitoring for the Next.js app isn't in the docs yet. Error events can carry request data, so add scrubbing and include it in the D-006 BAA review before real data | Only if misused before Phase 6; **Yes** risk after unless scrubbed |
| user-Playwright | ready | Runs where? ❓ | Maybe | QA screenshots on preview. Includes `browser_run_code_unsafe` | No (preview/synthetic) |
| user-Cloudflare | ready | Not checked | Maybe | Only if Cloudflare Tunnel is chosen for agent networking (ARCHITECTURE "Networking"). Only relevant once Cloud Agents are live and need a private dev endpoint | Only if misused |
| user-Notion | ready | Not checked | Avoid | Not in stack. Docs live in the repo | Only if misused |
| user-Airtable | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Supermemory | ready | Not checked | Avoid | Stores agent "memories" with a third party, where FAS context could leak | **Yes** if it captured FAS context |
| user-Agentmail | ready | Not checked | Avoid | Agents don't send email | Only if misused |
| user-Browserless | ready | Not checked | Avoid | Third-party cloud browser. The box browser and Playwright cover this | Only if misused |
| user-Railway | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Render | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-PlanetScale | ready | Not checked | Avoid | Not in stack (Supabase is) | Only if misused |
| user-Turso | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Mongodb | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Mongodb-atlas | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Convex | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Firebase | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Pinecone | ready | Not checked | Avoid | Not in stack | Only if misused |
| user-Clerk--aimogga | ready | "aimogga" (label) | Avoid | Auth is Supabase Auth. Snippet tools only | No |
| user-Mobbin | ready | Not checked | Avoid (v1) | UI inspiration only. shadcn covers the build | No |
| user-X | ready | Not checked | Avoid | Not relevant. Can send DMs | Only if misused |
| x (X search) | ready | Built-in | Avoid | Not relevant | No |
| user-Finance-xai | **needsAuth** | — | Avoid | Not usable and not relevant | n/a |
| user-Superhuman-mail | **needsAuth** | — | Avoid | Not usable and not relevant | n/a |
| user-Turbopuffer | **error** (discovery failed) | — | Avoid | Not usable and not relevant | n/a |

### Grok built-ins
| Tool | Verdict | Use it for | FAS data → 3rd party? | Verified? |
|---|---|---|---|---|
| Web search + web fetch | **Use** | Deep Research source cards (F-002), checking docs and terms | Only if misused (query text goes to the search provider) | ✅ |
| Box shell (Python 3.13, pandas, openpyxl, python-docx, python-pptx; poppler `pdftotext`; LibreOffice; Chrome; Node + pnpm) | **Use** | Sample API calls to public sources, inspecting exported PDF/DOCX, analysis on synthetic data | No | ✅ Gaps: no Docker or Supabase CLI on the box; `gh` not logged in; no reportlab/pypdf |
| Box browser | Maybe | Public pages only (source research, preview screenshots) | Only if misused. Logins are **shared by all of George's agents on the box**, so never log into FAS systems here | ✅ exists |
| Routines (scheduled prompts) | Maybe | Chief of Staff reminders (e.g., Grants.gov key check, weekly status). Not a replacement for n8n schedules (D-002) | Only if misused | ✅ skill present |
| File generation (DOCX/XLSX/PPTX/PDF on the box) | **Use** | Decision memos and harness docs for George. **Not** product exports; the app generates packets itself (D-004) | No | ✅ |
| CopyToBox / CopyFromBox / Upload / Download file | Maybe | Moving harness drafts to George's machine or Drive | Only if misused | ✅ |

### Installed plugin skills (box plugin cache, 44 plugins / 331 skills)
| Skill pack | Verdict | Reason | FAS data → 3rd party? |
|---|---|---|---|
| Vercel (33 skills: deployments-cicd, env-vars, vercel-functions, vercel-cli, …) | **Use** | Reference guidance for the planned host. No data leaves | No |
| Supabase (2: supabase, supabase-postgres-best-practices) | **Use** | Reference for RLS, migrations, Postgres | No |
| Google Drive (1) | Maybe | Same rules as the Drive connector | Only if misused |
| Apify (5: ultimate-scraper, actor development, …) | Avoid | Scraping is out of scope | Only if misused |
| Sentry (8) | Maybe | Goes with the Sentry decision | Only if misused |
| Superpowers (14: TDD, code review, verification), Cursor Team Kit (18: fix-ci, run-smoke-tests, review-and-ship), Compound Engineering (36) | Maybe | Engineering-workflow guidance for the Engineer Supervisor/QA. Overlaps with AGENTS.md; pick one set | No |
| Docker skills (11) | Maybe | `supabase start` needs Docker (AGENTS.md) | No |
| Parallel (4: deep research, enrichment, web search) | Avoid | Third-party research/enrichment API. Web search covers Deep Research | Only if misused |
| Everything else installed (Harness.io, Temporal, Render, Railway, Convex, Firebase, Clerk, Cloudflare, PlanetScale, Turso, MongoDB ×2, Pinecone, Turbopuffer, Airtable, Notion, Agentmail, mcp-mail/Superhuman, Supermemory, X, Docs Canvas, Cursor SDK, Google Sheets) | Avoid | Not in this build's stack | Only if misused |

### Available but not installed (or not found)
| Item | Finding | Verdict |
|---|---|---|
| Supabase, Sentry, Linear connectors | **Already installed and ready** on the Grok side, contrary to the kickoff's assumption (see rows above) | (see above) |
| n8n | No n8n connector on the Grok side. No official Cursor marketplace plugin found; community options are `czlonkowski/n8n-mcp` and `n8n-as-code` (Cursor plugin) | Maybe (see n8n section) |
| Census | No connector found. Not needed: SAHIE/SAIPE/ACS come from the public Census API directly in `packages/ingest/` (DATA_SOURCES.md) | n/a, use the API |
| Context7, shadcn | In the Cursor marketplace (cursor.com/marketplace/upstash, cursor.com/marketplace/shadcn). Install not confirmed | (see Core table) |
| `SearchPlugins` / `GetMcpServerStatus` | Not available to this subagent, so marketplace installability for the Grok side wasn't checked through Grok's own plugin search | ❓ |

---

## Cursor (local + Cloud)
**Declared in the repo (✅ read 2026-10-08):**
| Item | What it says |
|---|---|
| `.cursor/rules/00-core.mdc` (alwaysApply) | Read AGENTS.md + progress.md first; one feature_id; tests from acceptance criteria; run lint/typecheck/test; progress entry + PR; don't edit feature statuses; stop and ask if a decision is missing |
| `.cursor/rules/10-privacy.mdc` (alwaysApply) | Synthetic data only; county-level; no exact dates; suppress < 11 with complementary suppression; no clinical/SUD/court-document fields; RLS deny-by-default; no secrets |
| `.cursor/rules/20-data-ingestion.mdc` (globs `packages/ingest/**`, `supabase/functions/ingest-*/**`, `n8n/**`) | One module per source; only endpoints/licenses in DATA_SOURCES.md; idempotent runs; Grants.gov key keep-alive; n8n workflows created inactive, JSON exported to `n8n/` |
| `.cursor/rules/30-grant-strategy.mdc` (globs `lib/grants/**`, `app/**/grants/**`, `supabase/functions/strategy-*/**`) | Explainable matching; flags not hidden; cited JSON drafts; DRAFT label; LLM only via `lib/llm/` |
| `.cursor/environment.example.json` | install `corepack enable && pnpm install --frozen-lockfile`; start `supabase start`; terminal `web: pnpm dev`. The real `.cursor/environment.json` doesn't exist yet (F-003) |
| `.cursor/mcp.json` | **Not in the repo.** D-007 says George's local `mcp.json` points at the ModernLine n8n MCP |

**Unverified. Needs George or the Engineer Supervisor to confirm:**
- **Cursor Cloud Agents + Automations: pending upgrade.** George said on 2026-10-08 he will upgrade the Cursor plan to include them. F-003 can start once the upgrade is live, on-demand usage is enabled with a hard spend limit, and the D-009 caps are approved. Confirm which account the plan is billed to (personal vs. a CasePilot Teams account; see D-001 and D-009).
- Cursor plan tier, Bugbot availability, Secrets tab, and which MCPs are installed locally (Supabase, Vercel, shadcn, Context7, Playwright, n8n). None of this is visible to Grok.
- Whether Docker runs on the Cursor machine(s) for `supabase start`.

## n8n
**Access:** none from the Grok side (no connector, no credentials). Everything below is what the docs **assume**. None of it is verified.
| Assumption | Source |
|---|---|
| Instance at `n8n.casepilot.io` | AGENTS.md (Stack), ARCHITECTURE.md, D-002 |
| "Already running on CasePilot's Google Cloud", i.e. **self-hosted on GCP**, not n8n Cloud | D-002 |
| Jobs: trigger ingest functions on schedules, send failure alerts (email or Slack, F-201), weekly grant digest (F-505, possibly via the Gmail node) | ARCHITECTURE, PRD C6, feature_list |
| Workflow JSON exported to `n8n/`; new workflows created inactive; live workflows not edited without George | 20-data-ingestion.mdc, D-002, D-007 |
| Cursor's n8n MCP currently points at **ModernLine's** n8n, not CasePilot's | D-007 |

**Data-residency note:** if n8n really is self-hosted on CasePilot's GCP, execution data stays in CasePilot's project. Confirm the GCP region, the execution-data retention setting (n8n saves execution payloads by default), and where credentials are stored. If it's n8n Cloud instead, n8n GmbH becomes a processor (a third party) and needs a decision. Either way: workflows should pass run IDs and aggregates only, failure alerts must never include row payloads, and the digest email passes through Google (Gmail). **Verdict: Maybe until D-002/D-007 are decided and the instance is confirmed. FAS data → 3rd party: Only if misused (self-hosted) / Yes (n8n Cloud).**

---

## Gaps that need George to confirm
1. **Cursor plan upgrade (pending):** George will add Cloud Agents + Automations. Still to confirm: the upgrade is live, which account/plan pays (Pro Plus vs. Teams), and the D-009 caps. F-003 and the Nightly Audit wait on this.
2. **n8n:** confirm the instance (`n8n.casepilot.io`), hosting (self-hosted GCP vs. cloud), region, retention, and repoint the MCP away from ModernLine (D-002, D-007).
3. **Supabase:** the Grok connector is installed and ready, but which org/projects it can reach wasn't checked. Confirm the org (D-001 recommends CasePilot-owned), that a dev/preview project exists, and that no agent-visible token can reach production.
4. **Vercel:** three connectors. Only `user-Vercel-xai` resolves (team "aimogga's projects"). `user-Vercel` and `user-Vercel--aimogga` return no teams and 404 on user lookup. Pick one; disconnect or fix the others (D-001).
5. **Least privilege on the Grok side:** every bot on this account can reach ~40 connectors, including write/merge on GitHub, SQL on Supabase, and send on Gmail/X/Agentmail. Proposed: a decision entry with a per-bot allowlist (table above) and disconnecting unused connectors.
6. **Task-packet template: resolved.** `grok/task_packet_template.md` was added in commit bc9a07d (2026-10-08). It defines `context_files`, `plugins_allowed` ("only items marked Use in harness/PLUGIN_INVENTORY.md"), `data_allowed`, `environments_allowed` and `human_gate`. Consequence: until the Maybe rows here are decided, packets can only list the Use rows in `plugins_allowed`.

## Conflicts between the docs and the kickoff rules
1. **Cloud Agents assumed everywhere; plan upgrade pending:** template, AGENTS.md, ARCHITECTURE, PLAN, F-003, NIGHTLY_AUDIT and D-009 all assume Cloud Agents. Resolved in principle by George's upgrade; it stays open until the upgrade is live. Also: the docs say Automations run in "Max Mode". Cursor's current docs say Max Mode exists only on legacy request-based plans and that Automations always use the model's maximum context window (cursor.com/docs/account/pricing, cursor.com/docs/cloud-agent/automations, read 2026-10-08). The cost effect is similar, but the wording should be updated.
2. **Template pre-marks Use while the decisions are still open:** n8n MCP (D-002, D-007 open), Supabase/Vercel MCP (D-001, D-006 open), Cursor Automations (D-009 open). Under the kickoff rule these should wait for the decision, so this draft downgrades n8n MCP and Automations to Maybe.
3. **Ownership:** D-001 recommends CasePilot-owned GitHub org/Vercel team/Supabase org. The repo is on personal `aimogga`, and the only working Vercel connector is "aimogga's projects". (Also: the repo name is spelled `fas-caspilot-data`, missing an "e". Intended?)
4. **Template header** says it was seeded from the Claude account. Several seeded rows (PDF Tools, Canva, Claude in Chrome, Stripe, Vibe Prospecting, OpusClip) don't exist on the Grok side, and the Grok side has ~30 connectors the template never mentions.
5. **Google Drive for packets (template: Maybe)** would put FAS-Shareable data in Google after Phase 6. The kickoff requires a decision before any FAS data goes to a third party, so D-006's BAA/plan review should cover Google Workspace too, not just Supabase/Vercel/LLM.
6. **The Grok bots themselves are an LLM third party.** PRIVACY's BAA list names "any LLM provider that would see the data". The synthetic-only rule covers Phases 0–5, but D-003 and D-006 should explicitly cover the build agents (Grok, Cursor's model providers), not just the in-app LLM.

## Proposed DECISIONS.md entries (drafts, not written to the repo)
- **D-011 Grok-side connector allowlist per bot** (table above) and disconnecting unused or wrong-account connectors (GitHub-xai, Buffer-xai, the two unidentified Vercel connectors).
- ~~D-012 Cursor Cloud Agents not on plan~~ **Resolved: upgrade** (George, 2026-10-08). Caps are handled in D-009.
- **D-013 Error monitoring (Sentry): yes/no;** PII scrubbing and BAA review if yes.
- **D-014 Where finished packets live** (Supabase Storage only vs. also Google Drive) after Phase 6.
- ~~D-015 Task packet format~~ **Resolved:** `grok/task_packet_template.md` exists (commit bc9a07d).

## Counts (this draft)
79 rated rows: **Use 12 · Maybe 24 · Avoid 43**. Of the 12 Use rows, 7 are verified live (the GitHub repo, cursor-github, web search/fetch, the box shell, file generation, and the Vercel and Supabase skill packs). The Cursor-side Use rows (Cursor local, Supabase MCP, Vercel MCP, shadcn, GitHub Actions) are unverified. The Maybe count includes the two Cursor rows pending the plan upgrade (Cloud Agents, Automations); they move to Use once the upgrade is live and D-009 is set (→ Use 14 · Maybe 22).

*Sources: repo files read via cursor-github on 2026-10-08, including grok/ (commit bc9a07d) for rev 2 (AGENTS.md, docs/*.md, harness/*.md, harness/feature_list.json, .cursor/*); Grok tool catalog (GetDynamicTools) on 2026-10-08; read-only identity calls: cursor-github get_me, user-GitHub-xai get_me, Vercel list_teams ×3 and get_auth_user ×2; box plugin cache listing; web search for Cursor marketplace (Context7, shadcn, n8n).*
