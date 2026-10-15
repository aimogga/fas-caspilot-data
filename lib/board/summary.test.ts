import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { deltaPhrase, sentences, summarize } from './summary';
const golden = JSON.parse(readFileSync('tests/golden/metrics.json', 'utf-8')).cases[0].expect, outcomes = JSON.parse(readFileSync('tests/golden/outcomes.json', 'utf-8'));
const w = <T>(v: T, n: number, delta: string | null = null) => ({ ...v, n, rows: n, viewRows: n, asOf: 'Jul 2026', delta });
const DIGIT = /\d/;
describe('board summary (F-402)', () => {
  it('words deltas as "the quarter before"', () => {
    expect([deltaPhrase('↓ 4 days faster than Q2'), deltaPhrase('↑ 2 pts higher than Q4'), deltaPhrase('No change from Q2'), deltaPhrase(null)])
      .toEqual([', 4 days faster than the quarter before', ', 2 pts higher than the quarter before', ', the same as the quarter before', '']);
  });
  it('phrases only present numbers; golden n < 11 values are worded "fewer than 11" with no digits beyond the threshold', () => {
    // Golden (generate(20, 20)): m1 n=4, m3 approved=17 but neverStarted=3, m5 completed=10, m4 total closed=14 with band a hidden, m6 groups 8/9, o1 n=4 each → all suppressed.
    const m1 = sentences.m1(w({ median: null }, golden.m1.n)), m3 = sentences.m3(w({ share: null, topReason: null }, golden.m3.approved));
    const m5 = sentences.m5(w({ costPerCompleted: null }, golden.m5.completedEpisodes));
    const m6 = sentences.m6(w({ affiliatedShare: null, groups: golden.m6.groups.map((g: { group: string }) => ({ group: g.group, avgRatePerUnit: null })) }, 17));
    const o1 = sentences.o1(w({ measures: outcomes.measures.slice(0, 2).map((x: { code: string; n: number }) => ({ code: x.code, n: x.n, meanChange: null, shareImproved: null })) }, 8));
    for (const s of [m1, m3, m5, m6, o1]) expect(s?.replace(/11|PHQ-9|GAD-7/g, '')).not.toMatch(DIGIT);
    expect([m1, m5]).toEqual(['Fewer than 11 court-ordered cases reached a first session this quarter, so the wait time is hidden.', 'Fewer than 11 courses of therapy were completed, so the cost per completed course is hidden.']);
    expect(o1).toBe('Fewer than 11 families had PHQ-9 follow-up scores, so that change is hidden. Fewer than 11 families had GAD-7 follow-up scores, so that change is hidden.');
    expect(sentences.m2(w({ median: golden.m2.median }, golden.m2.n, 'No change from Q2'))).toBe('Funding decisions took a median of 7 days from application, the same as the quarter before.');
    expect(sentences.m4(w({ total: null, includesHiddenBands: false }, 14))).toBe('Fewer than 11 cases closed, so completion rates by income band are hidden.');
  });
  it('writes shown values with their delta, reason, rates and outcome direction', () => {
    expect(sentences.m1(w({ median: 23 }, 12, '↓ 4 days faster than Q2'))).toBe('Families referred by a court waited a median of 23 days for a first session, 4 days faster than the quarter before.');
    expect(sentences.m3(w({ share: 0.18, topReason: 'declined' }, 40))).toBe('18% of approved families never started therapy within 60 days (most often: declined services).');
    expect(sentences.m5(w({ costPerCompleted: 1840 }, 12, '↑ $120 higher than Q2'))).toBe('Each completed course of therapy cost $1,840 on average, $120 higher than the quarter before.');
    expect(sentences.m4(w({ total: { completed: 25, closed: 29, rate: 0.8621 }, includesHiddenBands: true }, 29))).toBe('Across all income bands, 86% of closed cases finished therapy (25 of 29); bands with fewer than 11 cases are hidden.');
    expect(sentences.m6(w({ affiliatedShare: 0.59, groups: [{ group: 'affiliated', avgRatePerUnit: 120 }, { group: 'other', avgRatePerUnit: 90 }] }, 29)))
      .toBe('59% of therapy dollars went to providers affiliated with FAS, at an average of $120 per hour versus $90 for other providers.');
    expect(sentences.o1(w({ measures: [{ code: 'PHQ-9', n: 12, meanChange: -1.5, shareImproved: 0.75 }, { code: 'GAD-7', n: 0, meanChange: null, shareImproved: null }] }, 12)))
      .toBe('On the PHQ-9, scores changed by −1.5 on average and 75% of families improved (lower is better).');
  });
  it('skips failed and empty cards, says when nothing is available, and ends with the as-of date', () => {
    expect([sentences.m1({ error: true }), sentences.m1(undefined), sentences.m4(w({ total: null, includesHiddenBands: false }, 0))]).toEqual([null, null, null]);
    expect([sentences.m1(w({ median: null }, 0)), sentences.o1(w({ measures: [] }, 0))]).toEqual(['No court-ordered case reached a first session this quarter.', 'No follow-up scores were recorded this quarter.']);
    expect(summarize(null, 'Not available yet')).toBe('This quarter’s numbers are not available yet.');
    const x = { m1: { error: true }, m2: w({ median: 7 }, 20), m3: { error: true }, m4: { error: true }, m5: { error: true }, m6: { error: true }, o1: { error: true }, trend: [], filtered: false } as unknown as DashboardMetrics;
    expect(summarize(x, 'Jul 2026')).toBe('Funding decisions took a median of 7 days from application. Data as of Jul 2026.');
    expect(summarize({ ...x, m2: { error: true } }, 'Not available yet')).toBe('This quarter’s numbers are not available yet. Data date not available yet.');
  });
});
