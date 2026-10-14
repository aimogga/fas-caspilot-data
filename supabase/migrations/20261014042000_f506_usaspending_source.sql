-- F-506: register usaspending; award_history gets upsert keys + run provenance. RLS untouched (part 3: SELECT admin/staff, FORCE RLS, no client writes).
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f5060000-0000-4000-8000-00000000c506', 'usaspending', 'Treasury (USAspending.gov)', 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
  'USAspending.gov API, public domain, no key; subawards incomplete', true, 'monthly', 'active')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE award_history ADD COLUMN IF NOT EXISTS external_id text, ADD COLUMN IF NOT EXISTS recipient_type text, ADD COLUMN IF NOT EXISTS ingest_run_id uuid REFERENCES ingest_run(id);
CREATE UNIQUE INDEX IF NOT EXISTS award_history_source_external_id_idx ON award_history (source, external_id);
-- AC "SQL summary": count, median, range, recipient types, Utah share for one Assistance Listing. SECURITY INVOKER: callers see only RLS-visible rows.
CREATE OR REPLACE FUNCTION award_history_summary(p_assistance_listing text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object('assistance_listing', p_assistance_listing, 'count', count(*), 'median', percentile_cont(0.5) WITHIN GROUP (ORDER BY amount), 'min', min(amount), 'max', max(amount),
    'utah_share', CASE WHEN count(*) = 0 THEN NULL ELSE round(count(*) FILTER (WHERE recipient_state = 'UT')::numeric / count(*), 3) END,
    'recipient_types', COALESCE((SELECT jsonb_object_agg(t, n) FROM (SELECT COALESCE(recipient_type, 'unknown') t, count(*) n FROM award_history WHERE assistance_listing = p_assistance_listing GROUP BY 1) x), '{}'::jsonb))
  FROM award_history WHERE assistance_listing = p_assistance_listing; $$;
REVOKE EXECUTE ON FUNCTION award_history_summary(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION award_history_summary(text) TO authenticated;
