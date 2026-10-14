-- F-207: register ut_courts (AOC filings workbook). No new table; source_registry RLS stays deny-by-default. commercial_ok stays false until the AOC confirms reuse terms.
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status)
VALUES ('f2070000-0000-4000-8000-00000000c207', 'ut_courts', 'Utah State Courts (AOC)', 'https://www.utcourts.gov/en/court-records-publications/publications/court-statistics.html', 'public records; bulk reuse terms unverified', false, 'annual', 'active')
ON CONFLICT (id) DO NOTHING;
