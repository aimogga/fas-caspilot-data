-- F-508a2 (#224): durable LLM quota counter, shared by every server instance, so OpenRouter's free-tier caps hold across
-- Vercel instances and cold starts. One row per provider, window kind and window start (UTC minute or UTC day).
-- Deny-by-default: RLS forced, no anon/authenticated policy or grant. Only service_role reaches it, through llm_reserve.
CREATE TABLE llm_quota (
  provider text NOT NULL CHECK (provider <> ''),
  window_kind text NOT NULL CHECK (window_kind IN ('minute', 'day')),
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (provider, window_kind, window_start));
ALTER TABLE llm_quota ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_quota FORCE ROW LEVEL SECURITY;
-- service_role bypasses RLS; this policy only names the one intended reader for the catalog guard (rls_guard_violations).
CREATE POLICY llm_quota_service ON llm_quota FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON llm_quota FROM PUBLIC, anon, authenticated;

-- Takes one slot for p_provider if both the current UTC minute and the current UTC day are under their limits, else
-- returns false and changes nothing. Both rows are locked (day, then minute: one order, no deadlock) before the check,
-- so concurrent callers queue and the count never passes the cap. p_now exists for tests; the app sends the DB clock.
CREATE FUNCTION llm_reserve(p_provider text, p_rpm_limit integer, p_daily_limit integer, p_now timestamptz DEFAULT now())
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  m timestamptz := date_trunc('minute', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  d timestamptz := date_trunc('day', p_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  day_count integer;
  minute_count integer;
BEGIN
  IF p_provider IS NULL OR p_rpm_limit IS NULL OR p_daily_limit IS NULL OR p_rpm_limit < 1 OR p_daily_limit < 1 THEN
    RETURN false;
  END IF;
  INSERT INTO public.llm_quota (provider, window_kind, window_start) VALUES (p_provider, 'day', d), (p_provider, 'minute', m)
    ON CONFLICT DO NOTHING;
  SELECT q.count INTO day_count FROM public.llm_quota q
    WHERE q.provider = p_provider AND q.window_kind = 'day' AND q.window_start = d FOR UPDATE;
  SELECT q.count INTO minute_count FROM public.llm_quota q
    WHERE q.provider = p_provider AND q.window_kind = 'minute' AND q.window_start = m FOR UPDATE;
  IF day_count >= p_daily_limit OR minute_count >= p_rpm_limit THEN
    RETURN false;
  END IF;
  UPDATE public.llm_quota q SET count = q.count + 1
    WHERE q.provider = p_provider AND ((q.window_kind = 'day' AND q.window_start = d) OR (q.window_kind = 'minute' AND q.window_start = m));
  -- Old minute rows are spent; drop them so the table stays small. Day rows are kept as a usage log.
  DELETE FROM public.llm_quota q WHERE q.provider = p_provider AND q.window_kind = 'minute' AND q.window_start < m - interval '1 hour';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION llm_reserve(text, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION llm_reserve(text, integer, integer, timestamptz) TO service_role;
