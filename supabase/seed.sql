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
