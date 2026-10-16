import { describe, expect, it } from 'vitest';
import { deadlineItems, dueWords, reasonItem, Todo, uploadItems, type BatchRow, type DeadlineRow, type NeverStartedRow } from './todo';
const now = new Date('2026-10-15T20:00:00Z');
const batch = (v: Partial<BatchRow>): BatchRow => ({ id: 'b1', entity: 'case', rows_error: 0, status: 'committed', created_at: '2026-10-01T10:00:00Z', ...v });
const dl = (close: string | null, status = 'Pursuing', title = 'Family therapy access grant'): DeadlineRow => ({ status, opportunity: { title, funder: 'HHS', close_date: close } });
const ns = (decision_date: string, reason: string | null = null, started = false): NeverStartedRow => ({ decision_date, started_within_window: started, non_start_reason: reason });

describe('Todo (DS-10b)', () => {
  it('lists uploads with failed rows first, then unfinished batches, newest first, three at most; finished batches never appear', () => {
    const rows = [batch({ id: 'a', status: 'pending', created_at: '2026-10-03T00:00:00Z' }), batch({ id: 'b', rows_error: 4, entity: 'delivery_episode' }), batch({ id: 'c' }), batch({ id: 'd', status: 'rolled_back' }),
      batch({ id: 'e', status: 'draft', entity: null, created_at: '2026-10-02T00:00:00Z' }), batch({ id: 'f', status: 'draft', created_at: '2026-09-02T00:00:00Z' })];
    const items = uploadItems(rows);
    expect(items.map((i) => [i.badge, i.title, i.detail, i.href])).toEqual([
      ['Fix rows', '4 rows failed checks in the therapy episodes upload', 'Uploaded Oct 1, 2026', '/staff/intake'],
      ['Unfinished', 'The cases upload was never finished', 'Started Oct 3, 2026', '/staff/intake'],
      ['Unfinished', 'An upload was never finished', 'Started Oct 2, 2026', '/staff/intake']]);
    expect(uploadItems([batch({}), batch({ status: 'ok' })])).toEqual([]);
  });
  it('keeps pipeline grants in an active stage that close within 30 days, soonest first, with the days left in words', () => {
    const rows = [dl('2026-11-20'), dl('2026-10-30', 'reviewing', 'School counselling pilot'), dl('2026-10-15', 'New', 'Court diversion fund'), dl('2026-10-16', 'Submitted'), dl('2026-10-10'), dl(null), { status: 'new', opportunity: null }];
    const items = deadlineItems(rows, now);
    expect(items.map((i) => [i.badge, i.title, i.detail, i.hint])).toEqual([
      ['Due today', 'Court diversion fund', 'HHS · closes Oct 15, 2026', 'Closes Oct 15, 2026. Stage in the grant pipeline: New.'],
      ['Due in 15 days', 'School counselling pilot', 'HHS · closes Oct 30, 2026', 'Closes Oct 30, 2026. Stage in the grant pipeline: Reviewing.']]);
    expect([dueWords(0), dueWords(1), dueWords(12)]).toEqual(['Due today', 'Due tomorrow', 'Due in 12 days']);
  });
  it('counts approved families past 60 days with no session and no reason, hides the count under 11, and drops the row at zero', () => {
    const old = Array.from({ length: 12 }, () => ns('2026-07-01')), fresh = [ns('2026-09-30'), ns('2026-07-01', 'moved'), ns('2026-07-01', null, true)];
    expect(reasonItem([...old, ...fresh], now)).toMatchObject({ badge: 'Missing', title: '12 families never started therapy and have no reason recorded', href: '/staff/entry', detail: expect.stringContaining('60 days') });
    expect(reasonItem(old.slice(0, 3), now)).toMatchObject({ title: 'Some families never started therapy and have no reason recorded', detail: 'Fewer than 11 families, so the number is hidden to protect privacy.' });
    expect(reasonItem([ns('2026-07-01', 'unknown')], now)?.title).toBe('Some families never started therapy and have no reason recorded');
    expect(reasonItem(fresh, now)).toBeNull();
  });
  it('orders uploads → deadlines → reasons, is empty with nothing to do, names a failed source and errors only when all three fail', () => {
    const view = Todo.build({ batches: [batch({ rows_error: 2 })], deadlines: [dl('2026-10-20')], neverStarted: Array.from({ length: 11 }, () => ns('2026-07-01')) }, now);
    expect([view.state, view.items.map((i) => i.kind), view.missed]).toEqual(['items', ['upload', 'deadline', 'reason'], []]);
    expect(Todo.build({ batches: [], deadlines: [], neverStarted: [] }, now)).toEqual({ state: 'empty', items: [], missed: [] });
    expect(Todo.build({ batches: null, deadlines: [], neverStarted: [] }, now)).toMatchObject({ state: 'empty', missed: ['uploads'] });
    expect(Todo.build({ batches: null, deadlines: null, neverStarted: null }, now)).toMatchObject({ state: 'error', missed: ['uploads', 'grant deadlines', 'never-started reasons'] });
  });
});
