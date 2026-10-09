import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COUNTIES, DEFAULT_SEED, generate, MEASURES, SMALL_FIPS, summarize, SYNTH_ORG, toSql, uid, WINDOW_END, WINDOW_START,
} from './generate';


const golden = JSON.parse(readFileSync('tests/golden/synthetic-20.json', 'utf8')) as {
  seed: number; nCases: number; courtBits: string; summary: ReturnType<typeof summarize>;
};

const b = generate();
const tables = ['provider', 'upload_batch', 'case', 'application', 'authorization', 'delivery_episode', 'outcome_measure'] as const;
const fips = new Set(COUNTIES.map((c) => c.fips));
const max = Object.fromEntries(MEASURES.map((m) => [m.code, m.max]));
const zBy = Object.fromEntries(b.authorization.map((z) => [z.id, z]));
const aBy = Object.fromEntries(b.application.map((a) => [a.id, a]));
const cBy = Object.fromEntries(b.case.map((c) => [c.id, c]));
const eByZ = Object.fromEntries(b.delivery_episode.map((e) => [e.authorization_id, e]));
const denied = new Set(b.application.filter((a) => a.decision === 'denied').map((a) => a.case_id));
const dates = (row: Record<string, unknown>) => Object.values(row).filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));

describe('unit: generator invariants', () => {
  it('emits ~200 cases across 10+ counties including small/rural', () => {
    expect(b.case.length).toBeGreaterThanOrEqual(180); expect(b.case.length).toBeLessThanOrEqual(220);
    expect(COUNTIES).toHaveLength(29);
    expect(COUNTIES.every((c) => /^49\d{3}$/.test(c.fips) && c.state === 'UT')).toBe(true);
    const used = new Set(b.case.map((c) => c.county_fips as string));
    expect(used.size).toBeGreaterThanOrEqual(10);
    expect(SMALL_FIPS.filter((x) => used.has(x)).length).toBeGreaterThanOrEqual(3);
    expect(b.case.filter((c) => c.county_fips === '49035').length)
      .toBeGreaterThan(b.case.filter((c) => c.county_fips === '49009').length * 3);
  });

  it('covers court, applications, providers, episodes, outcomes', () => {
    expect(b.case.some((c) => c.court_involved) && b.case.some((c) => !c.court_involved)).toBe(true);
    expect(b.application.some((a) => a.decision === 'approved') && b.application.some((a) => a.decision === 'denied')).toBe(true);
    expect(b.provider.some((p) => p.provider_affiliated) && b.provider.some((p) => !p.provider_affiliated)).toBe(true);
    expect(new Set(b.authorization.map((z) => z.provider_id)).size).toBe(12);
    const aff = (id: unknown) => b.provider.find((p) => p.id === id)?.provider_affiliated;
    expect(b.authorization.some((a) => aff(a.provider_id)) && b.authorization.some((a) => aff(a.provider_id) === false)).toBe(true);
    expect(b.delivery_episode.some((e) => e.discharge_status === 'completed')).toBe(true);
    expect(b.delivery_episode.some((e) => e.discharge_status === 'dropped')).toBe(true);
    expect(new Set(b.delivery_episode.map((e) => e.non_start_reason).filter(Boolean))).toEqual(new Set(['no_show', 'moved', 'declined', 'waitlist']));
    expect([...new Set(b.outcome_measure.map((o) => o.measure_code))].sort()).toEqual(['GAD-7', 'OQ-45', 'PHQ-9', 'YOQ']);
    expect(b.outcome_measure.some((o) => o.followup_score == null) && b.outcome_measure.some((o) => o.followup_score != null)).toBe(true);
    expect(b.outcome_measure.filter((o) => denied.has(o.case_id))).toEqual([]);
    expect(b.authorization.filter((z) => denied.has(aBy[z.application_id as string]!.case_id)).length).toBe(0);
  });

  it('resolves FKs, pins org, is deterministic, and avoids real identifiers', () => {
    const ids = Object.fromEntries(tables.map((t) => [t, new Set(b[t].map((r) => r.id as string))]));
    expect(b.org.every((o) => o.id === SYNTH_ORG)).toBe(true);
    for (const t of tables) expect(b[t].every((r) => r.org_id === SYNTH_ORG)).toBe(true);
    expect(b.case.every((c) => ids.upload_batch.has(c.upload_batch_id as string) && fips.has(c.county_fips as string))).toBe(true);
    expect(b.application.every((a) => ids.case.has(a.case_id as string))).toBe(true);
    expect(b.authorization.every((a) => ids.application.has(a.application_id as string) && ids.provider.has(a.provider_id as string))).toBe(true);
    expect(b.delivery_episode.every((e) => ids.authorization.has(e.authorization_id as string))).toBe(true);
    expect(b.outcome_measure.every((o) => ids.case.has(o.case_id as string))).toBe(true);
    expect(JSON.stringify(generate(DEFAULT_SEED))).toBe(JSON.stringify(generate(DEFAULT_SEED)));
    expect(JSON.stringify(generate(1, 8))).not.toBe(JSON.stringify(generate(2, 8)));
    const allow = new Set([
      'FAS Synthetic', 'UT', 'therapy', 'court', 'self', 'school', 'approved', 'denied', 'completed', 'dropped',
      'no_show', 'moved', 'declined', 'waitlist', 'PHQ-9', 'GAD-7', 'OQ-45', 'YOQ', '/synthetic/f103.csv', 'ok', 'a', 'b', 'c', 'd',
      '00-0000001', 'UEIFAS0001', ...COUNTIES.map((c) => c.name),
    ]);
    const bad: string[] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v) || (v && typeof v === 'object')) Object.values(v as object).forEach(walk);
      else if (typeof v === 'string' && (/^\d{10}$/.test(v) || (!allow.has(v) && !/^Provider \d{3}$/.test(v) && !/^SYN\d+$/.test(v)
        && !/^f1030000-0000-4000-a000-[0-9a-f]{12}$/.test(v) && v !== SYNTH_ORG && !/^\d{4}-\d{2}-\d{2}$/.test(v)
        && !/^49\d{3}$/.test(v)))) bad.push(v);
    };
    walk(b);
    expect(bad).toEqual([]);
    expect(b.provider.every((p) => /^SYN/.test(p.npi as string))).toBe(true);
    expect(uid(1).startsWith('f103')).toBe(true);
  });

  it('kills realism mutants', () => {
    expect(b.delivery_episode.filter((e) => !e.first_session_date && !e.non_start_reason)).toEqual([]);
    expect(b.outcome_measure.filter((o) => [o.baseline_score, o.followup_score].some((s) => s != null && (Number(s) < 0 || Number(s) > max[o.measure_code as string]!)))).toEqual([]);
    expect(b.outcome_measure.filter((o) => o.followup_date && (o.followup_date as string) < (o.baseline_date as string))).toEqual([]);
    expect(b.application.filter((a) => (a.application_date as string) < (cBy[a.case_id as string]!.referral_date as string))).toEqual([]);
    expect([...b.case, ...b.application, ...b.delivery_episode, ...b.outcome_measure].flatMap(dates).filter((d) => d < WINDOW_START || d > WINDOW_END)).toEqual([]);
    expect(b.delivery_episode.filter((e) => e.non_start_reason && Number(e.sessions_attended) !== 0)).toEqual([]);
    expect(b.delivery_episode.filter((e) => e.first_session_date && e.last_session_date && (e.first_session_date as string) > (e.last_session_date as string))).toEqual([]);
    expect(b.delivery_episode.filter((e) => {
      const z = zBy[e.authorization_id as string]!, a = aBy[z.application_id as string]!;
      return Number(e.sessions_attended) > Number(z.units) || Number(e.dollars_paid) !== Number(e.sessions_attended) * Number(z.rate)
        || Number(e.dollars_paid) > Number(z.total_authorized) || Number(z.total_authorized) > Number(a.award_amount);
    })).toEqual([]);
    const court = b.case.filter((c) => c.court_involved);
    expect(court.filter((c) => !c.court_order_date || (c.court_order_date as string) >= (c.referral_date as string) || c.referral_source !== 'court')).toEqual([]);
    expect(new Set(court.map((c) => (Date.parse(c.referral_date as string) - Date.parse(c.court_order_date as string)) / 864e5)).size).toBeGreaterThanOrEqual(5);
    const dlt = b.outcome_measure.filter((o) => o.followup_score != null).map((o) => Number(o.followup_score) - Number(o.baseline_score));
    const pct = (p: (n: number) => boolean) => dlt.filter(p).length / dlt.length;
    expect(pct((d) => d < 0) >= 0.2 && pct((d) => d === 0) >= 0.2 && pct((d) => d > 0) >= 0.2).toBe(true);
    expect(b.outcome_measure.filter((o) => o.followup_date && ((o.followup_date as string) < ((eByZ[b.authorization.find((z) => aBy[z.application_id as string]!.case_id === o.case_id)?.id as string]?.last_session_date as string) ?? (o.baseline_date as string)) || (o.followup_date as string) < (o.baseline_date as string)))).toEqual([]);
  });

  it('toSql scopes deletes to the synthetic org and f103 ids and is idempotent', () => {
    const sql = toSql(generate(1, 3));
    const dels = sql.split('\n').filter((l) => l.startsWith('DELETE'));
    expect(dels.length).toBe(7);
    expect(dels.every((l) => l.includes(SYNTH_ORG) && l.includes("LIKE 'f103%'"))).toBe(true);
    expect(sql.indexOf('DELETE')).toBeLessThan(sql.indexOf('INSERT'));
    expect(sql).toContain('ON CONFLICT (fips)');
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(toSql(generate(1, 3))).toBe(sql);
  });
});

describe('golden: fixture with hand-computed metrics', () => {
  it('reproduces the seed=20 / 20-case fixture exactly', () => {
    const g = generate(golden.seed, golden.nCases);
    expect(g.case.length).toBe(golden.nCases);
    expect(g.case.map((c) => (c.court_involved ? '1' : '0')).join('')).toBe(golden.courtBits);
    expect(summarize(g)).toEqual(golden.summary);
  });
});
