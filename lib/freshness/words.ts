/** DS-16a: the data-freshness page in words. Pure builders over the DS-05 view; every sentence comes from stored rows and the D-021 cycle table, nothing is invented. */
import { CADENCE_DAYS, DEFAULT_CYCLE_DAYS, Freshness } from '../dashboard/freshness';
import { sourceName, vintageWords } from '../staff/home';
import type { Term } from '../trust/glossary';
import type { FreshnessPageRow, FreshnessPageView, RunDetail } from './query';
import { humanCadence, runDate } from './status';

export type Words = { text: string; hint: string };
const STALE_RULE = 'A source is stale once its last good load is older than its usual cycle.';
const NO_LOAD = 'No load yet';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The cadence word plus the expected gap in days; an unknown word or a missing cadence names the yearly fallback instead of a made-up count. */
export function cadenceWords(cadence: string | null): Words {
  const key = (cadence ?? '').trim().toLowerCase();
  if (!key) return { text: 'Not recorded', hint: `No cadence is recorded for this source, so it counts as stale after the yearly cycle of ${DEFAULT_CYCLE_DAYS} days.` };
  const word = humanCadence(cadence), days = CADENCE_DAYS[key];
  if (days === undefined) return { text: word, hint: `The source is recorded as "${word}", which has no day count yet, so it counts as stale after the yearly cycle of ${DEFAULT_CYCLE_DAYS} days.` };
  return { text: word, hint: `${word}: a new load is expected every ${days} days. The source counts as stale once its last good load is older than that.` };
}

/** Status chip words, dated from the row: Current · loaded …, Stale since …, Failed on …, Not published · no load yet; one sentence each for the hint. */
export function statusWords(row: Pick<FreshnessPageRow, 'status' | 'lastSuccess' | 'staleDays' | 'cadenceRaw' | 'run'>): Words {
  const cycle = Freshness.cycleDays(row.cadenceRaw), last = row.lastSuccess;
  switch (row.status) {
    case 'current': return { text: `Current · loaded ${last}`, hint: `The newest release is loaded. The last good load was ${last}, inside the usual cycle of ${cycle} days.` };
    case 'stale': return { text: `Stale since ${last} · ${plural(row.staleDays ?? 0, 'day')}`, hint: `Overdue for a refresh: the last good load was ${last}, ${plural(row.staleDays ?? 0, 'day')} ago, and this source usually updates every ${cycle} days.` };
    case 'failed': {
      const when = row.run ? ` on ${runDate(row.run.startedAt)}` : '';
      return { text: `Failed${when}`, hint: `The last attempt${when} failed, so the last good load, ${last}, is what the app shows.` };
    }
    default: return { text: 'Not published · no load yet', hint: 'Nothing from this source has loaded yet, so nothing is shown for it.' };
  }
}

/** `7 public sources: 1 failed, 1 stale, 1 with no load yet, 4 current.` (zero counts left out); null with no rows. */
export function summaryWords(view: Pick<FreshnessPageView, 'rows' | 'aggregate'>): Words | null {
  if (!view.rows.length || !view.aggregate) return null;
  const count = (s: FreshnessPageRow['status']) => view.rows.filter((r) => r.status === s).length;
  const parts = [[count('failed'), 'failed'], [count('stale'), 'stale'], [count('not_published'), 'with no load yet'], [count('current'), 'current']] as const;
  const list = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(', ');
  return { text: `${plural(view.rows.length, 'public source')}: ${list}.`, hint: 'The worst status across every source. The chip in the top bar shows the same thing.' };
}

export const VINTAGE_TERM: Term = { id: 'vintage', title: 'Latest vintage', plain: vintageWords('latest').hint };
export const RUN_TERM: Term = { id: 'ingest_run', title: 'Latest load', plain: 'One attempt to fetch and store a release from this source. Every number loaded by it points back to this run.' };

/** The vintage cell's card: value, source in words, as-of = last good load, and why it reads "No load yet". */
export function vintageCard(row: Pick<FreshnessPageRow, 'name' | 'latestVintage' | 'lastSuccess'>): { text: string; value: string; source: string; asOf?: string; hidden?: string } {
  const v = vintageWords(row.latestVintage), has = row.latestVintage !== '—';
  return { text: v.text, value: has ? row.latestVintage : NO_LOAD, source: sourceName(row.name), asOf: has ? row.lastSuccess : undefined, hidden: has ? undefined : v.hint };
}

const RUN_STATUS: Record<string, string> = { ok: 'Succeeded', success: 'Succeeded', failed: 'Failed', running: 'Running' };
/** The admin run cell: `Oct 12, 2026 · Failed` and the card rows (full id, started, finished, status in words, rows loaded). */
export function runWords(run: RunDetail | null): { text: string; rows: [string, string | undefined][] } {
  if (!run) return { text: NO_LOAD, rows: [] };
  const status = RUN_STATUS[run.status.trim().toLowerCase()] ?? humanCadence(run.status);
  const rows: [string, string | undefined][] = [
    ['Run id', run.id], ['Started', runDate(run.startedAt)], ['Finished', run.finishedAt ? runDate(run.finishedAt) : 'Not finished'], ['Status', status],
    ['Rows loaded', run.rowsLoaded == null ? undefined : String(run.rowsLoaded)],
  ];
  return { text: `${runDate(run.startedAt)} · ${status}`, rows };
}

export const footerWords = (asOf: string | null): string => `Public sources${asOf ? ` · as of ${asOf}` : ''}. ${STALE_RULE}`;
