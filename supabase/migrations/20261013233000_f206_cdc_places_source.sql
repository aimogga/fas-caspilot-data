-- F-206: register cdc-places (PLACES county release, Socrata swc5-untb). No new table; source_registry RLS stays deny-by-default.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2060000-0000-4000-8000-00000000c206', 'cdc-places', 'CDC', 'https://data.cdc.gov/resource/swc5-untb', 'public-domain', true, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url, name = EXCLUDED.name, owner = EXCLUDED.owner, commercial_ok = EXCLUDED.commercial_ok;
