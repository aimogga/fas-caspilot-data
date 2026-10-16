import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { M4Table } from '@/components/dashboard/M4Table';
import { M6Card } from '@/components/dashboard/M6Card';
import { OutcomesCard } from '@/components/dashboard/OutcomesCard';
import { TrendToggle } from '@/components/dashboard/TrendToggle';
import { STAGES } from '@/lib/dashboard/query';
import type { M4Result, M6Result, O1Result } from '@/lib/dashboard/metrics-query';
import { GLOSSARY, HIDDEN_SMALL } from '@/lib/trust/glossary';
import { complementaryCell, DASH_TERMS, deltaHint, FILTER_HINTS, HIDDEN_RATE, m1Stats, m4Cell, m6Cell, m6Segment, o1Cell, stageHint, STAGE_WORDS, TABLE_HINT, trendChartPoints } from '@/lib/dashboard/words';

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

// DS-15b: the M6 share bar, the M6 and O1 cells and the `View as table` hint. Seed-shaped data: affiliated 59% / $120 / $1,700 / 17, other 41% / $90 / $1,200 / 12; PHQ-9 −1.5 / 75% / 12, GAD-7 under 11.
const groups: M6Result['groups'] = [{ group: 'affiliated', dollars: 1700, episodes: 17, avgRatePerUnit: 120 }, { group: 'other', dollars: 1200, episodes: 12, avgRatePerUnit: 90 }];
const m6: M6Result = { n: 29, affiliatedShare: 0.5862, groups };
const m6Hidden: M6Result = { n: 20, affiliatedShare: null, groups: [groups[0]!, { group: 'other', dollars: null, episodes: null, avgRatePerUnit: null }] };
const phq = { code: 'PHQ-9', label: 'PHQ-9', direction: 'lower_is_better' as const, n: 12, meanChange: -1.5, shareImproved: 0.75, improved: 9, unchanged: 3, worsened: 0, suppressed: false };
const o1: O1Result = { n: 15, measures: [phq, { ...phq, code: 'GAD-7', label: 'GAD-7', n: 3, meanChange: null, shareImproved: null, suppressed: true }] };
const targets = (markup: string, term: string) => markup.match(new RegExp(`<(td|span) [^>]*data-term="${term}"[^>]*tabindex="-1"`, 'g')) ?? [];

describe('DS-15b dashboard words', () => {
  it('AC7: a share segment carries the share and dollars in words; a hidden share says why (its own small count, or the other group\'s); M6 cells say their figure for the group', () => {
    expect(m6Segment('affiliated', 0.5862, 1700, 'Sep 2026')).toEqual({ 'data-term': 'm6_share', 'data-value': '59% of therapy dollars went to affiliated providers ($1,700)', 'data-source': 'FAS records', 'data-asof': 'Sep 2026', 'data-hidden': undefined });
    expect(m6Segment('other', null, null, 'Sep 2026')).toMatchObject({ 'data-value': undefined, 'data-hidden': HIDDEN_SMALL });
    expect(m6Segment('affiliated', null, 1700, 'Sep 2026')).toMatchObject({ 'data-value': undefined, 'data-hidden': GLOSSARY.complementary.plain });
    expect([m6Cell('rate', groups[0]!, 'Sep 2026')['data-value'], m6Cell('dollars', groups[1]!, 'Sep 2026')['data-value'], m6Cell('episodes', groups[1]!, 'Sep 2026')['data-value']])
      .toEqual(['$120 per hour for affiliated providers', '$1,200 paid to other providers', '12 episodes with other providers']);
    expect(m6Cell('rate', m6Hidden.groups[1]!, 'Sep 2026')).toMatchObject({ 'data-term': 'm6_rate', 'data-value': undefined, 'data-hidden': HIDDEN_SMALL });
    const out = renderToStaticMarkup(<M6Card data={m6} asOf="Sep 2026" />), hidden = renderToStaticMarkup(<M6Card data={m6Hidden} asOf="Sep 2026" />);
    expect(out.match(/data-slot="explain-layer"/g)).toHaveLength(1);
    expect(out).toContain('role="region" tabindex="0" aria-label="Where therapy dollars went"');
    expect(targets(out, 'm6_share')).toHaveLength(4);
    expect(out.match(/<span role="img" aria-label="(41|59)% of therapy dollars went to (other|affiliated) providers \(\$1,[27]00\)"/g)).toHaveLength(2);
    expect(targets(out, 'm6_(rate|dollars|episodes)')).toHaveLength(6);
    expect(hidden).not.toContain('data-slot="m6-bar"');
    expect(hidden).toContain(`data-term="m6_share" data-source="FAS records" data-asof="Sep 2026" data-hidden="${GLOSSARY.complementary.plain}"`);
  });
  it('AC8: an O1 cell says its figure for the survey with the direction in words; a row under 11 pairs carries the privacy sentence and no value on every cell', () => {
    expect(o1Cell('mean', phq, 'Sep 2026')).toEqual({ 'data-term': 'o1_mean', 'data-value': '−1.5 points on the PHQ-9 survey (lower is better)', 'data-source': 'FAS records', 'data-asof': 'Sep 2026', 'data-hidden': undefined });
    expect([o1Cell('improved', phq, 'Sep 2026')['data-value'], o1Cell('n', phq, 'Sep 2026')['data-value']]).toEqual(['75% of families improved on the PHQ-9 survey', '12 families with a start and an end score on the PHQ-9 survey']);
    for (const kind of ['mean', 'improved', 'n'] as const) expect(o1Cell(kind, o1.measures[1]!, 'Sep 2026')).toMatchObject({ 'data-value': undefined, 'data-hidden': HIDDEN_SMALL });
    const out = renderToStaticMarkup(<OutcomesCard data={o1} asOf="Sep 2026" />);
    expect(out.match(/data-slot="explain-layer"/g)).toHaveLength(1);
    expect(out).toContain('role="region" tabindex="0" aria-label="Outcome change by measure"');
    expect(targets(out, 'o1_(mean|improved|n)')).toHaveLength(6);
    for (const t of Object.values(DASH_TERMS)) expect(`${t.title} ${t.plain}`).not.toMatch(CODES);
  });
  it('AC9: the View as table toggle has an Info hint with one plain sentence that never prints', () => {
    expect(TABLE_HINT).toMatch(/^[A-Z].*\.$/);
    const out = renderToStaticMarkup(<TrendToggle table={<table />}>pic</TrendToggle>);
    expect(out).toMatch(/aria-expanded="false" aria-controls="[^"]+"[^>]*>View as table<\/button><span class="print:hidden"><button [^>]*aria-label="About the table view"[^>]*data-slot="hint-trigger"/);
  });
});
