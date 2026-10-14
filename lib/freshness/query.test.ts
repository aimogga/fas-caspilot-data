import { describe, expect, it } from 'vitest';
import { FreshnessPage, type RunRow, type SourceRow } from './query';

const NOW = new Date('2026-10-13T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const src = (name: string, last: string | null, cadence: string | null = 'monthly', status = 'active', owner: string | null = 'Census'): SourceRow => ({ id: name, name, owner, cadence, status, last_success_at: last });
const run = (source_id: string, status: string, started_at: string, id = `run-${source_id}`): RunRow => ({ id, source_id, status, started_at });

describe('FreshnessPage.build (DS-05a)', () => {
  const sources = [src('zeta', daysAgo(2), 'annual'), src('alpha', daysAgo(1)), src('old', daysAgo(60), 'monthly', 'paused'), src('never', null, null, 'active', null), src('broken', daysAgo(10), 'quarterly')];
  const runs = [run('broken', 'ok', daysAgo(10), 'ok-run'), run('broken', 'failed', daysAgo(1), 'bad-run'), run('alpha', 'ok', daysAgo(1))];
  const indicators = [{ source_id: 'old', vintage: '2022' }, { source_id: 'old', vintage: '2023' }, { source_id: 'alpha', vintage: '2024' }];

  it('sorts worst first then A–Z, formats each column, and aggregates to the worst status', () => {
    const view = FreshnessPage.build(sources, runs, indicators, NOW, 'admin');
    expect(view.rows.map((r) => `${r.name}:${r.status}`)).toEqual(['broken:failed', 'old:stale', 'never:not_published', 'alpha:current', 'zeta:current']);
    expect(view.rows[0]).toMatchObject({ runId: 'bad-run', cadence: 'Quarterly', lastSuccess: runDateOf(10), latestVintage: '—', staleDays: null, paused: false, owner: 'Census' });
    expect(view.rows[1]).toMatchObject({ paused: true, latestVintage: '2023', staleDays: 60, cadence: 'Monthly' });
    expect(view.rows[2]).toMatchObject({ lastSuccess: 'Never', latestVintage: '—', cadence: '—', owner: null, runId: null, staleDays: null });
    expect(view.rows[3]).toMatchObject({ latestVintage: '2024', runId: 'run-alpha' });
    expect(view).toMatchObject({ aggregate: 'failed', asOf: runDateOf(1), chip: { status: 'failed', label: 'Last run failed' }, showRun: true });
  });

  it('hides the run column for staff, and returns an empty view with no as-of when there are no sources', () => {
    expect(FreshnessPage.build(sources, runs, indicators, NOW, 'staff').showRun).toBe(false);
    expect(FreshnessPage.build([], [], [], NOW, 'staff')).toEqual({ rows: [], asOf: null, aggregate: null, chip: null, showRun: false });
    expect(FreshnessPage.build([src('a', null)], [], [], NOW, null)).toMatchObject({ asOf: null, aggregate: 'not_published', chip: { status: 'not_published', label: 'Not published' } });
  });
});

function runDateOf(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
