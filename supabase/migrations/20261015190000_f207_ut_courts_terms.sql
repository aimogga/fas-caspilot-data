-- F-207: the Utah AOC confirmed by email (courtdatarequest@utcourts.gov → Krystle Smith, CasePilot, 2026-10-15) that there are no
-- restrictions on the public "Yearly Filing Counts" data file. Record the terms on the registry row; no schema change, RLS unchanged.
UPDATE source_registry
SET license = 'public records; AOC confirmed no restrictions on the public data file (courtdatarequest@utcourts.gov reply, 2026-10-15)',
    commercial_ok = true
WHERE name = 'ut_courts';
