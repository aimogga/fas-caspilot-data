import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COUNTIES, DEFAULT_SEED, generate, SMALL_FIPS, summarize, SYNTH_ORG, uid,
} from './generate';

const golden = JSON.parse(readFileSync('tests/golden/synthetic-20.json', 'utf8')) as {
  seed: number; nCases: number; courtBits: string; summary: ReturnType<typeof summarize>;
};

const b = generate();
const tables = ['provider', 'upload_batch', 'case', 'application', 'authorization', 'delivery_episode', 'outcome_measure'] as const;
const fips = new Set(COUNTIES.map((c) => c.fips));

describe('unit: generator invariants', () => {
  it('emits ~200 cases across 10+ counties including small/rural', () => {
    expect(b.case.length).toBeGreaterThanOrEqual(180);
    expect(b.case.length).toBeLessThanOrEqual(220);
    expect(COUNTIES).toHaveLength(29);
    expect(COUNTIES.every((c) => /^49\d{3}$/.test(c.fips) && c.state === 'UT')).toBe(true);
    const used = new Set(b.case.map((c) => c.county_fips as string));
    expect(used.size).toBeGreaterThanOrEqual(10);
    expect(SMALL_FIPS.filter((x) => used.has(x)).length).toBeGreaterThanOrEqual(3);
  });

  it('covers court, applications, providers, episodes, outcomes', () => {
    expect(b.case.some((c) => c.court_involved) && b.case.some((c) => !c.court_involved)).toBe(true);
    expect(b.application.some((a) => a.decision === 'approved') && b.application.some((a) => a.decision === 'denied')).toBe(true);
    expect(b.provider.some((p) => p.provider_affiliated) && b.provider.some((p) => !p.provider_affiliated)).toBe(true);
    const aff = (id: unknown) => b.provider.find((p) => p.id === id)?.provider_affiliated;
    expect(b.authorization.some((a) => aff(a.provider_id)) && b.authorization.some((a) => aff(a.provider_id) === false)).toBe(true);
    expect(b.delivery_episode.some((e) => e.discharge_status === 'completed')).toBe(true);
    expect(b.delivery_episode.some((e) => e.discharge_status === 'dropped')).toBe(true);
    expect(new Set(b.delivery_episode.map((e) => e.non_start_reason).filter(Boolean))).toEqual(new Set(['no_show', 'moved', 'declined', 'waitlist']));
    const codes = new Set(b.outcome_measure.map((o) => o.measure_code));
    expect([...codes].sort()).toEqual(['GAD-7', 'OQ-45', 'PHQ-9', 'YOQ']);
    expect(b.outcome_measure.some((o) => o.followup_score == null) && b.outcome_measure.some((o) => o.followup_score != null)).toBe(true);
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
      else if (typeof v === 'string' && !allow.has(v) && !/^Provider \d{3}$/.test(v) && !/^SYN\d{8}$/.test(v)
        && !/^f1030000-0000-4000-a000-[0-9a-f]{12}$/.test(v) && v !== SYNTH_ORG && !/^\d{4}-\d{2}-\d{2}$/.test(v)
        && !/^49\d{3}$/.test(v) && !/^\d+$/.test(v)) bad.push(v);
    };
    walk(b);
    expect(bad).toEqual([]);
    expect(uid(1).startsWith('f103')).toBe(true);
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
