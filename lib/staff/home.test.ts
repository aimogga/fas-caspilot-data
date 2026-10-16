import { describe, expect, it } from 'vitest';
import type { DashboardMetrics } from '@/lib/dashboard/metrics-query';
import { chip, dateEyebrow, firstName, greeting, sourceName, StaffHome, summary, vintageWords } from './home';
const w = <T>(v: T, n: number, delta: string | null = null) => ({ n, rows: n, viewRows: n, asOf: 'Jul 2026', delta, ...v });
const q = (vals: (number | null)[]) => ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'].map((period, i) => ({ period, value: vals[i] ?? null }));
const metrics = (m1: object, m2: object = w({ median: null }, 4), m4: object = w({ total: { rate: 0.71 } }, 29, '↑ 3 pts higher than Q2')) => ({
  m1, m2, m4, trends: { m1: q([34, null, 27, 23]), m2: q([null, null, null, null]), m3: q([]), m5: q([]) }, trend: [], filtered: false,
}) as unknown as DashboardMetrics;
const x = metrics(w({ median: 23 }, 12, '↓ 4 days faster than Q2'));

describe('StaffHome (DS-10a)', () => {
  it('dates the eyebrow and picks the greeting on the Denver clock; the first name only with a full name', () => {
    expect(dateEyebrow(new Date('2026-10-15T20:00:00Z'))).toBe('Thursday, October 15');
    expect(dateEyebrow(new Date('2026-10-16T03:30:00Z'))).toBe('Thursday, October 15');
    expect(greeting(new Date('2026-10-15T15:00:00Z'), null)).toBe('Good morning');
    expect(greeting(new Date('2026-10-15T20:00:00Z'), 'Jordan')).toBe('Good afternoon, Jordan');
    expect(greeting(new Date('2026-10-16T01:00:00Z'), null)).toBe('Good evening');
    expect([firstName({ full_name: ' Jordan Rivera ' }), firstName({ name: 'Sam' }), firstName({ full_name: '' }), firstName({}), firstName(null)]).toEqual(['Jordan', 'Sam', null, null, null]);
  });
  it('words the direction chip from the delta and names the quarter and the better direction in the hint', () => {
    expect(chip('↓ 4 days faster than Q2', 'down', '2026-Q2')).toEqual({ tone: 'better', glyph: '↓', text: 'Better · 4 days faster', hint: '↓ 4 days faster than Apr–Jun 2026 (Q2). Lower is better for this number.' });
    expect(chip('↑ 1 day slower than Q2', 'down', '2026-Q2')).toMatchObject({ tone: 'worse', text: 'Worse · 1 day slower' });
    expect(chip('↑ 3 pts higher than Q2', 'up', '2026-Q2')).toMatchObject({ tone: 'better', text: 'Better · 3 points higher', hint: '↑ 3 points higher than Apr–Jun 2026 (Q2). Higher is better for this number.' });
    expect(chip('No change from Q2', 'up', '2026-Q2')).toMatchObject({ tone: 'same', glyph: '→', text: 'Same as last quarter' });
    expect(chip(null, 'up', '2026-Q2')).toBeNull();
  });
  it('writes one sentence about the quarter from the M1 median and delta, never an example number', () => {
    expect(summary(x)).toBe('Families are getting help faster than last quarter: 23 days to a first session.');
    expect(summary(metrics(w({ median: 25 }, 12, '↑ 2 days slower than Q2')))).toBe('Families are waiting longer for a first session than last quarter: 25 days.');
    expect(summary(metrics(w({ median: 23 }, 12, 'No change from Q2')))).toBe('Families waited 23 days for a first session, the same as last quarter.');
    expect(summary(metrics(w({ median: 23 }, 12)))).toBe('Families waited 23 days for a first session this quarter.');
    expect(summary(metrics(w({ median: null }, 4)))).toBe('Too few families this quarter to show how long they waited.');
    expect(summary(metrics(w({ median: null }, 0)))).toBe('No first sessions were recorded this quarter.');
    expect([summary(metrics({ error: true })), summary(null)]).toEqual(Array(2).fill("This quarter's numbers are not available yet."));
  });
  it('builds three cards: value, chip, points, n and as-of; n = 0 and a failed view never show the hatch', () => {
    const c = StaffHome.cards(x, '2026-Q3');
    expect(c.map((k) => [k.id, k.state, k.value, k.chip?.text ?? null, k.n])).toEqual([
      ['m1', 'value', '23 days', 'Better · 4 days faster', 12], ['m2', 'suppressed', null, null, 4], ['m4', 'value', '71%', 'Better · 3 points higher', 29]]);
    expect([c[0]?.valueText, c[0]?.points.map((p) => p.value), c[2]?.points]).toEqual(['23 days · Days to first session, Jul–Sep 2026 (Q3)', [34, null, 27, 23], []]);
    const states = StaffHome.cards(metrics(w({ median: null }, 0), { error: true }, w({ total: null }, 0)), '2026-Q3');
    expect(states.map((k) => [k.state, k.value, k.noData])).toEqual([['no-data', null, 'No closed cases this quarter'], ['error', null, 'No closed cases this quarter'], ['no-data', null, 'Not enough closed episodes']]);
    expect(StaffHome.cards(null, '2026-Q3').map((k) => [k.state, k.points, k.asOf, k.chip])).toEqual(Array(3).fill(['not-available', [], 'Not available yet', null]));
  });
  it('names public sources in words, never a registry code, and explains the vintage column or its absence (DS-10b)', () => {
    expect(['cdc-places', 'propublica_990', 'hrsa-hpsa-mh', 'va-vetpop', 'census-acs', 'example-monthly-source'].map(sourceName))
      .toEqual(['CDC PLACES', 'ProPublica nonprofit filings', 'HRSA mental-health shortage areas', 'VA veteran population', 'Census American Community Survey', 'Example monthly source']);
    expect(vintageWords('2024')).toMatchObject({ text: 'Latest 2024' });
    expect([vintageWords('—').text, vintageWords('').text, vintageWords('—').hint]).toEqual(['No load yet', 'No load yet', expect.stringContaining('first successful run')]);
  });
});
