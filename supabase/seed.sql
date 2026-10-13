-- Local synthetic users for F-101 e2e. Password: testpass123
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  u.email, crypt('testpass123', gen_salt('bf')), now(),
  jsonb_strip_nulls(jsonb_build_object('role', u.role, 'org_id', u.org_id)), '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
FROM (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@example.test', 'admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'staff@example.test', 'staff', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'board@example.test', 'board_viewer', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'other@example.test', 'staff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'other-admin@example.test', 'admin', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  ('66666666-6666-6666-6666-666666666666'::uuid, 'norole@example.test', null, null),
  ('77777777-7777-7777-7777-777777777777'::uuid, 'org-norole@example.test', null, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
) AS u(id, email, role, org_id);

INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
FROM auth.users
WHERE email LIKE '%@example.test';

INSERT INTO geo_county (fips, name, state, population_latest) VALUES
  ('49035', 'Salt Lake', 'UT', 1181857), ('49049', 'Utah', 'UT', 702100);
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'census-sahie', 'Census', 'https://api.census.gov/data/timeseries/healthins/sahie', 'public-domain', true, 'annual', 'active')
ON CONFLICT (id) DO UPDATE SET url = EXCLUDED.url;
INSERT INTO ingest_run (id, source_id, status, rows_loaded, checksum) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ok', 1, 'abc');
INSERT INTO public_indicator (source_id, indicator_code, geo_fips, period, value, unit, vintage, ingest_run_id) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'uninsured', '49035', '2023', 0.1, 'rate', '2023', 'dddddddd-dddd-dddd-dddd-dddddddddddd');
INSERT INTO need_score_config (version, weights) VALUES ('v1', '{"uninsured":1}');
INSERT INTO need_score (version, geo_fips, score, components) VALUES ('v1', '49035', 0, '{}');
INSERT INTO org (id, name, ein, uei, state) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'FAS Synthetic', '00-0000001', 'UEIFAS0001', 'UT'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other Synthetic', '00-0000002', 'UEIOTH0002', 'UT');
INSERT INTO upload_batch (id, org_id, file_path, mapping, rows_ok, rows_error, status) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '/synthetic/a.csv', '{}', 1, 0, 'ok'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '/synthetic/b.csv', '{}', 1, 0, 'ok');
INSERT INTO provider (id, org_id, name, npi, provider_affiliated) VALUES
  ('ffffffff-ffff-ffff-ffff-fffffffffff1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Synth Prov A', '0000000001', true),
  ('ffffffff-ffff-ffff-ffff-fffffffffff2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Synth Prov B', '0000000002', false);
INSERT INTO "case" (id, org_id, referral_source, court_involved, court_order_date, referral_date, county_fips, household_size, income_band, prior_services, upload_batch_id) VALUES
  ('88888888-8888-8888-8888-888888888881', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'court', true, '2024-01-15', '2024-01-01', '49035', 3, 'a', '[]', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'),
  ('88888888-8888-8888-8888-888888888882', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'self', false, null, '2024-02-01', '49049', 2, 'b', '[]', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2');
INSERT INTO application (id, org_id, case_id, application_date, decision, award_amount, family_contribution) VALUES
  ('99999999-9999-9999-9999-999999999991', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888881', '2024-01-10', 'approved', 1, 0),
  ('99999999-9999-9999-9999-999999999992', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888882', '2024-02-10', 'approved', 1, 0);
INSERT INTO "authorization" (id, org_id, application_id, service_type, provider_id, units, rate, total_authorized) VALUES
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999991', 'therapy', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 1, 1, 1),
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999992', 'therapy', 'ffffffff-ffff-ffff-ffff-fffffffffff2', 1, 1, 1);
INSERT INTO delivery_episode (id, org_id, authorization_id, sessions_attended, no_shows, discharge_status, dollars_paid) VALUES
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a1', 1, 0, 'done', 1),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a2', 1, 0, 'done', 1);
INSERT INTO outcome_measure (id, org_id, case_id, measure_code, baseline_score, baseline_date) VALUES
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888881', 'syn', 1, '2024-01-01'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '88888888-8888-8888-8888-888888888882', 'syn', 1, '2024-02-01');
INSERT INTO aggregate_submission (id, org_id, period, metric_code, value, n, notes) VALUES
  ('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-Q1', 'm1', 1, 20, 'n'),
  ('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-Q1', 'm1', 1, 20, 'n');
INSERT INTO opportunity (id, source, external_id, title, funder, assistance_listing, eligibility, description, raw) VALUES
  ('10101010-1010-1010-1010-101010101010', 'grants_gov', 'syn-opp-1', 'Synth Opp', 'HHS', '93.958', '{}', 'd', '{}');
INSERT INTO opportunity_criteria (id, opportunity_id, criterion, weight_points, "text", extracted_by) VALUES
  ('20202020-2020-2020-2020-202020202020', '10101010-1010-1010-1010-101010101010', 'mission', 1, 't', 'syn');
INSERT INTO award_history (id, source, funder, recipient, recipient_state, amount, fiscal_year, description, raw) VALUES
  ('30303030-3030-3030-3030-303030303030', 'usaspending', 'HHS', 'Synth Recip', 'UT', 1, 2024, 'syn', '{}');
INSERT INTO match_result (id, org_id, opportunity_id, score, components, flags, model_version) VALUES
  ('40404040-4040-4040-4040-404040404041', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101010', 1, '{}', '{}', 'v1'),
  ('40404040-4040-4040-4040-404040404042', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '10101010-1010-1010-1010-101010101010', 1, '{}', '{}', 'v1');
INSERT INTO strategy_draft (id, org_id, opportunity_id, inputs_snapshot, output, citations, status, created_by) VALUES
  ('50505050-5050-5050-5050-505050505051', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101010', '{}', '{}', '{}', 'draft', '11111111-1111-1111-1111-111111111111'),
  ('50505050-5050-5050-5050-505050505052', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '10101010-1010-1010-1010-101010101010', '{}', '{}', '{}', 'draft', '55555555-5555-5555-5555-555555555555');
INSERT INTO pipeline_status (opportunity_id, org_id, status, owner, notes) VALUES
  ('10101010-1010-1010-1010-101010101010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'watch', 'a', 'n'),
  ('10101010-1010-1010-1010-101010101010', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'watch', 'b', 'n');
INSERT INTO export_job (id, org_id, type, params, file_path, suppression_applied, created_by) VALUES
  ('60606060-6060-6060-6060-606060606061', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pdf', '{}', '/synthetic/a.pdf', true, '11111111-1111-1111-1111-111111111111'),
  ('60606060-6060-6060-6060-606060606062', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pdf', '{}', '/synthetic/b.pdf', true, '55555555-5555-5555-5555-555555555555');
INSERT INTO audit_log (id, org_id, actor, action, entity, details) VALUES
  ('70707070-7070-7070-7070-707070707071', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'seed', 'org', '{}'),
  ('70707070-7070-7070-7070-707070707072', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'seed', 'org', '{}');

-- F-211 DS-06a: synthetic need scores, local/CI only (never hosted). 26 scored incl. one tie (Davis = Cache), 3 not published.
INSERT INTO geo_county (fips, name, state) VALUES
  ('49001', 'Beaver', 'UT'), ('49003', 'Box Elder', 'UT'), ('49005', 'Cache', 'UT'), ('49007', 'Carbon', 'UT'), ('49009', 'Daggett', 'UT'),
  ('49011', 'Davis', 'UT'), ('49013', 'Duchesne', 'UT'), ('49015', 'Emery', 'UT'), ('49017', 'Garfield', 'UT'), ('49019', 'Grand', 'UT'),
  ('49021', 'Iron', 'UT'), ('49023', 'Juab', 'UT'), ('49025', 'Kane', 'UT'), ('49027', 'Millard', 'UT'), ('49029', 'Morgan', 'UT'),
  ('49031', 'Piute', 'UT'), ('49033', 'Rich', 'UT'), ('49035', 'Salt Lake', 'UT'), ('49037', 'San Juan', 'UT'), ('49039', 'Sanpete', 'UT'),
  ('49041', 'Sevier', 'UT'), ('49043', 'Summit', 'UT'), ('49045', 'Tooele', 'UT'), ('49047', 'Uintah', 'UT'), ('49049', 'Utah', 'UT'),
  ('49051', 'Wasatch', 'UT'), ('49053', 'Washington', 'UT'), ('49055', 'Wayne', 'UT'), ('49057', 'Weber', 'UT')
ON CONFLICT (fips) DO NOTHING;
INSERT INTO need_score_config (version, weights, created_at, approved_by) VALUES
  ('v2-synthetic', '{"uninsured":1}', '2026-10-01', '00000000-0000-4000-8000-000000000211'), ('v3-draft', '{"uninsured":2}', '2026-10-10', NULL);
INSERT INTO need_score (version, geo_fips, score, components)
  SELECT 'v2-synthetic', fips, round(((substr(fips, 3)::int * 7) % 29 - 14) / 10.0, 2), '{}' FROM geo_county WHERE fips LIKE '49%' AND fips NOT IN ('49009', '49031', '49055');
UPDATE need_score SET score = (SELECT score FROM need_score WHERE version = 'v2-synthetic' AND geo_fips = '49005') WHERE version = 'v2-synthetic' AND geo_fips = '49011';
INSERT INTO need_score (version, geo_fips, score, components) VALUES ('v3-draft', '49009', 9, '{}');
