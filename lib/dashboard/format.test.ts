import { describe, expect, it } from 'vitest';
import { bandLabel, days, delta, money, num, pct, quarterShort, reasonLabel, signed, trendSummary } from './format';
describe('dashboard formatters (DS-07b)', () => {
  it('formats days, percents, money and whole numbers; suppressed (null) passes through', () => {
    expect([days(23), days(39.5), days(1), pct(0.1765), pct(0.5), money(1840), money(403.5), num(35.75)]).toEqual(['23 days', '40 days', '1 day', '18%', '50%', '$1,840', '$404', '36']);
    expect([days(null), pct(null), money(undefined), num(null)]).toEqual([null, null, null, null]);
    expect([quarterShort('2026-Q2'), reasonLabel('moved'), reasonLabel('declined'), reasonLabel('waitlist'), reasonLabel('unknown'), reasonLabel('other_code')])
      .toEqual(['Q2', 'Moved away', 'Declined services', 'Waitlisted', 'Unknown', 'other_code']);
  });
  it('deltas use an arrow plus words, per unit, and hide when either side is suppressed', () => {
    expect([delta(23, 27, 'days', '2026-Q2'), delta(30, 27, 'days', '2026-Q2'), delta(27, 27.2, 'days', '2026-Q2')]).toEqual(['↓ 4 days faster than Q2', '↑ 3 days slower than Q2', 'No change from Q2']);
    expect([delta(0.1, 0.12, 'pts', '2025-Q4'), delta(1960, 1840, 'money', '2026-Q2')]).toEqual(['↓ 2 pts lower than Q4', '↑ $120 higher than Q2']);
    expect([delta(null, 27, 'days', '2026-Q2'), delta(23, null, 'days', '2026-Q2')]).toEqual([null, null]);
  });
  it('signs the O1 mean change and labels M4 bands; null passes through (DS-07c)', () => {
    expect([signed(0.5), signed(-1.8182), signed(0), signed(null)]).toEqual(['+0.5', '−1.8', '0.0', null]);
    expect([bandLabel('unknown'), bandLabel('total'), bandLabel('a')]).toEqual(['Unknown', 'All bands', 'a']);
  });
  it('summarises the trend direction from the first and last known medians', () => {
    const pts = (...m: (number | null)[]) => m.map((median, i) => ({ period: `2026-Q${i + 1}`, median }));
    expect(trendSummary(pts(27, null, 25, 23))).toBe('Median fell from 27 to 23 days over 4 quarters');
    expect(trendSummary(pts(20, 21, 22, 23))).toBe('Median rose from 20 to 23 days over 4 quarters');
    expect(trendSummary(pts(23, null, null, 23))).toBe('Median unchanged at 23 days over 4 quarters');
    expect(trendSummary(pts(null, null, null, 23))).toBe('Not enough quarters to show a trend');
  });
});
