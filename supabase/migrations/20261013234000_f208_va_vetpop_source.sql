-- F-208: register va-vetpop (VetPop2023 county, Socrata jrjd-qghv, CC0). No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2080000-0000-4000-8000-00000000c208', 'va-vetpop', 'VA', 'https://www.data.va.gov/resource/jrjd-qghv', 'CC0', true, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner, license = EXCLUDED.license, commercial_ok = EXCLUDED.commercial_ok;
