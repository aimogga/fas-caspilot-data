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
-- DS-05 synthetic sources: one Stale (monthly, 60 days since success) and one Failed (latest run failed after the last success).
INSERT INTO source_registry (id, name, owner, url, license, commercial_ok, cadence, status, last_success_at) VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'example-monthly-source', 'Example owner', 'https://example.test/monthly', 'public-domain', true, 'monthly', 'active', now() - interval '60 days'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'example-failed-source', 'Example owner', 'https://example.test/quarterly', 'public-domain', true, 'quarterly', 'active', now() - interval '10 days')
ON CONFLICT (id) DO NOTHING;
INSERT INTO ingest_run (id, source_id, status, started_at, finished_at, rows_loaded, checksum, error) VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'failed', now() - interval '1 day', now() - interval '1 day', 0, 'syn-fail', 'synthetic failure')
ON CONFLICT (id) DO NOTHING;
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
-- DS-07c (F-401, F-305, F-306): synthetic FAS rows dated in the latest complete quarter (relative to now()) so the team
-- dashboard shows M4 complementary suppression, both M6 group rates and O1 rows. Income bands: a 12/14 (affiliated),
-- b 11/12 (other), c 2/3 (affiliated) -> band c hidden, band b hidden to protect it, total 25/29 shown. All values synthetic.
INSERT INTO "case" (id, org_id, referral_source, court_involved, referral_date, county_fips, household_size, income_band, prior_services, upload_batch_id)
SELECT b.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'self', false, (date_trunc('quarter', now()) - interval '56 days')::date, '49049', 3, b.band, '[]', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1'
FROM (VALUES ('88888888-8888-8888-8888-8888888888a1'::uuid, 'a'), ('88888888-8888-8888-8888-8888888888a2', 'b'), ('88888888-8888-8888-8888-8888888888a3', 'c')) AS b(id, band);
INSERT INTO application (id, org_id, case_id, application_date, decision, decision_date, award_amount, family_contribution)
SELECT a.id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', a.case_id, (date_trunc('quarter', now()) - interval '51 days')::date, 'approved', (date_trunc('quarter', now()) - interval '46 days')::date, 1, 0
FROM (VALUES ('99999999-9999-9999-9999-9999999999a1'::uuid, '88888888-8888-8888-8888-8888888888a1'::uuid), ('99999999-9999-9999-9999-9999999999a2', '88888888-8888-8888-8888-8888888888a2'),
  ('99999999-9999-9999-9999-9999999999a3', '88888888-8888-8888-8888-8888888888a3')) AS a(id, case_id);
INSERT INTO "authorization" (id, org_id, application_id, service_type, provider_id, units, rate, total_authorized) VALUES
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-9999999999a1', 'therapy', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 2, 120, 240),
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-9999999999a2', 'therapy', NULL, 2, 90, 180),
  ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-9999999999a3', 'therapy', 'ffffffff-ffff-ffff-ffff-fffffffffff1', 2, 120, 240);
INSERT INTO delivery_episode (org_id, authorization_id, first_session_date, last_session_date, sessions_attended, no_shows, discharge_status, dollars_paid)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', z.id, q.last_day - 30, q.last_day, 2, 0, CASE WHEN i <= z.completed THEN 'completed' ELSE 'dropped' END, 100
FROM (VALUES ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b1'::uuid, 14, 12), ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b2', 12, 11), ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0b3', 3, 2)) AS z(id, n, completed),
  generate_series(1, z.n) AS i, (SELECT (date_trunc('quarter', now()) - interval '1 day')::date AS last_day) AS q;
-- O1: 12 PHQ-9 pairs (changes -1, -2, -3, 0 repeating: mean -1.5, 9 of 12 improved) and 3 GAD-7 pairs (hidden, n < 11).
INSERT INTO outcome_measure (org_id, case_id, measure_code, baseline_score, baseline_date, followup_score, followup_date)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ('88888888-8888-8888-8888-8888888888a' || (1 + i % 3))::uuid, m.code, 12, q.last_day - 60, 12 - (i % 4), q.last_day - 20
FROM (VALUES ('PHQ-9', 12), ('GAD-7', 3)) AS m(code, n), generate_series(1, m.n) AS i, (SELECT (date_trunc('quarter', now()) - interval '1 day')::date AS last_day) AS q;
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
INSERT INTO strategy_draft (id, org_id, opportunity_id, snapshot, output, citation_report, status, created_by) VALUES
  ('50505050-5050-5050-5050-505050505051', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101010', '{}', '{}', '{}', 'DRAFT', '11111111-1111-1111-1111-111111111111'),
  ('50505050-5050-5050-5050-505050505052', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '10101010-1010-1010-1010-101010101010', '{}', '{}', '{}', 'DRAFT', '55555555-5555-5555-5555-555555555555');
INSERT INTO pipeline_status (opportunity_id, org_id, status, owner, notes) VALUES
  ('10101010-1010-1010-1010-101010101010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'watch', 'a', 'n'),
  ('10101010-1010-1010-1010-101010101010', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'watch', 'b', 'n');
INSERT INTO opportunity (id, source, external_id, title, funder, posted_date, close_date, eligibility, description, raw) VALUES
  ('10101010-1010-1010-1010-101010101011', 'foundation_manual', 'syn-manual-1', 'Synthetic Family Fund', 'Synthetic Foundation', '2026-10-01', '2027-03-01', '{}', 'd', '{}');
INSERT INTO pipeline_status (opportunity_id, org_id, status, owner, notes) VALUES
  ('10101010-1010-1010-1010-101010101011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pursuing', 'a', 'n'),
  ('10101010-1010-1010-1010-101010101011', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pursuing', 'b', 'n');
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



-- F-504: synthetic approved match config + scored open opportunities, local/CI only (fas-dev gets only the unapproved v0-draft from the migration).
INSERT INTO match_config (id, weights, params, created_at, approved_by, approved_at) VALUES
  ('v0-synthetic-test', '{"mission_fit":0.30,"eligibility_certainty":0.20,"evidence_readiness":0.15,"award_size_fit":0.15,"geography":0.10,"effort_vs_time":0.10}',
   '{"prep_days":30,"themes_for_full_credit":3,"evidence_available":[]}', '2026-10-02', '11111111-1111-1111-1111-111111111111', '2026-10-02') ON CONFLICT (id) DO NOTHING;
INSERT INTO opportunity (id, source, external_id, title, funder, close_date, award_floor, award_ceiling, eligibility, description, raw) VALUES
  ('10101010-1010-1010-1010-101010101012', 'grants_gov', 'syn-opp-2', 'Family Therapy Access Grants (synthetic)', 'Synthetic Agency for Families', '2027-12-15', 50000, 200000,
   '{"applicant_types":["nonprofits_non_higher_education_with_501c3"],"is_cost_sharing":false,"funding_categories":["health"]}', 'Supports community mental health therapy for court-involved families in Utah.', '{}'),
  ('10101010-1010-1010-1010-101010101013', 'grants_gov', 'syn-opp-4', 'State Child Welfare Block Grant (synthetic)', 'Synthetic Agency for Families', '2027-10-31', 100000, 500000,
   '{"applicant_types":["state_governments"],"is_cost_sharing":false,"funding_categories":["income_security_and_social_services"]}', 'Block grant for state child welfare agencies.', '{}');
-- components/flags below were produced by lib/grants/score.ts (synthetic profile, computed 2026-10-02); the panel renders these stored strings.
INSERT INTO match_result (id, org_id, opportunity_id, score, config_id, model_version, computed_at, flags, components) VALUES
  ('40404040-4040-4040-4040-404040404051', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101012', 100, 'v0-synthetic-test', 'v0-synthetic-test', '2026-10-02T12:00:00Z',
   '{"eligible":true,"flags":[]}', '[
    {"key":"mission_fit","label":"Mission fit","weight":0.3,"value":1,"points":30,"max":30,"reason":"Matched 3 of 5 configured themes: therapy (description), mental health (description), court-involved families (description)","source_refs":["org.program_themes","opportunity.description"]},
    {"key":"eligibility_certainty","label":"Eligibility certainty","weight":0.2,"value":1,"points":20,"max":20,"reason":"10 of 10 eligibility checks passed, 0 flagged, 0 could not be checked","source_refs":["eligibility.checks"]},
    {"key":"evidence_readiness","label":"Evidence readiness","weight":0.15,"value":1,"points":15,"max":15,"reason":"The opportunity text names no outcome, cost or timeliness evidence","source_refs":["opportunity.description","match_config.params.evidence_available"]},
    {"key":"award_size_fit","label":"Award size fit","weight":0.15,"value":1,"points":15,"max":15,"reason":"Award range $50,000–$200,000 fits a $600,000 annual budget","source_refs":["opportunity.award_floor","opportunity.award_ceiling","org.annual_budget_usd"]},
    {"key":"geography","label":"Geography","weight":0.1,"value":1,"points":10,"max":10,"reason":"Names Utah in the opportunity text","source_refs":["opportunity.description"]},
    {"key":"effort_vs_time","label":"Effort vs time","weight":0.1,"value":1,"points":10,"max":10,"reason":"439 days to the 2027-12-15 close date, against 30 days of typical prep","source_refs":["opportunity.close_date","match_config.params.prep_days"]}
   ]'),
  ('40404040-4040-4040-4040-404040404052', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101013', 0, 'v0-synthetic-test', 'v0-synthetic-test', '2026-10-02T12:00:00Z',
   '{"eligible":false,"flags":[{"code":"applicant_type","severity":"blocker","message":"Only state governments may apply","source_ref":"opportunity.eligibility.applicant_types"}]}', '[
    {"key":"mission_fit","label":"Mission fit","weight":0.3,"value":0.3333,"points":10,"max":30,"reason":"Matched 1 of 5 configured themes: social services (funding categories)","source_refs":["org.program_themes","opportunity.eligibility.funding_categories"]},
    {"key":"eligibility_certainty","label":"Eligibility certainty","weight":0.2,"value":0.9,"points":18,"max":20,"reason":"9 of 10 eligibility checks passed, 1 flagged, 0 could not be checked","source_refs":["eligibility.checks","opportunity.eligibility.applicant_types"]},
    {"key":"evidence_readiness","label":"Evidence readiness","weight":0.15,"value":1,"points":15,"max":15,"reason":"The opportunity text names no outcome, cost or timeliness evidence","source_refs":["opportunity.description","match_config.params.evidence_available"]},
    {"key":"award_size_fit","label":"Award size fit","weight":0.15,"value":1,"points":15,"max":15,"reason":"Award range $100,000–$500,000 fits a $600,000 annual budget","source_refs":["opportunity.award_floor","opportunity.award_ceiling","org.annual_budget_usd"]},
    {"key":"geography","label":"Geography","weight":0.1,"value":0.5,"points":5,"max":10,"reason":"National program; Utah applicants are not named","source_refs":["opportunity.description"]},
    {"key":"effort_vs_time","label":"Effort vs time","weight":0.1,"value":1,"points":10,"max":10,"reason":"394 days to the 2027-10-31 close date, against 30 days of typical prep","source_refs":["opportunity.close_date","match_config.params.prep_days"]},
    {"key":"blocker_cap","label":"Blocker","weight":0,"value":0,"points":0,"max":0,"reason":"Score capped at 0: Only state governments may apply","source_refs":["opportunity.eligibility.applicant_types"]}
   ]');
-- DS-06a2: synthetic FAS service counties (5 fips) until FAS provides the real list.
INSERT INTO fas_service_county (fips) VALUES ('49035'), ('49049'), ('49011'), ('49057'), ('49045')
ON CONFLICT (fips) DO NOTHING;
-- F-508f: one synthetic failed strategy draft (local/CI only) so e2e can show the citation report; failed drafts never render as usable.
INSERT INTO strategy_draft (id, org_id, opportunity_id, snapshot, output, citation_report, model_meta, status, created_by) VALUES
  ('50505050-5050-5050-5050-505050505053', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10101010-1010-1010-1010-101010101012', '{"opportunity_id":"10101010-1010-1010-1010-101010101012","built_at":"2026-10-16T00:00:00Z","facts":[],"abstracts":[]}', NULL,
   '{"ok":false,"rounds":2,"copied":[],"claims":[{"path":"criteria_map[0].evidence[0].claim","text":"Uninsured rate of 99% in the county.","citation_ids":["opportunity:10101010-1010-1010-1010-101010101012"],"numbers":[99],"problems":["99 has no matching cited value"]}]}',
   '[{"provider":"gemini","model":"synthetic-model","attempts":1,"input_tokens":null,"output_tokens":null,"latency_ms":0}]', 'failed', '22222222-2222-2222-2222-222222222222');
