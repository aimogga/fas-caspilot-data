-- #107: census-sahie is used for FAS grant work only (D-015), never commercial or paid use.
-- Follow-up to 20261012223000_f202_census_sahie_source.sql, which is merged and left unchanged.
UPDATE source_registry SET commercial_ok = false WHERE name = 'census-sahie';
