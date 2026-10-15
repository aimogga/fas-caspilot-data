/** F-402 "four pictures": the board page's charts, built from the same suppressed `DashboardMetrics` as the cards (F-306 applied upstream).
 * Pure. A hidden value stays `null` so the chart draws a hatched band, never a zero; a picture only exists when its metric loaded with n > 0. */
import { fmt, type ChartPoint } from '../charts/scale';
import { GROUP_LABELS } from '../dashboard/cards';
import { bandLabel, quarterShort, type TrendPoint } from '../dashboard/format';
import type { DashboardMetrics, Loaded, M4Result, M6Result, O1Result, Wired } from '../dashboard/metrics-query';

export type Picture = {
  id: 'wait' | 'completion' | 'dollars' | 'outcomes'; kind: 'line' | 'bar'; eyebrow: string; noun: string; unit: string; valueHead: string;
  headline?: string; points: ChartPoint[]; reference?: { value: number; label: string }; include?: number[]; n: number; asOf: string;
};
const pctPt = (x: number | null): number | null => (x == null ? null : Math.round(x * 100));
const PCT = { unit: '%', include: [100] };
const ok = <T extends Wired>(m: Loaded<T> | undefined): m is T & Wired => !!m && !('error' in m) && m.n > 0;
const HIDDEN_BAND = 'Fewer than 11 cases', PROTECTS = 'Hidden to protect another band', HIDDEN_FAMILIES = 'Fewer than 11 families';
/** `Under $30k finished therapy most often (90%), then $30k–$60k (82%). 1 of 4 bands hidden.` */
export function rankHeadline(points: ChartPoint[], verb: string, group: string): string {
  const shown = points.filter((p) => p.value != null).sort((a, b) => (b.value as number) - (a.value as number)), hidden = points.length - shown.length;
  const tail = hidden ? ` ${hidden} of ${points.length} ${group}s hidden to protect privacy.` : '';
  if (!shown[0]) return `All ${points.length} ${group}s are hidden to protect privacy.`;
  const next = shown[1] ? `, then ${shown[1].label} (${fmt(shown[1].value, '%')})` : '';
  return `${shown[0].label} ${verb} (${fmt(shown[0].value, '%')})${next}.${tail}`;
}
export const points = {
  /** M1 median by quarter; `Q3 ’26` labels (short enough for four across at 375px). */
  wait: (trend: TrendPoint[]): ChartPoint[] => trend.map((p) => ({ label: `${quarterShort(p.period)} ’${p.period.slice(2, 4)}`, value: p.median })),
  /** M4 completion rate per income band in whole percent; complementary rows carry their reason. */
  completion: (m: M4Result): ChartPoint[] =>
    m.rows.map((r) => ({ label: bandLabel(r.band), value: pctPt(r.rate), ...(r.complementary ? { note: PROTECTS } : r.suppressed ? { note: HIDDEN_BAND } : {}) })),
  /** M6 share of therapy dollars per provider group; both groups hide together with the share. */
  dollars: (m: M6Result): ChartPoint[] =>
    m.groups.map((g) => ({ label: GROUP_LABELS[g.group] ?? g.group, value: m.affiliatedShare == null ? null : pctPt(g.group === 'affiliated' ? m.affiliatedShare : 1 - m.affiliatedShare) })),
  /** O1 share of families improved per instrument with scores this quarter. */
  outcomes: (m: O1Result): ChartPoint[] =>
    m.measures.filter((x) => x.n > 0).map((x) => ({ label: x.label, value: pctPt(x.shareImproved), ...(x.suppressed ? { note: HIDDEN_FAMILIES } : {}) })),
};
/** The pictures the board can show this quarter, in reading order. Failed or empty metrics drop their picture (the cards below carry the state). */
export function boardPictures(x: DashboardMetrics | null): Picture[] {
  if (!x) return [];
  const out: Picture[] = [];
  if (ok(x.m1) && x.trend.length > 1) {
    out.push({ id: 'wait', kind: 'line', eyebrow: 'Wait for a first session', noun: 'Days to first session', unit: ' days', valueHead: 'Median days', points: points.wait(x.trend), n: x.m1.n, asOf: x.m1.asOf });
  }
  if (ok(x.m4)) {
    const pts = points.completion(x.m4), t = x.m4.total?.rate;
    out.push({ id: 'completion', kind: 'bar', eyebrow: 'Who finishes therapy', noun: 'completion rate', ...PCT, valueHead: 'Finished', points: pts, n: x.m4.n, asOf: x.m4.asOf,
      headline: rankHeadline(pts, 'finished therapy most often', 'band'), ...(t == null ? {} : { reference: { value: pctPt(t) as number, label: 'All bands' } }) });
  }
  if (ok(x.m6)) {
    const pts = points.dollars(x.m6);
    out.push({ id: 'dollars', kind: 'bar', eyebrow: 'Where therapy dollars went', noun: 'share of dollars', ...PCT, valueHead: 'Share', points: pts, n: x.m6.n, asOf: x.m6.asOf,
      headline: rankHeadline(pts, 'received the larger share of therapy dollars', 'group') });
  }
  if (ok(x.o1)) {
    const pts = points.outcomes(x.o1);
    if (pts.length) out.push({ id: 'outcomes', kind: 'bar', eyebrow: 'Families improving', noun: 'families improving', ...PCT, valueHead: 'Improved', points: pts, n: x.o1.n, asOf: x.o1.asOf,
      headline: rankHeadline(pts, 'improved most often', 'measure') });
  }
  return out;
}
