## 2026-10-17 (UTC) — Claude Code (cloud, Engineer) — F-602b: Supabase performance advisors cleared (George: "start")
Did: Migration `20261017170000_f602b_db_performance.sql`:
- The 6 insert policies the advisor flagged (`aggregate_submission`, `application_draft`, `application_draft_edit`, `audit_log`, `export_job`, `strategy_draft`) now call `(select auth.uid())`, evaluated once per statement. Every other condition is copied unchanged from the catalog.
- 42 covering indexes, one per public foreign key that had none. Generated from `pg_constraint`, which matches the advisor's count of 42.

New `tests/db/perf-guard.test.ts` fails if any policy calls `auth.uid()/jwt()/role()` per row or any foreign key lacks a covering index. Proved by planting both on a probe table: both cases fail, naming the probe. Passes once removed.
State: lint, typecheck, unit tests, `pnpm gate` green; `supabase db reset` applies cleanly; `pnpm test:db` 20 files / 983 tests green locally (RLS matrix unchanged). Branch `f602b-db-performance` off main d2b688a; independent of #338 (its migration is 20261017160000; this one sorts after).
Left: re-run `get_advisors` (performance) on `fas-dev` once this reaches it after QA PASS.
Decisions: none new.
