import { describe, expect, it } from 'vitest';
import { CADENCE_DAYS as DASHBOARD_CADENCE_DAYS, Freshness as DashboardFreshness } from '../dashboard/freshness';
import { aggregate, CADENCE_DAYS, Freshness, humanCadence, RANK, runDate, staleDays } from './status';

const NOW = new Date('2026-10-13T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('DS-05 freshness helpers', () => {
  it('re-exports the D-021 rule instead of duplicating it', () => {
    expect(CADENCE_DAYS).toBe(DASHBOARD_CADENCE_DAYS);
    expect(Freshness).toBe(DashboardFreshness);
  });

  it('aggregates with priority Failed > Stale > Not published > Current, null when empty', () => {
    expect(RANK).toEqual({ failed: 0, stale: 1, not_published: 2, current: 3 });
    expect(aggregate([])).toBeNull();
    expect(aggregate([{ status: 'current' }])).toBe('current');
    expect(aggregate([{ status: 'current' }, { status: 'not_published' }])).toBe('not_published');
    expect(aggregate([{ status: 'not_published' }, { status: 'stale' }, { status: 'current' }])).toBe('stale');
    expect(aggregate([{ status: 'current' }, { status: 'stale' }, { status: 'failed' }, { status: 'not_published' }])).toBe('failed');
    expect(aggregate([{ status: 'failed' }, { status: 'stale' }])).toBe('failed');
  });

  it('counts whole days since the last success, null when never', () => {
    expect(staleDays({ last_success_at: daysAgo(60) }, NOW)).toBe(60);
    expect(staleDays({ last_success_at: new Date(NOW.getTime() - 1.9 * 86_400_000).toISOString() }, NOW)).toBe(1);
    expect(staleDays({ last_success_at: daysAgo(-3) }, NOW)).toBe(0);
    expect(staleDays({ last_success_at: null }, NOW)).toBeNull();
  });

  it('humanises cadence and falls back to a dash', () => {
    expect(['monthly', 'quarterly', 'annual', 'yearly', ' Monthly ', 'weekly', null, ''].map(humanCadence)).toEqual(['Monthly', 'Quarterly', 'Annual', 'Yearly', 'Monthly', 'Weekly', '—', '—']);
  });

  it('formats run dates at day precision in UTC, Never for null or garbage', () => {
    expect(runDate('2026-10-12T23:30:00Z')).toBe('Oct 12, 2026');
    expect(runDate('2026-01-01T00:00:00Z')).toBe('Jan 1, 2026');
    expect(runDate(null)).toBe('Never');
    expect(runDate('not a date')).toBe('Never');
  });
});
