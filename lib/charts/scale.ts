/**
 * Chart kit helpers (pure, tested). Every chart in the app is an inline SVG built from these: a linear scale with "nice"
 * ticks, a suppression-aware point type, and the plain-language sentences that stand in for the picture
 * (`role="img" aria-label`). Numbers never reach a chart without passing F-306 suppression first; a null value is a
 * suppressed or not-published point and is drawn as a hatched band, never as zero.
 */
export type ChartPoint = { label: string; value: number | null; note?: string };
export type Series = { name: string; points: ChartPoint[] };
export type Scale = { lo: number; hi: number; ticks: number[]; at: (v: number) => number };

/** Largest "nice" step (1, 2, 5 × 10^k) that yields at most `count` intervals over `span`. */
export function niceStep(span: number, count = 4): number {
  if (span <= 0) return 1;
  const raw = span / Math.max(count, 1), mag = 10 ** Math.floor(Math.log10(raw)), r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
}

/** Linear scale from the known values (nulls ignored) onto `[0, size]`, padded out to nice tick values; `floor` pins the low end (bars start at 0). */
export function linear(values: (number | null)[], size: number, { floor, count = 4, include = [] as number[] } = {} as { floor?: number; count?: number; include?: number[] }): Scale {
  const known = [...values.filter((v): v is number => v != null), ...include];
  if (floor != null) known.push(floor);
  if (known.length === 0) known.push(0, 1);
  let lo = Math.min(...known), hi = Math.max(...known);
  if (hi === lo) hi = lo + (lo === 0 ? 1 : Math.abs(lo) * 0.1);
  const step = niceStep(hi - lo, count);
  lo = floor != null ? floor : Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 1e6; t += step) ticks.push(Number(t.toFixed(10)));
  return { lo, hi, ticks, at: (v) => ((v - lo) / (hi - lo)) * size };
}

/** `1,284` · `12.9K` · `4.2M`; one decimal only when it changes the reading. */
export function compact(v: number): string {
  const a = Math.abs(v), f = (n: number, s: string) => `${v < 0 ? '−' : ''}${(a / n).toFixed(a / n >= 10 ? 0 : 1).replace(/\.0$/, '')}${s}`;
  return a >= 1e6 ? f(1e6, 'M') : a >= 1e3 ? f(1e3, 'K') : v.toLocaleString('en-US');
}

/** True minus sign for negatives (DESIGN rule 6), plain `toLocaleString` otherwise, with an optional unit. */
export const fmt = (v: number | null, unit = ''): string => (v == null ? 'Hidden' : `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US')}${unit}`);

/** Sentence for a ranked bar chart: `Utah has the most families (31), then Salt Lake (22) and Weber (12). 2 of 7 groups hidden.` */
export function barSummary(points: ChartPoint[], noun: string, unit = ''): string {
  const shown = points.filter((p) => p.value != null).sort((a, b) => (b.value as number) - (a.value as number)), hidden = points.length - shown.length;
  if (shown.length === 0) return `All ${points.length} ${noun} are hidden to protect privacy`;
  const part = (p: ChartPoint) => `${p.label} (${fmt(p.value, unit)})`;
  const lead = `${shown[0]!.label} has the most ${noun} (${fmt(shown[0]!.value, unit)})`;
  const rest = shown.slice(1, 3).map(part);
  const tail = rest.length ? `, then ${rest.join(' and ')}` : '';
  return `${lead}${tail}.${hidden ? ` ${hidden} of ${points.length} groups hidden because the count is under 11.` : ''}`;
}

/** Sentence for a line: `Days to first session fell from 34 to 23 over 5 quarters`; direction words never colour alone. */
export function lineSummary(points: ChartPoint[], noun: string, unit = ''): string {
  const known = points.filter((p) => p.value != null);
  if (known.length < 2) return `Not enough periods to show a trend for ${noun}`;
  const a = known[0]!, b = known[known.length - 1]!, span = `over ${points.length} periods (${a.label} to ${b.label})`;
  if (a.value === b.value) return `${noun} unchanged at ${fmt(a.value, unit)} ${span}`;
  return `${noun} ${(b.value as number) < (a.value as number) ? 'fell' : 'rose'} from ${fmt(a.value, unit)} to ${fmt(b.value, unit)} ${span}`;
}

/** `Better` / `Worse` / `Same` versus the prior point, given which direction is good; null when either side is hidden. */
export function direction(current: number | null, prior: number | null, goodWhen: 'up' | 'down'): 'better' | 'worse' | 'same' | null {
  if (current == null || prior == null) return null;
  if (current === prior) return 'same';
  return (current > prior) === (goodWhen === 'up') ? 'better' : 'worse';
}

/** Polyline coordinate pairs for the known points, breaking the line at a hidden point (one array per run). */
export function lineRuns(points: ChartPoint[], x: (i: number) => number, y: (v: number) => number): string[][] {
  const runs: string[][] = [[]];
  points.forEach((p, i) => { if (p.value == null) { if (runs[runs.length - 1]!.length) runs.push([]); } else runs[runs.length - 1]!.push(`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`); });
  return runs.filter((r) => r.length);
}
