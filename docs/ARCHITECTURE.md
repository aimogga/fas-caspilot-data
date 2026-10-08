# Architecture

## Principles
1. **Deterministic jobs do recurring work.** Ingestion and metrics are tested code on schedules; AI agents build, audit and draft.
2. **Postgres is the single source of truth.** Every displayed number is a query result with provenance.
3. **Provenance everywhere:** public rows carry `source_id`, `vintage`, `ingest_run_id`; FAS rows carry `upload_batch_id` or `entered_by`.
4. **Tenant-ready:** `org_id` on every FAS table; RLS by org and role.
5. **Privacy by construction:** suppression and geography rules live in shared SQL functions and TypeScript helpers, never re-implemented per screen.
6. **Swappable AI:** in-app LLM calls go through `lib/llm/` so the provider can change.

## Components
| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js (App Router, TypeScript), shadcn/ui, a charting library, a map component for Utah counties | Hosted on Vercel; preview deploy per PR |
| Database/Auth/Storage | Supabase (Postgres, Auth, RLS, Storage, Edge Functions) | Separate projects or branches for dev/preview vs. production |
| Ingestion code | `packages/ingest/<source>` (TypeScript), executed by Supabase Edge Functions or a small worker | Unit-tested with recorded fixtures |
| Scheduling & alerts | n8n at n8n.casepilot.io (D-002) | n8n triggers ingest functions and sends failure alerts + weekly grant digest; workflow JSON exported to `n8n/` |
| Exports | Server-side PDF and DOCX generation (D-004) | Stored in Supabase Storage with an `export_job` record |
| AI drafts | LLM via `lib/llm/` adapter (D-003) | Structured JSON output, citation validation before display |
| Build agents | Grok team + Cursor (local + Cloud Agents); Nightly Audit as a Cursor Automation | Agents never hold production credentials |

**Why ingestion code lives in the repo, not only in n8n:** code in git can be tested by QA, reviewed in PRs and read by agents. n8n stays the scheduler and messenger, which plays to its strengths.

## Data model (v1, logical)

**Reference & public data**
- `geo_county` (fips PK, name, state, population_latest)
- `source_registry` (id PK, name, owner, url, license, commercial_ok, cadence, status [active|paused], last_success_at)
- `ingest_run` (id, source_id FK, started_at, finished_at, status, rows_loaded, checksum, error)
- `public_indicator` (id, source_id, indicator_code, geo_fips, period, value, moe, unit, vintage, ingest_run_id) — long format; unique on (source_id, indicator_code, geo_fips, period, vintage)
- `need_score_config` (version, weights jsonb, created_at, approved_by) · `need_score` (version, geo_fips, score, components jsonb)

**FAS (tenant-scoped, `org_id` on every row)**
- `org` (id, name, ein, uei, state, settings jsonb)
- `case` (id uuid, org_id, referral_source, court_involved, court_order_date, referral_date, county_fips, household_size, income_band, prior_services jsonb, upload_batch_id)
- `application` (id, case_id, application_date, decision_date, decision, award_amount, family_contribution)
- `authorization` (id, application_id, service_type, provider_id, units, rate, total_authorized)
- `provider` (id, org_id, name, npi, provider_affiliated bool)
- `delivery_episode` (id, authorization_id, first_session_date, last_session_date, sessions_attended, no_shows, discharge_status, non_start_reason, dollars_paid)
- `outcome_measure` (id, case_id, measure_code, baseline_score, baseline_date, followup_score, followup_date)
- `upload_batch` (id, org_id, file_path, mapping jsonb, rows_ok, rows_error, error_report_path, status, created_by)
- `aggregate_submission` (id, org_id, period, metric_code, value, n, notes)

**Grants**
- `opportunity` (id, source [grants_gov|foundation_manual|foundation_csv], external_id, title, funder, assistance_listing, posted_date, close_date, award_floor, award_ceiling, eligibility jsonb, description, raw jsonb)
- `opportunity_criteria` (id, opportunity_id, criterion, weight_points, text, extracted_by)
- `match_result` (id, org_id, opportunity_id, score, components jsonb, flags jsonb, model_version, computed_at)
- `award_history` (id, source [usaspending|irs_990pf], funder, recipient, recipient_state, amount, fiscal_year, assistance_listing, description, raw jsonb)
- `strategy_draft` (id, org_id, opportunity_id, inputs_snapshot jsonb, output jsonb, citations jsonb, status [draft|approved|rejected], created_by, approved_by)
- `pipeline_status` (opportunity_id, org_id, status, owner, notes)

**Exports & audit**
- `export_job` (id, org_id, type, params jsonb, file_path, suppression_applied bool, created_by, created_at)
- `audit_log` (id, org_id, actor, action, entity, entity_id, at, details jsonb)

**Metrics:** SQL views per metric (`m1_court_to_first_session`, …) plus `suppress(n int, threshold int default 11)` and complementary-suppression logic used by every shared view and export.

## Environments
- **Local:** Supabase CLI + Docker, synthetic seed (`pnpm seed:synthetic`).
- **Preview:** Vercel preview per PR + Supabase preview branch/project with synthetic data.
- **Production:** real data only after Phase 6 gate; agents have no credentials here.

## Secrets
Cursor Cloud: Secrets tab (environment-scoped). Vercel: project env vars. Supabase: project secrets/vault. n8n: credentials store. Never in the repo, fixtures, logs or screenshots.

## Networking
Cursor Cloud Agents can reach private services through Tailscale or Cloudflare Tunnel. Expose only dev/preview endpoints to agents; production n8n and database stay unreachable from agent machines.
