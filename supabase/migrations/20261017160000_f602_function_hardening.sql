-- F-602: clear the Supabase security advisors on functions (forward-only; no table or policy change).
-- app_org_id() and app_role() only read the caller's own JWT claims, so they need no elevated rights:
-- SECURITY INVOKER returns the same values and is no longer a callable SECURITY DEFINER (lints 0028, 0029).
ALTER FUNCTION public.app_org_id() SECURITY INVOKER;
ALTER FUNCTION public.app_role() SECURITY INVOKER;
-- intake_table() reads no tables; a fixed search_path keeps it from resolving names through the caller's path (lint 0011).
ALTER FUNCTION public.intake_table(text) SET search_path = pg_catalog;
-- rls_guard_violations() is for the nightly audit and the DB tests, which call it with the service role; signed-in users no longer can.
REVOKE EXECUTE ON FUNCTION public.rls_guard_violations() FROM authenticated;
