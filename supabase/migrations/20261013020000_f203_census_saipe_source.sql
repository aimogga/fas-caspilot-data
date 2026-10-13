-- F-203: register census-saipe. No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2030000-0000-4000-8000-00000000c203', 'census-saipe', 'Census', 'https://api.census.gov/data/timeseries/poverty/saipe', 'public-domain', false, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner, commercial_ok = EXCLUDED.commercial_ok;
