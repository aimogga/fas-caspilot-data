import { describe, expect, it } from 'vitest';
import { CADENCE_DAYS, DEFAULT_CYCLE_DAYS, Freshness, MAX_ROWS, type FreshnessSource } from './freshness';

const NOW = new Date('2026-10-13T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const src = (name: string, last_success_at: string | null, cadence: string | null = 'monthly', id = name): FreshnessSource => ({ id, name, cadence, last_success_at });

describe('freshness status (D-021: stale once one update cycle overdue)', () => {
  it('exports the cadence table', () => {
    expect(CADENCE_DAYS).toEqual({ monthly: 31, quarterly: 92, annual: 366, yearly: 366 });
    expect([Freshness.cycleDays('Annual'), Freshness.cycleDays(null), Freshness.cycleDays('weekly'), DEFAULT_CYCLE_DAYS]).toEqual([366, 366, 366, 366]);
  });

  it('is not published without a success; failed when the latest run failed after the last success; otherwise current or stale', () => {
    expect(Freshness.status(src('a', null), { source_id: 'a', status: 'failed', started_at: daysAgo(1) }, NOW)).toBe('not_published');
    expect(Freshness.status(src('a', daysAgo(2)), { source_id: 'a', status: 'failed', started_at: daysAgo(1) }, NOW)).toBe('failed');
    expect(Freshness.status(src('a', daysAgo(1)), { source_id: 'a', status: 'failed', started_at: daysAgo(2) }, NOW)).toBe('current');
    expect(Freshness.status(src('a', daysAgo(1)), { source_id: 'a', status: 'OK', started_at: daysAgo(1) }, NOW)).toBe('current');
    expect(Freshness.status(src('a', daysAgo(40)), { source_id: 'a', status: 'success', started_at: daysAgo(40) }, NOW)).toBe('stale');
    expect(Freshness.status(src('a', daysAgo(40), 'quarterly'), null, NOW)).toBe('current');
  });

  it('treats exactly one cycle as current and one day over as stale, per cadence', () => {
    for (const [cadence, days] of [['monthly', 31], ['quarterly', 92], ['annual', 366], ['yearly', 366], [null, 366], ['weekly', 366]] as const) {
      expect(Freshness.status(src('a', daysAgo(days), cadence), null, NOW), `${cadence} at boundary`).toBe('current');
      expect(Freshness.status(src('a', daysAgo(days + 1), cadence), null, NOW), `${cadence} one day over`).toBe('stale');
    }
  });

  it('sorts worst first then A–Z, caps at four rows, and shows the max vintage or a dash', () => {
    const sources = [src('zeta', daysAgo(1)), src('alpha', daysAgo(1)), src('old', daysAgo(400)), src('never', null), src('broken', daysAgo(5)), src('mid', daysAgo(1))];
    const runs = [{ source_id: 'broken', status: 'ok', started_at: daysAgo(5) }, { source_id: 'broken', status: 'error', started_at: daysAgo(2) }];
    const indicators = [{ source_id: 'old', vintage: '2022' }, { source_id: 'old', vintage: '2023' }, { source_id: 'broken', vintage: '2024' }];
    const rows = Freshness.rows(sources, runs, indicators, NOW);
    expect(rows).toHaveLength(MAX_ROWS);
    expect(rows.map((r) => `${r.name}:${r.status}:${r.latestVintage}`)).toEqual(['broken:failed:2024', 'old:stale:2023', 'never:not_published:—', 'alpha:current:—']);
    expect(Freshness.rows([], [], [], NOW)).toEqual([]);
  });

  it('view as-of is the latest success among the listed sources, else Not available yet', () => {
    expect(Freshness.view([src('a', null)], [], [], NOW).asOf).toBe('Not available yet');
    const view = Freshness.view([src('a', '2026-09-02T00:00:00Z'), src('b', '2026-10-01T00:00:00Z', 'annual')], [], [], NOW);
    expect(view.asOf).toBe('Oct 2026');
    expect(view.rows.map((r) => r.name)).toEqual(['a', 'b']);
  });
});
