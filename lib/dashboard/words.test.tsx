import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { M4Table } from '@/components/dashboard/M4Table';
import { STAGES } from '@/lib/dashboard/query';
import type { M4Result } from '@/lib/dashboard/metrics-query';
import { HIDDEN_SMALL } from '@/lib/trust/glossary';
import { complementaryCell, DASH_TERMS, deltaHint, FILTER_HINTS, HIDDEN_RATE, m1Stats, m4Cell, stageHint, STAGE_WORDS, trendChartPoints } from '@/lib/dashboard/words';

const row = (band: string, completed: number | null, closed: number | null, rate: number | null, suppressed = false, complementary = false) =>
  ({ band, completed, closed, rate, suppressed, complementary });
const m4: M4Result = { n: 29, rows: [row('a', 12, 14, 0.857), row('b', null, null, null, true, true), row('c', null, null, null, true)], total: row('total', 25, 29, 0.862), includesHiddenBands: true };
const CODES = /\b(M[1-6]|O1|pct|MOE|FIPS)\b/;

describe('DS-15a dashboard words', () => {
  it('AC1: an M4 cell carries its term, the value in words, the source and the as-of; hidden cells carry the reason and no value', () => {
    expect(m4Cell('completed', m4.rows[0]!, 'Sep 2026')).toEqual({ 'data-term': 'm4_completed', 'data-value': '12 in the a band', 'data-source': 'FAS records', 'data-asof': 'Sep 2026', 'data-hidden': undefined });
    expect(m4Cell('rate', m4.total!, 'Sep 2026')['data-value']).toBe('86% across all bands');
    const small = m4Cell('closed', m4.rows[2]!, 'Sep 2026'), smallRate = m4Cell('rate', m4.rows[2]!, 'Sep 2026');
    expect([small['data-value'], small['data-hidden'], smallRate['data-hidden']]).toEqual([undefined, HIDDEN_SMALL, HIDDEN_SMALL]);
    expect(m4Cell('rate', row('a', 12, 14, null), 'Sep 2026')['data-hidden']).toBe(HIDDEN_RATE);
    expect(complementaryCell('Sep 2026')).toMatchObject({ 'data-term': 'complementary', 'data-hidden': 'Hidden so the smaller group next to it cannot be worked out from the total.' });
    for (const t of Object.values(DASH_TERMS)) expect(`${t.title} ${t.plain}`).not.toMatch(CODES);
  });
  it('AC2: the table sits in one explain layer inside a keyboard region; every count, rate, complementary and total cell is a target', () => {
    const out = renderToStaticMarkup(<M4Table data={m4} asOf="Sep 2026" />);
    expect(out.match(/data-slot="explain-layer"/g)).toHaveLength(1);
    expect(out).toContain('role="region" tabindex="0" aria-label="Completion by income band"');
    expect(out.match(/<td [^>]*data-term="m4_(completed|closed|rate)"[^>]*tabindex="-1"/g)).toHaveLength(9);
    expect(out).toMatch(/<td colSpan="3" tabindex="-1" data-term="complementary"[^>]*>Hidden · protects another cell/);
    expect(out).toContain(`data-hidden="${HIDDEN_SMALL}"`);
  });
  it('AC3: one plain sentence per filter and per stored stage, with the count in words; no codes', () => {
    expect(Object.keys(FILTER_HINTS)).toEqual(['period', 'county', 'referral', 'compare']);
    expect(Object.keys(STAGE_WORDS)).toEqual([...STAGES]);
    expect(stageHint('New', '3')).toBe('Found in a grant list and not yet looked at. 3 opportunities are at this stage.');
    expect([stageHint('Awarded', 1), stageHint('Passed', '0')]).toEqual(['The funder said yes. 1 opportunity is at this stage.', 'FAS chose not to apply. No opportunities are at this stage.']);
    for (const s of [...Object.values(FILTER_HINTS), ...Object.values(STAGE_WORDS)]) { expect(s).toMatch(/^[A-Z].*\.$/); expect(s).not.toMatch(CODES); }
  });
  it('AC4: trend points keep the quarter label and the hidden quarter as null', () => {
    expect(trendChartPoints([{ period: '2026-Q1', median: null }, { period: '2026-Q2', median: 27 }])).toEqual([{ label: 'Q1 ’26', value: null }, { label: 'Q2 ’26', value: 27 }]);
  });
  it('AC5: the delta hint names the prior quarter in full and which way is better; the M1 line has no pct code', () => {
    expect(deltaHint('↓ 4 days faster than Q2', 'down', '2026-Q2')).toBe('↓ 4 days faster than Apr–Jun 2026 (Q2). Lower is better for this number.');
    expect(deltaHint('No change from Q2', 'down', '2026-Q2')).toBe('No change from Apr–Jun 2026 (Q2). Lower is better for this number.');
    expect(deltaHint(null, 'down', '2026-Q2')).toBeUndefined();
    expect(m1Stats({ p25: 14, p75: 37, n: 64, stillWaitingShare: 0.09 })).toBe('A quarter of families waited 14 days or less · a quarter waited 37 days or more · n = 64 · Still waiting 9%');
    expect(m1Stats({ p25: null, p75: null, n: 12, stillWaitingShare: null })).toBe('n = 12');
  });
});
