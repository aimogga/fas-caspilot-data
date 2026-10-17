# Security review (F-602), 2026-10-17

Branch `f602-security-review`, cut from main `d2b688a`. Every check was run in a cloud session against local Supabase (migrations + seed, synthetic data only) and against `fas-dev` (`zlizvzpatfyhdydfmxef`, synthetic only) for the advisors. No production database exists.

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | RLS tests pass for every table × role | **PASS** | `pnpm test:db`: 19 files, 982 tests green. All 32 public tables have RLS **enabled and forced**, and every one has at least one policy and at least one DB test (table below). All 7 public views are `security_invoker=true`. |
| 2 | Secrets scan clean | **PASS** | `node scripts/nightly-audit.mjs --secrets-only`: 1,138 files scanned, no obvious secrets. CI `secret-scan` is green on every PR. |
| 3 | Dependency audit: no high/critical | **PASS for production, 1 dev-only high (needs George)** | `pnpm audit --prod`: 0 info / 0 low / 0 moderate / 0 high / 0 critical. `pnpm audit` (all): 1 high, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) in `braces@3.0.3` (stack exhaustion through crafted glob input). The only path is dev tooling: `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`. No patched version is published. It never ships in the app bundle, and its input is our own lint globs, not user input. |
| 4 | Supabase advisors clean | **Security: clean after this branch's migration, except 2 items for George. Performance: open (F-602b)** | `get_advisors` on `fas-dev` at 16:32 UTC, before the migration. Details below. |

## 4. Advisors on `fas-dev` (before this branch)

### Security (all WARN, no ERROR)
| Lint | Object | Action |
|---|---|---|
| 0011 function_search_path_mutable | `intake_table(text)` | **Fixed:** `SET search_path = pg_catalog` (the function reads no tables). |
| 0028 / 0029 SECURITY DEFINER callable by anon / signed-in | `app_org_id()`, `app_role()` | **Fixed:** switched to `SECURITY INVOKER`. Both only read the caller's own JWT claims (`auth.jwt()`), so they return the same values with no elevated rights. |
| 0029 SECURITY DEFINER callable by signed-in | `rls_guard_violations()` | **Fixed:** EXECUTE revoked from `authenticated`. Only the nightly audit and the DB tests call it, both with the service role. The tests now use the service role too. |
| 0029 SECURITY DEFINER callable by signed-in | `intake_rollback(uuid)` | **Accepted, by design.** Staff roll back their own uploads. The body refuses anyone who isn't admin or staff, or has no org (`42501`). It deletes only rows of a committed batch in the caller's org, and writes an `audit_log` row. Covered by `tests/db/intake-commit.test.ts`. |
| auth_leaked_password_protection | Supabase Auth | **Needs George.** A project setting (Auth → Passwords → "Prevent use of leaked passwords", checked against HaveIBeenPwned). Supabase lists it for paid plans, so it's a plan decision; not changed here. |

Migration: `supabase/migrations/20261017160000_f602_function_hardening.sql` (forward-only; no table or policy change). It applies cleanly on `supabase db reset`. Catalog after the migration: `app_org_id`/`app_role` `secdef=false`; `intake_table` `search_path=pg_catalog`; `rls_guard_violations` is not executable by anon or authenticated.

### Performance (not security; follow-up F-602b)
- **0003 auth_rls_initplan (WARN, 6):** insert policies on `export_job`, `audit_log`, `aggregate_submission`, `application_draft`, `application_draft_edit`, `strategy_draft` call `auth.<fn>()` per row. Fix: wrap it as `(select auth.<fn>())`.
- **0001 unindexed_foreign_keys (INFO, 42):** mostly `org_id`, `upload_batch_id` and `ingest_run_id` foreign keys. Data volumes are small today; index them in the same follow-up.

## 1. RLS coverage, table by table
RLS = enabled and forced; Pol = policy count; Tests = `tests/db/` files that exercise the table. `rls.test.ts` is the matrix: 8 actors (anon, admin, staff, board_viewer, other org, other-org admin, no role, org with no role) × select/insert/update/delete.

| Table | RLS | Pol | Tests |
|---|---|---|---|
| aggregate_submission | ✓ | 4 | rls |
| application | ✓ | 4 | rls, metrics-views |
| application_draft | ✓ | 3 | application-draft (staff, admin, board, other org, other-org admin, anon read; anon write added here) |
| application_draft_edit | ✓ | 2 | application-draft (append-only for everyone; anon read and write added here) |
| audit_log | ✓ | 2 | rls, intake-commit |
| authorization | ✓ | 4 | rls, metrics-views |
| award_abstract | ✓ | 1 | award-abstract (admin, staff, board, anon; no client writes) |
| award_history | ✓ | 1 | rls, award-abstract, propublica-load, usaspending-load |
| case | ✓ | 4 | rls, intake-commit, metrics-views |
| delivery_episode | ✓ | 4 | rls, metrics-views |
| export_job | ✓ | 2 | rls |
| fas_service_county | ✓ | 1 | rls |
| geo_county | ✓ | 1 | rls |
| ingest_run | ✓ | 1 | rls + every *-load test |
| llm_quota | ✓ | 1 | llm-quota (no anon or authenticated grant; service role only) |
| match_config | ✓ | 1 | rls |
| match_result | ✓ | 4 | rls |
| need_score | ✓ | 1 | rls |
| need_score_config | ✓ | 1 | rls |
| opportunity | ✓ | 2 | rls, award-abstract, grants-gov-load |
| opportunity_criteria | ✓ | 1 | rls |
| org | ✓ | 2 | rls + 5 others |
| org_knowledge | ✓ | 3 | org-knowledge (admin, staff, board, other org, anon), knowledge-import |
| org_knowledge_version | ✓ | 1 | org-knowledge, knowledge-import |
| outcome_measure | ✓ | 4 | rls, metrics-views |
| pipeline_status | ✓ | 4 | rls |
| provider | ✓ | 4 | rls, intake-commit, metrics-views |
| public_indicator | ✓ | 1 | rls + every indicator load test |
| recipient_profile | ✓ | 1 | rls |
| source_registry | ✓ | 1 | rls + load tests |
| strategy_draft | ✓ | 4 | rls, strategy-draft, application-draft |
| upload_batch | ✓ | 4 | rls, intake-commit, metrics-views |

Views (all `security_invoker=true`, so they run under the caller's RLS): `m1_court_to_first_session`, `m1_summary_shared`, `m2_application_to_decision`, `m3_never_started`, `m4_completion_by_income_band_shared`, `m4_m5_m6_episodes`, `m6_dollars_by_provider_group_shared`.

## Decisions for George (human gate: george-before-merge)
1. **Accept the dev-only `braces` high** until `fast-glob`/`micromatch` publish a fix (recommended), or block on it. It can't reach production; the nightly audit flags new high/critical dependencies.
2. **Leaked password protection:** turn it on in Supabase Auth if the plan allows (recommended before real FAS users sign in, F-604).
3. **Merge this branch's migration**, which clears the function advisors. It reaches `fas-dev` and later production through the normal QA PASS path (D-014).
