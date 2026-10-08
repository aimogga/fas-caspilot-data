# Plugin, MCP and Integration Inventory

**Seeded from the integrations connected to George's Claude account (October 2026).** Grok, Cursor and n8n may have a different set. In Phase 0 the Chief of Staff confirms what is actually available in each tool, adds missing rows, and gets George's sign-off. Anything not marked **Use** needs a DECISIONS.md entry before a packet may list it in `plugins_allowed`.

## Core build tools
| Tool | Where | Verdict | Use it for | Guardrails |
|---|---|---|---|---|
| Cursor (local + Cloud Agents) | Build | **Use** | All coding; one cloud agent per packet | Dev/preview credentials only |
| Cursor Automations | Build | Avoid | Not on George's $20 plan; Nightly Audit runs as a GitHub Actions cron instead | — |
| Cursor Bugbot / PR review (if enabled) | Build | Maybe | Second-opinion review on PRs | Doesn't replace QA |
| GitHub | Build | **Use** | Repo, Issues (packets), PRs, Actions CI + Nightly Audit cron | Branch protection on main |
| Supabase MCP | Cursor | **Use** (dev/preview only) | Schema inspection, migrations on dev, advisors | Never connected to production project |
| Vercel MCP | Cursor | **Use** (read-mostly) | Deployment status, logs, preview URLs | Promotions to production need George |
| Shadcn UI MCP | Cursor | **Use** | UI components and blocks | — |
| n8n MCP | Cursor | **Use** (CasePilot instance, dev only) | Create/inspect schedule + alert workflows | New workflows inactive; don't edit live ones (D-002, D-007) |
| Context7 (docs MCP) | Cursor | Maybe → recommended | Current library docs so agents don't use outdated APIs | Add in Phase 0 if not installed |
| Playwright MCP | Cursor/QA | Maybe → recommended | QA screenshots of dashboards and exported PDFs | Preview environments only |

## Connected business tools (seeded list)
| Tool | Verdict | Reason |
|---|---|---|
| Google Drive | Maybe | Storing finished board packets and docs for humans; never the source of truth for data |
| Gmail | Maybe | Weekly digest could send via n8n's Gmail node; agents never send email directly |
| Google Calendar | Avoid (v1) | Not needed; maybe later for grant deadline reminders |
| PDF Tools | Maybe | QA inspection of exported PDFs |
| Canva | Avoid (core) | Manual design work only; the app must generate packets itself |
| Claude in Chrome / Control Chrome / macOS control | Avoid | Desktop control is not reproducible in cloud builds and is risky with credentials |
| Stripe | Avoid (v1) | No billing in v1 |
| HubSpot, Clay, Vibe Prospecting | Avoid for FAS data | Never send FAS data to sales/CRM tools; may be useful later for CasePilot's own sales |
| Apify (scraping) | Avoid | Prefer official APIs; scraping can break site terms |
| Buffer, OpusClip | Avoid | Not relevant to this build |

## Grok-side tools
*(Chief of Staff fills in: which tools, connectors, browsing and code-execution features each Grok bot has, and which repo/issue access they need.)*

| Bot | Tools it has | Repo access needed | Notes |
|---|---|---|---|
| Chief of Staff |  | Read; write to harness/ via PR |  |
| Engineer Supervisor |  | Write (packets, PR review, merge) |  |
| Engineer Bot |  | Via Cursor only |  |
| Deep Research |  | Write to docs/research/ via PR | Needs web access |
| QA Bot |  | Read + CI + preview access | Only bot that edits feature statuses |
| Nightly Audit |  | Read; PRs for doc drift only | Runs as GitHub Actions cron |
