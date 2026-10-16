/** Staff and admin home (DS-10a): a dated greeting, one sentence about the quarter, three KPI cards (M1, M2, M4) and the public sources list, all from the same
 * `MetricsQuery` as the dashboards (same suppression). Pure builders; `load` fetches. */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChartPoint } from '../charts/scale';
import { boardFilters } from '../board/query';
import { METRIC_CARDS, NOT_AVAILABLE } from '../dashboard/cards';
import { priorQuarter, quarterLabel } from '../dashboard/filters';
import { days, pct, quarterPoints } from '../dashboard/format';
import { MetricsQuery, type DashboardMetrics, type Loaded, type Wired } from '../dashboard/metrics-query';
import { FreshnessPage, type FreshnessPageView } from '../freshness/query';
import { Todo, type TodoView } from './todo';

const DENVER = 'America/Denver';
export type KpiId = 'm1' | 'm2' | 'm4';
export type KpiState = 'value' | 'suppressed' | 'no-data' | 'not-available' | 'error';
export type Chip = { tone: 'better' | 'worse' | 'same'; glyph: string; text: string; hint: string };
export type Kpi = {
  id: KpiId; title: string; noun: string; unit: string; goodWhen: 'up' | 'down'; state: KpiState; value: string | null; valueText: string | null;
  chip: Chip | null; points: ChartPoint[]; n: number; asOf: string; noData: string;
};
export type StaffHomeData = { period: string; metrics: DashboardMetrics; freshness: FreshnessPageView | null; todo: TodoView | null };
/** Registry codes in words for the Public sources card; an unknown code is shown as stored rather than guessed. */
const SOURCE_NAMES: Record<string, string> = {
  'census-sahie': 'Census SAHIE', 'census-saipe': 'Census SAIPE', 'census-acs': 'Census American Community Survey', 'cdc-places': 'CDC PLACES',
  'hrsa-hpsa-mh': 'HRSA mental-health shortage areas', 'va-vetpop': 'VA veteran population', 'propublica_990': 'ProPublica nonprofit filings',
  grants_gov: 'Grants.gov', usaspending: 'USAspending federal awards', ut_courts: 'Utah State Courts',
};
/** Plain words for a source code; an unmapped code is still shown as words (`example-failed-source` → `Example failed source`). */
export const sourceName = (code: string): string => SOURCE_NAMES[code] ?? code.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
/** The vintage column in words: `Latest 2024` with what a vintage is, or `No load yet` when nothing from the source has been stored. */
export const vintageWords = (vintage: string): { text: string; hint: string } =>
  vintage && vintage !== '—'
    ? { text: `Latest ${vintage}`, hint: 'The newest release of this source we have loaded. The source labels releases by year or month.' }
    : { text: 'No load yet', hint: 'Nothing from this source has been stored yet. The release label appears after the first successful run.' };
type Pick = (m: Wired & Record<string, unknown>) => number | null;
const SPEC: { id: KpiId; noun: string; unit: string; goodWhen: 'up' | 'down'; fmt: (x: number | null) => string | null; noData: string; pick: Pick }[] = [
  { id: 'm1', noun: 'Days to first session', unit: ' days', goodWhen: 'down', fmt: days, noData: 'No closed cases this quarter', pick: (m) => m.median as number | null },
  { id: 'm2', noun: 'Days to a decision', unit: ' days', goodWhen: 'down', fmt: days, noData: 'No closed cases this quarter', pick: (m) => m.median as number | null },
  { id: 'm4', noun: 'Share who finished therapy', unit: '%', goodWhen: 'up', fmt: pct, noData: 'Not enough closed episodes', pick: (m) => (m.total as { rate: number | null } | null)?.rate ?? null },
];
const denver = (now: Date, opts: Intl.DateTimeFormatOptions): string => new Intl.DateTimeFormat('en-US', { timeZone: DENVER, ...opts }).format(now);
/** `Thursday, October 15` on the Mountain clock (the eyebrow style sets it in caps). */
export const dateEyebrow = (now: Date): string => denver(now, { weekday: 'long', month: 'long', day: 'numeric' });
/** Morning before noon, afternoon before 5 pm, evening after, by the Denver clock; the first name only when the profile has one. */
export function greeting(now: Date, name: string | null): string {
  const hour = Number(denver(now, { hour: 'numeric', hourCycle: 'h23' })) % 24;
  const word = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return name ? `Good ${word}, ${name}` : `Good ${word}`;
}
/** First word of `full_name` (or `name`) in the auth user metadata; null when the profile has no name, so the greeting stays plain. */
export function firstName(meta: Record<string, unknown> | null | undefined): string | null {
  const full = [meta?.full_name, meta?.name].find((v): v is string => typeof v === 'string' && v.trim() !== '');
  return full?.trim().split(/\s+/)[0] ?? null;
}
/** Direction chip in words from a delta line: `Better · 4 days faster`, `Worse · 1 day slower`, `Same as last quarter`; the hint names the quarter and which way is better. */
export function chip(delta: string | null, goodWhen: 'up' | 'down', prior: string): Chip | null {
  if (!delta) return null;
  const better = `${goodWhen === 'down' ? 'Lower' : 'Higher'} is better for this number.`, q = quarterLabel(prior);
  if (delta.startsWith('No change')) return { tone: 'same', glyph: '→', text: 'Same as last quarter', hint: `No change from ${q}. ${better}` };
  const [glyph = '', ...rest] = delta.split(' '), words = rest.slice(0, rest.indexOf('than')).join(' ').replace(/\bpts\b/, 'points');
  const good = (glyph === '↓') === (goodWhen === 'down');
  return { tone: good ? 'better' : 'worse', glyph, text: `${good ? 'Better' : 'Worse'} · ${words}`, hint: `${glyph} ${words} than ${q}. ${better}` };
}
/** One serif sentence about the quarter, from the M1 median and its prior-quarter delta; never an example number. */
export function summary(x: DashboardMetrics | null): string {
  const m = x?.m1;
  if (!m || 'error' in m) return "This quarter's numbers are not available yet.";
  if (m.n === 0) return 'No first sessions were recorded this quarter.';
  if (m.median == null) return 'Too few families this quarter to show how long they waited.';
  const wait = days(m.median);
  if (m.delta?.startsWith('↓')) return `Families are getting help faster than last quarter: ${wait} to a first session.`;
  if (m.delta?.startsWith('↑')) return `Families are waiting longer for a first session than last quarter: ${wait}.`;
  if (m.delta) return `Families waited ${wait} for a first session, the same as last quarter.`;
  return `Families waited ${wait} for a first session this quarter.`;
}
export const StaffHome = {
  /** Three cards. A failed view is `error`, no data at all is `not-available`, n = 0 is `no-data`; only 1 ≤ n < 11 is `suppressed`. */
  cards(x: DashboardMetrics | null, period: string): Kpi[] {
    return SPEC.map((s) => {
      const m = x?.[s.id] as Loaded<Wired & Record<string, unknown>> | undefined, ok = !!m && !('error' in m), v = ok ? s.pick(m) : null, value = s.fmt(v);
      const state: KpiState = !m ? 'not-available' : !ok ? 'error' : m.n === 0 ? 'no-data' : v == null ? 'suppressed' : 'value';
      return {
        id: s.id, title: METRIC_CARDS.find((c) => c.id === s.id)?.title ?? s.id, noun: s.noun, unit: s.unit, goodWhen: s.goodWhen, state, value,
        valueText: value ? `${value} · ${s.noun}, ${quarterLabel(period)}` : null, chip: ok && state === 'value' ? chip(m.delta, s.goodWhen, priorQuarter(period)) : null,
        points: x && s.id !== 'm4' ? quarterPoints(x.trends[s.id], s.unit) : [], n: ok ? m.n : 0, asOf: ok ? m.asOf : NOT_AVAILABLE, noData: s.noData,
      };
    });
  },
  /** Metrics, the public-source list and the to-do list load side by side; a freshness or to-do failure only drops that card. */
  async load(client: SupabaseClient, now: Date, role: string | null | undefined, orgId: string | null = null): Promise<StaffHomeData> {
    const f = boardFilters(now), dropped = (what: string) => (e: unknown) => { console.error(`[home] ${what} failed`, { message: e instanceof Error ? e.message : 'unknown' }); return null; };
    const [metrics, freshness, todo] = await Promise.all([
      MetricsQuery.load(client, f), FreshnessPage.load(client, now, role).catch(dropped('freshness')), Todo.load(client, now, orgId).catch(dropped('to-do')),
    ]);
    return { period: f.period, metrics, freshness, todo };
  },
};
