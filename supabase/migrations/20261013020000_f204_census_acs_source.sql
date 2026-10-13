-- F-204: register census-acs. No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('a5a5a5a5-0204-4204-8204-a5a5a5a5a5a5', 'census-acs', 'Census', 'https://api.census.gov/data/acs/acs5', 'public-domain', true, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner;
