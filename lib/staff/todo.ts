/** "Needs you" list on the staff and admin home (DS-10b). Every row comes from a stored table: upload batches that are not finished or carry failed rows,
 * grant opportunities in the pipeline that close within 30 days, and approved families who never started therapy with no reason recorded (that count goes
 * through `suppressCount` like every family count). Pure builders; `load` fetches under RLS. Nothing here invents a row. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { suppressCount } from '../metrics/suppress';
import { HIDDEN_SMALL } from '../trust/glossary';

export type BatchRow = { id: string; entity: string | null; rows_error: number | null; status: string; created_at: string };
export type DeadlineRow = { status: string; opportunity: { title: string; funder: string | null; close_date: string | null } | null };
export type NeverStartedRow = { decision_date: string; started_within_window: boolean; non_start_reason: string | null };
export type TodoInputs = { batches: BatchRow[] | null; deadlines: DeadlineRow[] | null; neverStarted: NeverStartedRow[] | null };
export type TodoKind = 'upload' | 'deadline' | 'reason';
export type TodoItem = { kind: TodoKind; badge: string; hint: string; title: string; detail: string; action: string; href: string };
export type TodoView = { state: 'items' | 'empty' | 'error'; items: TodoItem[]; missed: string[] };

const FINISHED = ['committed', 'rolled_back', 'ok'];
const ACTIVE_STAGES = ['new', 'reviewing', 'pursuing'];
const WINDOW_DAYS = 30, START_WINDOW_DAYS = 60, PER_KIND = 3, DAY = 86_400_000;
const ENTITY: Record<string, string> = { case: 'cases', application: 'applications', authorization: 'authorizations', delivery_episode: 'therapy episodes', outcome_measure: 'outcome scores', provider: 'providers' };
const HINT = {
  fix: 'Rows in this upload failed the checks, so they are not counted anywhere yet.',
  unfinished: 'This upload was started but never committed, so none of its rows are counted.',
  reason: 'Therapy was approved more than 60 days ago, no first session is recorded, and no reason is on file.',
};
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);
const longDate = (iso: string): string => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const plural = (n: number, word: string): string => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
/** `Due today`, `Due tomorrow`, `Due in 12 days`: the badge words for a close date measured in whole days from today. */
export const dueWords = (daysLeft: number): string => (daysLeft <= 0 ? 'Due today' : daysLeft === 1 ? 'Due tomorrow' : `Due in ${daysLeft} days`);

/** Uploads that still need a person: failed rows first, then batches never committed; newest first, at most three. */
export function uploadItems(rows: BatchRow[]): TodoItem[] {
  return rows
    .filter((b) => (b.rows_error ?? 0) > 0 || !FINISHED.includes(b.status))
    .sort((a, b) => Number((b.rows_error ?? 0) > 0) - Number((a.rows_error ?? 0) > 0) || b.created_at.localeCompare(a.created_at))
    .slice(0, PER_KIND)
    .map((b) => {
      const what = b.entity ? `the ${ENTITY[b.entity] ?? b.entity} upload` : 'an upload', bad = b.rows_error ?? 0;
      return bad > 0
        ? { kind: 'upload', badge: 'Fix rows', hint: HINT.fix, title: `${plural(bad, 'row')} failed checks in ${what}`, detail: `Uploaded ${longDate(b.created_at)}`, action: 'Open uploads', href: '/staff/intake' }
        : { kind: 'upload', badge: 'Unfinished', hint: HINT.unfinished, title: `${what[0]!.toUpperCase()}${what.slice(1)} was never finished`, detail: `Started ${longDate(b.created_at)}`, action: 'Open uploads', href: '/staff/intake' };
    });
}
/** Opportunities FAS is working on (New, Reviewing, Pursuing) that close within 30 days, soonest first, at most three. */
export function deadlineItems(rows: DeadlineRow[], now: Date): TodoItem[] {
  const today = isoDay(now), last = isoDay(new Date(now.getTime() + WINDOW_DAYS * DAY));
  return rows
    .filter((r) => r.opportunity?.close_date && ACTIVE_STAGES.includes(r.status.trim().toLowerCase()) && r.opportunity.close_date >= today && r.opportunity.close_date <= last)
    .sort((a, b) => a.opportunity!.close_date!.localeCompare(b.opportunity!.close_date!))
    .slice(0, PER_KIND)
    .map((r) => {
      const o = r.opportunity!, close = o.close_date!, daysLeft = Math.round((Date.parse(close) - Date.parse(today)) / DAY), stage = r.status.trim();
      const stageWord = `${stage[0]?.toUpperCase() ?? ''}${stage.slice(1).toLowerCase()}`;
      return { kind: 'deadline', badge: dueWords(daysLeft), hint: `Closes ${longDate(close)}. Stage in the grant pipeline: ${stageWord}.`, title: o.title, detail: `${o.funder ?? 'Funder not recorded'} · closes ${longDate(close)}`, action: 'Open grant matches', href: '/staff/grants/matches' };
    });
}
/** One row for approved families with no first session after 60 days and no reason recorded; the count is hidden under 11, never shown as 0. */
export function reasonItem(rows: NeverStartedRow[], now: Date): TodoItem | null {
  const cutoff = isoDay(new Date(now.getTime() - START_WINDOW_DAYS * DAY));
  const n = rows.filter((r) => !r.started_within_window && (r.non_start_reason ?? 'unknown') === 'unknown' && r.decision_date <= cutoff).length;
  if (n === 0) return null;
  const cell = suppressCount(n);
  return {
    kind: 'reason', badge: 'Missing', hint: HINT.reason, action: 'Enter a case', href: '/staff/entry',
    title: `${cell.value == null ? 'Some families' : `${cell.value} families`} never started therapy and have no reason recorded`,
    detail: cell.suppressed ? HIDDEN_SMALL : 'Approved more than 60 days ago with no first session. Recording the reason keeps the never-started measure honest.',
  };
}
export const Todo = {
  /** Fix rows → unfinished uploads → closing grants → missing reasons. A source that failed to load is named in `missed`; all three failing is `error`. */
  build(x: TodoInputs, now: Date): TodoView {
    const missed = [x.batches ? null : 'uploads', x.deadlines ? null : 'grant deadlines', x.neverStarted ? null : 'never-started reasons'].filter((s): s is string => s != null);
    if (missed.length === 3) return { state: 'error', items: [], missed };
    const reason = x.neverStarted ? reasonItem(x.neverStarted, now) : null;
    const items = [...uploadItems(x.batches ?? []), ...deadlineItems(x.deadlines ?? [], now), ...(reason ? [reason] : [])];
    return { state: items.length ? 'items' : 'empty', items, missed };
  },
  /** Three reads side by side under RLS; one failing read drops only its rows. The pipeline read needs the org id from the session. */
  async load(client: SupabaseClient, now: Date, orgId: string | null): Promise<TodoView> {
    const read = async <T>(name: string, q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[] | null> => {
      const r = await q.then((v) => v, (e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : 'unknown' } }));
      if (r.error) { console.error(`[home] ${name} failed`, { message: r.error.message }); return null; }
      return (r.data ?? []) as T[];
    };
    const [batches, deadlines, neverStarted] = await Promise.all([
      read<BatchRow>('upload_batch', client.from('upload_batch').select('id,entity,rows_error,status,created_at').order('created_at', { ascending: false }).limit(50)),
      orgId ? read<DeadlineRow>('pipeline_status', client.from('pipeline_status').select('status,opportunity(title,funder,close_date)').eq('org_id', orgId)) : Promise.resolve([] as DeadlineRow[]),
      read<NeverStartedRow>('m3_never_started', client.from('m3_never_started').select('decision_date,started_within_window,non_start_reason').eq('started_within_window', false)),
    ]);
    return Todo.build({ batches, deadlines, neverStarted }, now);
  },
};
