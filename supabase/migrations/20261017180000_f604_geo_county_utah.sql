-- F-604: the 29 Utah counties are reference data every environment needs. Until now only seed.sql and the synthetic
-- generator inserted them, so a fresh production project (which never runs the seed) had none and every intake
-- county check failed. Public Census FIPS codes and names; population_latest stays as the ingests set it.
INSERT INTO public.geo_county (fips, name, state) VALUES
  ('49001', 'Beaver', 'UT'),
  ('49003', 'Box Elder', 'UT'),
  ('49005', 'Cache', 'UT'),
  ('49007', 'Carbon', 'UT'),
  ('49009', 'Daggett', 'UT'),
  ('49011', 'Davis', 'UT'),
  ('49013', 'Duchesne', 'UT'),
  ('49015', 'Emery', 'UT'),
  ('49017', 'Garfield', 'UT'),
  ('49019', 'Grand', 'UT'),
  ('49021', 'Iron', 'UT'),
  ('49023', 'Juab', 'UT'),
  ('49025', 'Kane', 'UT'),
  ('49027', 'Millard', 'UT'),
  ('49029', 'Morgan', 'UT'),
  ('49031', 'Piute', 'UT'),
  ('49033', 'Rich', 'UT'),
  ('49035', 'Salt Lake', 'UT'),
  ('49037', 'San Juan', 'UT'),
  ('49039', 'Sanpete', 'UT'),
  ('49041', 'Sevier', 'UT'),
  ('49043', 'Summit', 'UT'),
  ('49045', 'Tooele', 'UT'),
  ('49047', 'Uintah', 'UT'),
  ('49049', 'Utah', 'UT'),
  ('49051', 'Wasatch', 'UT'),
  ('49053', 'Washington', 'UT'),
  ('49055', 'Wayne', 'UT'),
  ('49057', 'Weber', 'UT')
ON CONFLICT (fips) DO UPDATE SET name = EXCLUDED.name, state = EXCLUDED.state;
