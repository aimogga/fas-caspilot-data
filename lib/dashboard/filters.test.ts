import { describe, expect, it } from 'vitest';
import { activeCount, describeFilters, latestCompleteQuarter, parseFilters, priorQuarter, quarterLabel, quarterOptions } from './filters';

const NOW = new Date('2026-10-13T12:00:00Z');
const DEFAULTS = { period: '2026-Q3', county: 'all', referral: 'all', compare: 'prior' };

describe('dashboard filters (DS-07a)', () => {
  it('defaults to the latest complete quarter with prior-quarter compare on', () => {
    expect(latestCompleteQuarter(NOW)).toBe('2026-Q3');
    expect(latestCompleteQuarter(new Date('2026-01-01T00:00:00Z'))).toBe('2025-Q4');
    expect(parseFilters({}, NOW)).toEqual(DEFAULTS);
    expect(quarterOptions(NOW)).toEqual(['2026-Q3', '2026-Q2', '2026-Q1', '2025-Q4', '2025-Q3', '2025-Q2', '2025-Q1', '2024-Q4']);
    expect([priorQuarter('2026-Q1'), priorQuarter('2026-Q3'), priorQuarter('x')]).toEqual(['2025-Q4', '2026-Q2', 'x']);
    expect([quarterLabel('2026-Q3'), quarterLabel('2026-Q1'), quarterLabel('2025-Q4'), quarterLabel('bogus')]).toEqual(['Jul–Sep 2026 (Q3)', 'Jan–Mar 2026 (Q1)', 'Oct–Dec 2025 (Q4)', 'bogus']);
  });

  it('accepts valid values, falls back on invalid ones and counts active filters', () => {
    const f = parseFilters({ period: '2026-Q1', county: '49035', referral: 'court', compare: 'none' }, NOW, ['49035']);
    expect(f).toEqual({ period: '2026-Q1', county: '49035', referral: 'court', compare: 'none' });
    expect(parseFilters({ period: '2026-Q4', county: '99999', referral: '   ', compare: 'bogus' }, NOW, ['49035'])).toEqual(DEFAULTS);
    expect(parseFilters({ period: ['2020-Q9'], compare: ['none', 'prior'], referral: 'x'.repeat(81) }, NOW)).toEqual(DEFAULTS);
    expect([activeCount(f, NOW), activeCount(parseFilters({}, NOW), NOW)]).toEqual([4, 0]);
    expect(describeFilters(parseFilters({}, NOW), null)).toBe('Jul–Sep 2026 (Q3) · All counties · All referral sources');
    expect(describeFilters(f, 'Salt Lake')).toBe('Jan–Mar 2026 (Q1) · Salt Lake County · court');
  });
});
