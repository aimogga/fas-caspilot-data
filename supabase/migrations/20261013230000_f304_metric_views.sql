-- F-304 part 2 / F-306: SQL views for M1–M6 (docs/PRD.md §C3) plus suppress() (docs/PRIVACY_AND_COMPLIANCE.md rule 4).
-- Definitions mirror lib/metrics/compute.ts; tests/golden/metrics.json pins both (tests/db/metrics-views.test.ts).
-- Every view is WITH (security_invoker = true): the F-102 org RLS on the base tables applies to the caller, so no
-- extra policies or grants are needed, and rls_guard_violations() (F-102 part 3) rejects any other public view.

-- Small-cell rule: a count below the threshold is hidden; a rate is hidden when either side is hidden.
CREATE OR REPLACE FUNCTION suppress(n integer, threshold integer DEFAULT 11) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$ SELECT CASE WHEN n IS NULL OR n < threshold THEN NULL ELSE n END $$;
CREATE OR REPLACE FUNCTION suppress_rate(num integer, den integer, threshold integer DEFAULT 11) RETURNS numeric
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$ SELECT CASE WHEN num IS NULL OR den IS NULL OR num < threshold OR den < threshold THEN NULL
  ELSE round(num::numeric / den, 4) END $$;
GRANT EXECUTE ON FUNCTION suppress(integer, integer), suppress_rate(integer, integer, integer) TO authenticated;
COMMENT ON FUNCTION suppress(integer, integer) IS 'F-306: NULL when n < threshold (default 11), else n.';
COMMENT ON FUNCTION suppress_rate(integer, integer, integer) IS 'F-306: NULL when num or den < threshold, else round(num/den, 4).';

-- ---------------------------------------------------------------------------------------------------------------
-- Base views: one row per unit, per org, with the case fields the PRD filters need (county, referral source, date).
-- ---------------------------------------------------------------------------------------------------------------

-- PRD C3 row M1: court-involved cases with a court_order_date. First session = earliest first_session_date over the
-- case's episodes (case → application → authorization → delivery_episode); days is NULL and still_waiting while none.
CREATE VIEW m1_court_to_first_session WITH (security_invoker = true) AS
WITH first_session AS (
  SELECT a.case_id, min(e.first_session_date) AS first_session_date
  FROM delivery_episode e
  JOIN "authorization" z ON z.id = e.authorization_id
  JOIN application a ON a.id = z.application_id
  GROUP BY a.case_id)
SELECT c.org_id, c.id AS case_id, c.county_fips, c.referral_source, c.court_order_date, f.first_session_date,
  f.first_session_date - c.court_order_date AS days, f.first_session_date IS NULL AS still_waiting
FROM "case" c
LEFT JOIN first_session f ON f.case_id = c.id
WHERE c.court_involved AND c.court_order_date IS NOT NULL;
COMMENT ON VIEW m1_court_to_first_session IS 'M1: days from court order to first session, one row per court-involved case.';

-- PRD C3 row M2: application → decision. days is NULL until decided; callers summarise the non-null days.
CREATE VIEW m2_application_to_decision WITH (security_invoker = true) AS
SELECT a.org_id, a.id AS application_id, a.case_id, c.county_fips, c.referral_source, a.application_date,
  a.decision_date, a.decision_date - a.application_date AS days
FROM application a
JOIN "case" c ON c.id = a.case_id;
COMMENT ON VIEW m2_application_to_decision IS 'M2: days from application to funding decision, one row per application.';

-- PRD C3 row M3: approved (decision = 'approved') and decided applications. started_within_window = earliest
-- first_session_date within 60 days of the decision (PRD default). non_start_reason: smallest non-null reason among
-- the application's episodes, else 'unknown'; NULL once started.
CREATE VIEW m3_never_started WITH (security_invoker = true) AS
WITH ep AS (
  SELECT z.application_id, min(e.first_session_date) AS first_session_date, min(e.non_start_reason) AS reason
  FROM delivery_episode e
  JOIN "authorization" z ON z.id = e.authorization_id
  GROUP BY z.application_id),
app AS (
  SELECT a.org_id, a.id AS application_id, a.case_id, c.county_fips, c.referral_source, a.decision_date,
    coalesce(ep.first_session_date - a.decision_date <= 60, false) AS started_within_window, ep.reason
  FROM application a
  JOIN "case" c ON c.id = a.case_id
  LEFT JOIN ep ON ep.application_id = a.id
  WHERE a.decision = 'approved' AND a.decision_date IS NOT NULL)
SELECT org_id, application_id, case_id, county_fips, referral_source, decision_date, started_within_window,
  CASE WHEN started_within_window THEN NULL ELSE coalesce(reason, 'unknown') END AS non_start_reason
FROM app;
COMMENT ON VIEW m3_never_started IS 'M3: approved applications and whether a first session happened within 60 days.';

-- PRD C3 rows M4, M5, M6: one row per delivery episode with its case, authorization and provider context.
-- completed = discharge_status = 'completed'; closed = any non-null discharge_status (M4). dollars_paid feeds M5/M6.
-- provider_affiliated via authorization.provider_id (false when no provider). anchor_date is the date-filter key.
CREATE VIEW m4_m5_m6_episodes WITH (security_invoker = true) AS
SELECT e.org_id, e.id AS episode_id, a.case_id, c.county_fips, c.referral_source, c.income_band, e.discharge_status,
  coalesce(e.discharge_status = 'completed', false) AS completed, e.discharge_status IS NOT NULL AS closed,
  e.dollars_paid, coalesce(p.provider_affiliated, false) AS provider_affiliated, z.rate, z.units,
  coalesce(e.last_session_date, e.first_session_date) AS anchor_date
FROM delivery_episode e
JOIN "authorization" z ON z.id = e.authorization_id
JOIN application a ON a.id = z.application_id
JOIN "case" c ON c.id = a.case_id
LEFT JOIN provider p ON p.id = z.provider_id;
COMMENT ON VIEW m4_m5_m6_episodes IS 'M4–M6: one row per delivery episode with case, authorization and provider context.';

-- ---------------------------------------------------------------------------------------------------------------
-- Shared views (board, exports): per-cell suppression only. Complementary suppression of band tables stays in
-- lib/metrics/suppress.ts (TS) for now; these views enforce the per-cell rule (F-306).
-- ---------------------------------------------------------------------------------------------------------------

-- M4 per income band (NULL band → 'unknown'): completed, closed and completed ÷ closed.
CREATE VIEW m4_completion_by_income_band_shared WITH (security_invoker = true) AS
WITH band AS (
  SELECT org_id, coalesce(income_band, 'unknown') AS income_band,
    (count(*) FILTER (WHERE completed))::int AS completed, (count(*) FILTER (WHERE closed))::int AS closed
  FROM m4_m5_m6_episodes
  GROUP BY org_id, coalesce(income_band, 'unknown'))
SELECT org_id, income_band, suppress(completed) AS completed, suppress(closed) AS closed,
  suppress_rate(completed, closed) AS rate
FROM band;
COMMENT ON VIEW m4_completion_by_income_band_shared IS 'M4 shared: completion by income band, cells < 11 hidden.';

-- M6 per provider group: dollars paid and episodes; avg_rate_per_unit = Σ(rate × units) ÷ Σ units over the group's
-- authorizations (PRIVACY rule 7). dollars and the rate are hidden together with a hidden episode count.
CREATE VIEW m6_dollars_by_provider_group_shared WITH (security_invoker = true) AS
WITH grp AS (
  SELECT org_id, CASE WHEN provider_affiliated THEN 'affiliated' ELSE 'other' END AS provider_group,
    (count(*))::int AS n, sum(coalesce(dollars_paid, 0)) AS dollars,
    sum(coalesce(units, 0) * coalesce(rate, 0)) AS weighted, sum(coalesce(units, 0)) AS units
  FROM m4_m5_m6_episodes
  GROUP BY org_id, provider_affiliated)
SELECT org_id, provider_group, CASE WHEN suppress(n) IS NOT NULL THEN dollars END AS dollars, suppress(n) AS episodes,
  CASE WHEN suppress(n) IS NOT NULL AND units > 0 THEN round(weighted / units, 4) END AS avg_rate_per_unit
FROM grp;
COMMENT ON VIEW m6_dollars_by_provider_group_shared IS 'M6 shared: dollars and avg rate per unit by provider group.';

-- M1 per org: n = cases with a first session; percentiles by linear interpolation (percentile_cont, as compute.ts);
-- still_waiting_share = still waiting ÷ court cases with an order date.
CREATE VIEW m1_summary_shared WITH (security_invoker = true) AS
WITH s AS (
  SELECT org_id, (count(days))::int AS n, (count(*))::int AS ordered, (count(*) FILTER (WHERE still_waiting))::int AS waiting,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY days::double precision) AS median,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY days::double precision) AS p25,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY days::double precision) AS p75
  FROM m1_court_to_first_session
  GROUP BY org_id)
SELECT org_id, suppress(n) AS n,
  CASE WHEN suppress(n) IS NOT NULL THEN round(median::numeric, 4) END AS median_days,
  CASE WHEN suppress(n) IS NOT NULL THEN round(p25::numeric, 4) END AS p25_days,
  CASE WHEN suppress(n) IS NOT NULL THEN round(p75::numeric, 4) END AS p75_days,
  suppress_rate(waiting, ordered) AS still_waiting_share
FROM s;
COMMENT ON VIEW m1_summary_shared IS 'M1 shared: n, median/p25/p75 days and still-waiting share, cells < 11 hidden.';
