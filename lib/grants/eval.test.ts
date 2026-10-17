import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { V0_DRAFT_CONFIG, V0_DRAFT_WEIGHTS, V1_1_DRAFT_CONFIG, V1_1_DRAFT_PARAMS, V1_DRAFT_CONFIG, V1_DRAFT_PARAMS, V1_DRAFT_WEIGHTS } from './config-defaults';
import { EVAL_BARS, type EvalLabels, type EvalReport, formatReport, runEval } from './eval';
import { FAS_PROFILE_SYNTHETIC as org } from './profile';

const set = JSON.parse(readFileSync('tests/eval/grant-match/labels.json', 'utf8')) as EvalLabels;
const golden = JSON.parse(readFileSync('tests/golden/match-eval.json', 'utf8')) as EvalReport & { config_id: string };
const NOW = new Date(set.as_of);
const report = runEval(set.labels, V1_DRAFT_CONFIG, org, NOW);
// Measured 2026-10-14 on the synthetic set: v0-draft precision 0.6087 (14 tp / 9 fp); v1-draft (F-504b floors + params) 0.875 (14 tp / 2 fp). The gate holds the PRD bar.
const PRECISION_FLOOR = EVAL_BARS.precision;

describe('grant match eval (F-509 regression gate)', () => {
  it('the synthetic set has at least 20 labeled opportunities, balanced about 40/60 good/poor, each with a why and an eligibility expectation', () => {
    const good = set.labels.filter((l) => l.label === 'good').length;
    expect(set.labels.length).toBeGreaterThanOrEqual(20);
    expect(good / set.labels.length).toBeGreaterThanOrEqual(0.35); expect(good / set.labels.length).toBeLessThanOrEqual(0.5);
    expect(new Set(set.labels.map((l) => l.id)).size).toBe(set.labels.length);
    for (const l of set.labels) expect([l.why.length > 10, [true, false, 'unknown'].includes(l.eligible_expected), l.title.includes('synthetic')], l.id).toEqual([true, true, true]);
  });
  it('v1-draft clears the bars at the digest threshold (60) and is deterministic', () => {
    expect(report.threshold).toBe(60);
    expect(report.precision).toBeGreaterThanOrEqual(PRECISION_FLOOR);
    expect(report.recall).toBeGreaterThanOrEqual(EVAL_BARS.recall);
    expect(report.eligibilityAccuracy).toBeGreaterThanOrEqual(EVAL_BARS.eligibilityAccuracy);
    expect(runEval(set.labels, V1_DRAFT_CONFIG, org, NOW)).toEqual(report);
    expect(report.confusion.tp + report.confusion.fp + report.confusion.fn + report.confusion.tn).toBe(report.n);
  });
  it('misses and headline numbers match the committed golden (a scorer change must regenerate it with `pnpm eval:grants --write-golden`)', () => {
    const { misses, ...rest } = report;
    expect(golden.config_id).toBe('v1-draft');
    expect({ ...rest, misses }).toEqual({ n: golden.n, threshold: golden.threshold, precision: golden.precision, recall: golden.recall, f1: golden.f1, eligibilityAccuracy: golden.eligibilityAccuracy, confusion: golden.confusion, misses: golden.misses });
  });
  it('V0_DRAFT_WEIGHTS equal the v0-draft seed in the match_config migration', () => {
    const sql = readFileSync('supabase/migrations/20261014041000_f504_match_config.sql', 'utf8');
    const json = /VALUES \('v0-draft',\s*'(\{[^']+\})'/.exec(sql)?.[1];
    expect(JSON.parse(json ?? '{}')).toEqual(V0_DRAFT_WEIGHTS);
  });
  it('V1_DRAFT_WEIGHTS and V1_DRAFT_PARAMS equal the unapproved v1-draft seed in the F-504b migration (v0-draft row untouched)', () => {
    const sql = readFileSync('supabase/migrations/20261014044500_f504b_match_config_v1.sql', 'utf8');
    const m = /VALUES \('v1-draft',\s*'(\{[^']+\})',\s*'(\{[^']+\})'/.exec(sql);
    expect([JSON.parse(m?.[1] ?? '{}'), JSON.parse(m?.[2] ?? '{}')]).toEqual([V1_DRAFT_WEIGHTS, V1_DRAFT_PARAMS]);
    expect([sql.includes('approved_by'), /INSERT INTO match_config \(id, weights, params, created_at\)/.test(sql), /^\s*(UPDATE|DELETE)\b/m.test(sql), V1_DRAFT_CONFIG.approved_by]).toEqual([true, true, false, null]);
    expect(Object.values(V1_DRAFT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });
  it('F-504d: v1.1-draft equals the unapproved migration seed (v1 weights and params plus the two band edges) and scores exactly as v1-draft', () => {
    const sql = readFileSync('supabase/migrations/20261017000030_f504d_fit_bands.sql', 'utf8');
    const m = /VALUES \('v1\.1-draft',\s*'(\{[^']+\})',\s*'(\{[^']+\})'/.exec(sql);
    expect([JSON.parse(m?.[1] ?? '{}'), JSON.parse(m?.[2] ?? '{}')]).toEqual([V1_DRAFT_WEIGHTS, V1_1_DRAFT_PARAMS]);
    const code = sql.split('\n').filter((l) => !l.startsWith('--')).join('\n');
    expect([V1_1_DRAFT_PARAMS, /approved_by/.test(code), /'v1-draft'/.test(code), /^\s*(UPDATE|DELETE)\b/m.test(code), V1_1_DRAFT_CONFIG.approved_by]).toEqual([{ ...V1_DRAFT_PARAMS, band_strong: 75, band_look: 60 }, false, false, false, null]);
    const v11 = runEval(set.labels, V1_1_DRAFT_CONFIG, org, NOW);
    expect(v11).toEqual(report); expect(v11.precision).toBeGreaterThanOrEqual(PRECISION_FLOOR);
  });
  it('v0-draft stays as measured under its own params (precision 0.6087, below the bar): the F-504b params change nothing it does not set', () => {
    const v0 = runEval(set.labels, V0_DRAFT_CONFIG, org, NOW);
    expect([v0.precision, v0.confusion, v0.precision < EVAL_BARS.precision]).toEqual([0.6087, { tp: 14, fp: 9, fn: 1, tn: 12 }, true]);
  });
  it('each v1 param earns its place: dropping floors, min_days_to_close or max_cost_share_pct brings back a named false positive', () => {
    const without = (drop: string[]) => runEval(set.labels, { ...V1_DRAFT_CONFIG, params: Object.fromEntries(Object.entries(V1_DRAFT_PARAMS).filter(([k]) => !drop.includes(k))) }, org, NOW).misses.map((m) => m.id);
    // (the 0.35 mission weight alone already sinks the off-mission nationals p-national-housing and p-hospital-equipment to 58 without a floor)
    expect(without(['floor_components'])).toEqual(expect.arrayContaining(['p-utah-wildlife', 'p-tiny-award', 'p-floor-too-high', 'p-closes-tomorrow', 'p-national-heavy-match']));
    expect(without(['min_days_to_close'])).toContain('p-closes-tomorrow'); expect(without(['max_cost_share_pct'])).toContain('p-national-heavy-match');
    expect(without(['award_too_small_value'])).toContain('p-tiny-award'); expect(report.misses.map((m) => m.id)).not.toContain('p-tiny-award');
  });
  it('the gate can fail: all weight on effort_vs_time, or the v0 weights without floors, drops below the 0.70 bar; a threshold of 0 drops further', () => {
    const effortOnly = runEval(set.labels, { ...V1_DRAFT_CONFIG, id: 'broken', weights: { effort_vs_time: 1 } }, org, NOW);
    expect(runEval(set.labels, { ...V0_DRAFT_CONFIG, weights: V1_DRAFT_CONFIG.weights }, org, NOW).precision).toBeLessThan(EVAL_BARS.precision);
    expect(effortOnly.precision).toBeLessThan(EVAL_BARS.precision); expect(effortOnly.precision).toBeLessThan(report.precision);
    expect(effortOnly.misses.length).toBeGreaterThan(report.misses.length);
    const everything = runEval(set.labels, { ...V1_DRAFT_CONFIG, params: { ...V1_DRAFT_CONFIG.params, eval_threshold: 0 } as never }, org, NOW);
    expect(everything.precision).toBeLessThan(PRECISION_FLOOR); expect(everything.confusion).toEqual({ tp: 15, fp: 21, fn: 0, tn: 0 });
  });
  it('eval_threshold comes from params; formatReport prints every metric, the bars and each miss', () => {
    const strict = runEval(set.labels, { ...V1_DRAFT_CONFIG, params: { ...V1_DRAFT_CONFIG.params, eval_threshold: 90 } as never }, org, NOW);
    expect(strict.threshold).toBe(90); expect(strict.confusion.fp).toBeLessThan(report.confusion.fp);
    const text = formatReport(report, 'v1-draft');
    expect(text).toContain('Grant match eval: v1-draft, n=36, threshold 60');
    expect(text).toMatch(/precision \| 87\.5% \(bar 70\.0%, PASS\)/); expect(text).toMatch(/eligibility accuracy \| 100\.0% \(bar 90\.0%, PASS\)/);
    expect(formatReport(runEval(set.labels, V0_DRAFT_CONFIG, org, NOW), 'v0-draft')).toMatch(/precision \| 60\.9% \(bar 70\.0%, FAIL\)/);
    for (const m of report.misses) expect(text).toContain(`${m.id} | ${m.label} · ${m.score}`);
  });
});
