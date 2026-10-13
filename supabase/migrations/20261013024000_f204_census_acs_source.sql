-- F-204: register census-acs. No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2040000-0000-4000-8000-00000000c204', 'census-acs', 'Census', 'https://api.census.gov/data/YYYY/acs/acs5', 'public-domain', false, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner, commercial_ok = EXCLUDED.commercial_ok;
