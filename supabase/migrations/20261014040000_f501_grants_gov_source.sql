-- F-501: register grants_gov (Simpler.Grants.gov API). No new table; opportunity RLS (part 3: SELECT admin/staff, FORCE RLS, no client writes) untouched.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f5010000-0000-4000-8000-00000000c501', 'grants_gov', 'HHS (Simpler.Grants.gov)', 'https://api.simpler.grants.gov/v1/opportunities/search',
  'Simpler.Grants.gov API terms; free key; 60/min 10,000/day; keep key active (unused 30 days = disabled)', true, 'weekly', 'active')
ON CONFLICT (id) DO NOTHING;
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_source_external_id_idx ON opportunity (source, external_id);
ALTER TABLE opportunity ADD COLUMN IF NOT EXISTS ingest_run_id uuid REFERENCES ingest_run(id);
