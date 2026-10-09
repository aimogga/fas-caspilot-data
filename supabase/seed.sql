-- Local synthetic users for F-101 e2e. Password: testpass123
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  u.email, crypt('testpass123', gen_salt('bf')), now(),
  jsonb_build_object('role', u.role), '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
FROM (VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@example.test', 'admin'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'staff@example.test', 'staff'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'board@example.test', 'board_viewer')
) AS u(id, email, role);

INSERT INTO auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
FROM auth.users
WHERE email IN ('admin@example.test', 'staff@example.test', 'board@example.test');
