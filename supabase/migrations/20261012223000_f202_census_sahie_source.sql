-- F-202: register census-sahie. No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'census-sahie', 'Census', 'https://api.census.gov/data/timeseries/healthins/sahie', 'public-domain', true, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner;
