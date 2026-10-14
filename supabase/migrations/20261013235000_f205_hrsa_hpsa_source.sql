-- F-205: register hrsa-hpsa-mh. No new table; source_registry RLS stays deny-by-default. Scheduled monthly although HRSA refreshes daily.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2050000-0000-4000-8000-00000000c205', 'hrsa-hpsa-mh', 'HRSA', 'https://data.hrsa.gov/topics/health-workforce/shortage-areas', 'public-domain', true, 'monthly', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner, commercial_ok = EXCLUDED.commercial_ok, cadence = EXCLUDED.cadence;
