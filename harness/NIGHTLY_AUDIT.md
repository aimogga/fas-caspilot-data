# Nightly Audit

**Runs as:** a GitHub Actions cron (`on: schedule`) in `.github/workflows/nightly-audit.yml`; Cursor Automations are not used (implementation choice, see D-009 and `harness/PLUGIN_INVENTORY.md`). Cron `23 9 * * *` (UTC), about 2:23–3:23 a.m. Mountain depending on daylight time; `nightly-audit-backup.yml` (`7 14 * * *` UTC) dispatches it if no run succeeded in the last 26h. Scheduled runs may start late but never early.
**Permissions:** read-only on code and data; may open a PR that fixes documentation drift only.
**Cost:** stay under the per-run cap in DECISIONS.md D-009. Once F-601 ships, run `pnpm audit:nightly` and summarize its output instead of checking by hand.

## Checklist
| # | Area | Check | Severity if failed |
|---|---|---|---|
| 1 | Data freshness | Every active source succeeded within its expected cadence; list failures in the last 24h | High if 2 nights in a row |
| 2 | Data sanity | Row counts within ±20% of the previous vintage; no new null spikes; all 29 Utah counties present | Medium |
| 3 | Grants | Grants.gov key used within the last 25 days (keys are disabled after 30 days unused); opportunities refreshed; list "pursuing" deadlines in the next 14 days | High (key), Low (deadlines: info) |
| 4 | Privacy | Suppression test suite passes against shared views; no cell < 11 in board/export views; RLS enabled on every table (Supabase advisors); secret scan of the last 24h of commits clean | **Critical** |
| 5 | Build health | Main branch CI green; preview and production deploys healthy; no new high/critical dependency vulnerabilities | High |
| 6 | Harness integrity | Every `passing` feature has an evidence link; `AGENTS.md` commands still run; docs don't reference missing files; `progress.md` updated for every merged PR | Medium |
| 7 | Cost | Cursor Cloud Agent usage and LLM spend vs. caps | High at 80% of a cap |

## Output
- `harness/audits/YYYY-MM-DD.md` (via PR) using the template below.
- One GitHub Issue per finding of Medium or higher, labeled `audit` + severity.
- Summary to the Chief of Staff; Critical findings escalate immediately.

```
# Nightly Audit — YYYY-MM-DD
Overall: GREEN | YELLOW | RED
Critical: <none | list>
High: <...>
Medium: <...>
Data freshness: <source: last success / vintage>
Spend: <month-to-date vs cap>
Doc-drift PR: <link | none>
```

## Ingest alerts (F-201)
`checkIngestAlerts` (needs `INGEST_ALERT_WEBHOOK_URL`; issue half needs `GITHUB_TOKEN`) goes YELLOW when:
- an unauthenticated synthetic POST to the n8n webhook returns anything but 401/403, or is a Cloudflare challenge (`cf-mitigated: challenge` header, or a 403 whose body is a CF challenge page). A plain n8n 403 ("Authorization data is wrong!") is healthy.
- an open or last-24h `ingest-alert` issue lacks the body line `Delivered-by: n8n`.

Discriminator: the n8n GitHub node and the app fallback (`IngestAlert.githubIssue`) both post as the same GitHub user with no app attribution and identical body lines, so author/app cannot tell them apart. Each path now writes an explicit last line: `Delivered-by: n8n` (workflow JSON) or `Delivered-by: app-fallback`. The live n8n workflow must be synced from `n8n/ingest-failure-alert.json`; until then n8n issues also count as unmatched.
