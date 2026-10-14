-- F-507: register propublica_990; award_history upsert keys + run provenance (same guarded DDL as F-506, so either PR can land first). RLS untouched (part 3: SELECT admin/staff via award_history_sel, FORCE RLS, no client write policy; service role loads).
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f5070000-0000-4000-8000-00000000c507', 'propublica_990', 'ProPublica (Nonprofit Explorer)', 'https://projects.propublica.org/nonprofits/api/v2/search.json',
  'ProPublica Nonprofit Explorer API; free; ProPublica Data Terms of Use: no SEO/ad-driven republishing; attribution required', false, 'quarterly', 'active')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE award_history ADD COLUMN IF NOT EXISTS external_id text, ADD COLUMN IF NOT EXISTS ingest_run_id uuid REFERENCES ingest_run(id);
CREATE UNIQUE INDEX IF NOT EXISTS award_history_source_external_id_idx ON award_history (source, external_id);
