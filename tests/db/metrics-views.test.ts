/**
 * F-304 part 2 / F-306: the M1–M6 SQL views and suppress() against the local Supabase (CI only, via pnpm test:db).
 * Loads the F-103 generator through the same psql path as pnpm seed:synthetic, reads back through the views and
 * compares with tests/golden/metrics.json; then checks the shared views never show a cell below 11 and that RLS
 * applies through the views (security_invoker).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalSupabase, localPgEnv } from '../../lib/db/local-pg';
import { percentile, r4 } from '../../lib/metrics/compute';
import { THRESHOLD } from '../../lib/metrics/suppress';
import { generate, SYNTH_ORG, toSql } from '../../lib/synthetic/generate';

function need(name: string): string {
  if (!process.env[name]) throw new Error(`Missing ${name}. Run pnpm test:db`);
  return process.env[name] as string;
}
const API = need('SUPABASE_URL');
const ANON = need('SUPABASE_ANON_KEY');
const SVC = need('SUPABASE_SERVICE_ROLE_KEY');
const pg = assertLocalSupabase(API, need('SUPABASE_DB_URL'));
const BASE = ['m1_court_to_first_session', 'm2_application_to_decision', 'm3_never_started', 'm4_m5_m6_episodes'] as const;
const GOLDEN = JSON.parse(readFileSync(new URL('../golden/metrics.json', import.meta.url), 'utf8')) as { cases: { name: string; filters: Record<string, string>; expect: Record<string, unknown> }[] };
type Rec = Record<string, unknown>;

function psql(input: string): void {
  execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-f', '-'], { input, encoding: 'utf8', env: localPgEnv(pg) });
}
const CLEAN = ['outcome_measure', 'delivery_episode', '"authorization"', 'application', '"case"', 'provider', 'upload_batch']
  .map((t) => `DELETE FROM ${t} WHERE org_id = '${SYNTH_ORG}' AND id::text LIKE 'f103%';`).join('\n');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(API, SVC, opts);
async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(API, ANON, opts);
  const { error } = await c.auth.signInWithPassword({ email, password: 'testpass123' });
  if (error) throw error;
  return c;
}
/** Rows of one view, optionally filtered in SQL; synthetic (F-103) rows only, since the seed also populates SYNTH_ORG. */
async function view(name: string, filters: Record<string, string> = {}, c: SupabaseClient = svc): Promise<Rec[]> {
  let q = c.from(name).select('*').eq('org_id', SYNTH_ORG);
  for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
  const { data, error } = await q;
  expect(error).toBeNull();
  return (data as Rec[]).filter((r) => String(r.case_id).startsWith('f103'));
}
const num = (x: unknown) => Number(x ?? 0);
const sum = (xs: Rec[], k: string) => xs.reduce((a, r) => a + num(r[k]), 0);
const ratio = (n: number, d: number) => (d ? r4(n / d) : null);
const dist = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return { n: s.length, median: percentile(s, 0.5), p25: percentile(s, 0.25), p75: percentile(s, 0.75) }; };

/** Aggregates base-view rows with the compute.ts definitions into the golden shape (SQL did the joins and filters). */
async function fromViews(filters: Record<string, string>) {
  const [m1, m2, m3, eps] = await Promise.all(BASE.map((v) => view(v, filters)));
  const started = m1!.filter((r) => r.days != null);
  const never = m3!.filter((r) => !r.started_within_window), byReason: Record<string, number> = {};
  for (const r of never) byReason[String(r.non_start_reason)] = (byReason[String(r.non_start_reason)] ?? 0) + 1;
  const done = eps!.filter((r) => r.completed);
  const band = (b: string | null) => {
    const xs = b == null ? eps! : eps!.filter((r) => (r.income_band ?? 'unknown') === b);
    const c = xs.filter((r) => r.completed).length, z = xs.filter((r) => r.closed).length;
    return { band: b ?? 'total', completed: c, closed: z, rate: ratio(c, z) };
  };
  const group = (g: 'affiliated' | 'other') => {
    const xs = eps!.filter((r) => r.provider_affiliated === (g === 'affiliated'));
    const units = sum(xs, 'units'), weighted = xs.reduce((a, r) => a + num(r.units) * num(r.rate), 0);
    return { group: g, dollars: sum(xs, 'dollars_paid'), episodes: xs.length, avgRatePerUnit: ratio(weighted, units) };
  };
  const groups = [group('affiliated'), group('other')], aff = groups[0]!.dollars, oth = groups[1]!.dollars;
  return {
    m1: { ...dist(started.map((r) => num(r.days))), stillWaitingShare: ratio(m1!.length - started.length, m1!.length) },
    m2: dist(m2!.filter((r) => r.days != null).map((r) => num(r.days))),
    m3: { approved: m3!.length, neverStarted: never.length, share: ratio(never.length, m3!.length), byReason },
    m4: { rows: [...new Set(eps!.map((r) => String(r.income_band ?? 'unknown')))].sort().map(band), total: band(null) },
    m5: { completedEpisodes: done.length, dollarsCompleted: sum(done, 'dollars_paid'), costPerCompleted: ratio(sum(done, 'dollars_paid'), done.length), programDollars: sum(eps!, 'dollars_paid'), programPerCompleted: ratio(sum(eps!, 'dollars_paid'), done.length) },
    m6: { affiliatedDollars: aff, otherDollars: oth, affiliatedShare: ratio(aff, aff + oth), groups },
  };
}

describe('F-304 metric views (generate(20, 20) golden)', () => {
  beforeAll(() => psql(toSql(generate(20, 20))));
  afterAll(() => psql(CLEAN));

  it('rls_guard_violations() stays empty with the new views and functions', async () => {
    const { data, error } = await svc.rpc('rls_guard_violations');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each([{ n: 10, want: null }, { n: 11, want: 11 }, { n: 10, threshold: 10, want: 10 }])('suppress($n) → $want', async ({ n, threshold, want }) => {
    const { data, error } = await svc.rpc('suppress', threshold == null ? { n } : { n, threshold });
    expect(error).toBeNull();
    expect(data).toBe(want);
  });

  it('suppress_rate hides either side below 11 and rounds to 4 dp', async () => {
    expect((await svc.rpc('suppress_rate', { num: 10, den: 100 })).data).toBeNull();
    expect((await svc.rpc('suppress_rate', { num: 100, den: 10 })).data).toBeNull();
    expect(Number((await svc.rpc('suppress_rate', { num: 11, den: 44 })).data)).toBe(0.25);
  });

  it.each(GOLDEN.cases.filter((c) => !c.filters.from))('base views reproduce golden "$name"', async ({ filters, expect: want }) => {
    expect(await fromViews(filters.county ? { county_fips: filters.county } : {})).toEqual(want);
  });

  it('anon, board_viewer and other-org staff get no rows from the base views; admin does', async () => {
    const admin = await signIn('admin@example.test');
    expect((await view('m2_application_to_decision', {}, admin)).length).toBe(20);
    const outsiders = [createClient(API, ANON, opts), await signIn('board@example.test'), await signIn('other@example.test')];
    for (const c of outsiders) for (const v of BASE) {
      const { data } = await c.from(v).select('org_id').eq('org_id', SYNTH_ORG);
      expect(data ?? []).toEqual([]);
    }
  });
});

describe('F-306 shared views (generate(103, 200))', () => {
  beforeAll(() => psql(toSql(generate(103, 200))));
  afterAll(() => psql(CLEAN));
  const ok = (n: unknown) => n == null || Number(n) >= THRESHOLD;

  it('m1_summary_shared: n NULL or ≥ 11; percentiles NULL when n is', async () => {
    const { data, error } = await svc.from('m1_summary_shared').select('*');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const r of data as Rec[]) {
      expect(ok(r.n)).toBe(true);
      if (r.n == null) expect([r.median_days, r.p25_days, r.p75_days]).toEqual([null, null, null]);
      if (r.still_waiting_share != null) expect(Number(r.still_waiting_share)).toBeLessThanOrEqual(1);
    }
    expect((data as Rec[]).some((r) => r.org_id === SYNTH_ORG && r.n != null)).toBe(true);
  });

  it('m4_completion_by_income_band_shared: counts NULL or ≥ 11; rate NULL when a side is hidden', async () => {
    const { data, error } = await svc.from('m4_completion_by_income_band_shared').select('*');
    expect(error).toBeNull();
    for (const r of data as Rec[]) {
      expect(ok(r.completed) && ok(r.closed)).toBe(true);
      if (r.completed == null || r.closed == null) expect(r.rate).toBeNull();
      else expect(Number(r.rate)).toBe(r4(Number(r.completed) / Number(r.closed)));
    }
    expect((data as Rec[]).some((r) => r.org_id === SYNTH_ORG && r.rate != null)).toBe(true);
  });

  it('m6_dollars_by_provider_group_shared: episodes NULL or ≥ 11; dollars and rate hidden with it', async () => {
    const { data, error } = await svc.from('m6_dollars_by_provider_group_shared').select('*');
    expect(error).toBeNull();
    for (const r of data as Rec[]) {
      expect(ok(r.episodes)).toBe(true);
      if (r.episodes == null) expect([r.dollars, r.avg_rate_per_unit]).toEqual([null, null]);
    }
    expect((data as Rec[]).filter((r) => r.org_id === SYNTH_ORG && r.episodes != null).length).toBe(2);
  });
});
