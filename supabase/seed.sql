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
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'census-sahie', 'Census', 'https://example.test/sahie', 'public-domain', true, 'annual', 'active');
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
