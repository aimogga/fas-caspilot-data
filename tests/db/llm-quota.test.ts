import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase, localPgEnv } from '../../lib/db/local-pg';

// F-508a2 (#224): the shared OpenRouter counter. Local Supabase only; a provider name per test keeps runs apart.
const need = (name: string): string => { if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`); return process.env[name] as string; };
const [API, ANON, SVC, DB] = [need('SUPABASE_URL'), need('SUPABASE_ANON_KEY'), need('SUPABASE_SERVICE_ROLE_KEY'), need('SUPABASE_DB_URL')];
const pg = assertLocalSupabase(API, DB);
const sql = (q: string) => execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8', env: localPgEnv(pg) }).trim();
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const signIn = async (email: string) => { const c = createClient(API, ANON, opts); const { error } = await c.auth.signInWithPassword({ email, password: 'testpass123' }); if (error) throw error; return c; };
const svc = createClient(API, SVC, opts);
const run = `f508a2-${Date.now()}`;
const providers: string[] = [];
const provider = (name: string) => { const p = `${run}-${name}`; providers.push(p); return p; };
const reserve = async (c: SupabaseClient, p: string, rpm: number, daily: number, now?: string) =>
  c.rpc('llm_reserve', { p_provider: p, p_rpm_limit: rpm, p_daily_limit: daily, ...(now ? { p_now: now } : {}) });
const counts = (p: string) => sql(`SELECT window_kind || '=' || count FROM llm_quota WHERE provider = '${p}' ORDER BY window_kind, window_start`).split('\n').filter(Boolean);

afterAll(() => { if (providers.length) sql(`DELETE FROM llm_quota WHERE provider LIKE '${run}-%'`); });

describe('integration: llm_quota and llm_reserve (F-508a2)', () => {
  it('catalog: RLS forced, no anon/authenticated policy or grant; llm_reserve is SECURITY DEFINER with a fixed search_path, service_role only', () => {
    expect(sql(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'public.llm_quota'::regclass`)).toBe('t|t');
    expect(sql(`SELECT count(*) FROM pg_policy WHERE polrelid = 'public.llm_quota'::regclass AND polroles && ARRAY['anon'::regrole::oid, 'authenticated'::regrole::oid, 0::oid]`)).toBe('0');
    for (const role of ['anon', 'authenticated']) expect(sql(`SELECT has_table_privilege('${role}', 'public.llm_quota', 'SELECT,INSERT,UPDATE,DELETE')`)).toBe('f');
    const fn = `'public.llm_reserve(text, integer, integer, timestamptz)'`;
    expect(sql(`SELECT prosecdef, proconfig::text FROM pg_proc WHERE oid = ${fn}::regprocedure`)).toBe('t|{"search_path=pg_catalog, pg_temp"}');
    expect(['anon', 'authenticated', 'service_role'].map((r) => sql(`SELECT has_function_privilege('${r}', ${fn}, 'EXECUTE')`))).toEqual(['f', 'f', 't']);
    expect(sql(`SELECT count(*) FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid = ${fn}::regprocedure)) WHERE grantee = 0`)).toBe('0');
  });

  it('deny by default: anon and authenticated can neither touch the table nor run llm_reserve', async () => {
    const p = provider('deny');
    expect((await reserve(svc, p, 5, 5)).data).toBe(true);
    for (const c of [createClient(API, ANON, opts), await signIn('admin@example.test'), await signIn('staff@example.test')]) {
      expect((await reserve(c, p, 1000, 1000)).error).toBeTruthy();
      expect((await c.from('llm_quota').select('count').eq('provider', p)).data ?? []).toEqual([]);
      await c.from('llm_quota').insert({ provider: p, window_kind: 'day', window_start: '2000-01-01T00:00:00Z', count: 0 });
      await c.from('llm_quota').update({ count: 0 }).eq('provider', p);
      await c.from('llm_quota').delete().eq('provider', p);
    }
    expect(counts(p)).toEqual(['day=1', 'minute=1']);
  });

  it('stops at the per-minute cap and at the daily cap without incrementing either row', async () => {
    const m = provider('minute'), t = '2026-10-16T12:00:30Z';
    for (let i = 0; i < 3; i++) expect((await reserve(svc, m, 3, 100, t)).data).toBe(true);
    expect((await reserve(svc, m, 3, 100, t)).data).toBe(false);
    expect(counts(m)).toEqual(['day=3', 'minute=3']);
    expect((await reserve(svc, m, 3, 100, '2026-10-16T12:01:00Z')).data).toBe(true); // next minute
    const d = provider('day');
    for (const s of ['12:00', '12:01']) expect((await reserve(svc, d, 100, 2, `2026-10-16T${s}:00Z`)).data).toBe(true);
    expect((await reserve(svc, d, 100, 2, '2026-10-16T12:02:00Z')).data).toBe(false);
    expect(counts(d)).toEqual(['day=2', 'minute=1', 'minute=1', 'minute=0']);
    for (const [rpm, daily] of [[0, 5], [5, 0]]) expect((await reserve(svc, provider(`zero-${rpm}`), rpm, daily)).data).toBe(false);
  });

  it('30 concurrent reservations against a limit of 18 grant exactly 18', async () => {
    const p = provider('race'), t = '2026-10-16T15:30:10Z';
    const results = await Promise.all(Array.from({ length: 30 }, () => reserve(svc, p, 18, 45, t)));
    expect(results.map((r) => r.error)).toEqual(Array(30).fill(null));
    expect(results.filter((r) => r.data === true)).toHaveLength(18);
    expect(counts(p)).toEqual(['day=18', 'minute=18']);
  });

  it('the daily count rolls over at 00:00 UTC, not at local midnight', async () => {
    const p = provider('rollover');
    expect((await reserve(svc, p, 100, 1, '2026-10-16T23:59:59Z')).data).toBe(true);
    expect((await reserve(svc, p, 100, 1, '2026-10-17T05:59:00+06:00')).data).toBe(false); // 23:59 UTC on the 16th
    expect((await reserve(svc, p, 100, 1, '2026-10-17T00:00:00Z')).data).toBe(true);
    expect(sql(`SELECT window_start AT TIME ZONE 'UTC' || '=' || count FROM llm_quota WHERE provider = '${p}' AND window_kind = 'day' ORDER BY 1`).split('\n'))
      .toEqual(['2026-10-16 00:00:00=1', '2026-10-17 00:00:00=1']);
  });
});
