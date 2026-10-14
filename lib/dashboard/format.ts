/** DS-07 "Metric cards" formatters. A suppressed value (null) passes through as null so the caller renders `SuppressedCell`. */
type Num = number | null | undefined;
export type DeltaUnit = 'days' | 'pts' | 'money'; export type TrendPoint = { period: string; median: number | null };
/** `non_start_reason` codes → plain words; unknown codes fall back to the code itself. */
export const REASONS: Record<string, string> = { moved: 'Moved away', declined: 'Declined services', waitlist: 'Waitlisted', unknown: 'Unknown' };
export const reasonLabel = (code: string): string => REASONS[code] ?? code;
export const quarterShort = (period: string): string => period.replace(/^\d{4}-/, '');
export const num = (x: Num): string | null => (x == null ? null : Math.round(x).toLocaleString('en-US'));
export const days = (x: Num): string | null => (x == null ? null : `${num(x)} ${Math.round(x) === 1 ? 'day' : 'days'}`);
export const pct = (x: Num): string | null => (x == null ? null : `${Math.round(x * 100)}%`);
export const money = (x: Num): string | null => (x == null ? null : `$${num(x)}`);
/** O1 mean change with its sign (`+0.5`, `−1.8`, `0.0`); null passes through. */
export const signed = (x: Num): string | null => (x == null ? null : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}`);
/** M4 band codes: `unknown` → `Unknown`, `total` → `All bands`, others as stored. */
export const bandLabel = (band: string): string => (band === 'unknown' ? 'Unknown' : band === 'total' ? 'All bands' : band);
/** Arrow + words, never colour alone: `↓ 4 days faster than Q2`, `↑ 2 pts lower than Q2`, `No change from Q2`; null when either side is suppressed. */
export function delta(current: Num, prior: Num, unit: DeltaUnit, priorPeriod: string): string | null {
  if (current == null || prior == null) return null;
  const q = quarterShort(priorPeriod), diff = Math.round(unit === 'pts' ? (current - prior) * 100 : current - prior), size = Math.abs(diff);
  if (diff === 0) return `No change from ${q}`;
  const amount = unit === 'days' ? days(size) : unit === 'pts' ? `${size} pts` : money(size), [down, up] = unit === 'days' ? ['faster', 'slower'] : ['lower', 'higher'];
  return `${diff < 0 ? '↓' : '↑'} ${amount} ${diff < 0 ? down : up} than ${q}`;
}
/** Text equivalent of the M1 trend line, from the first and last known medians. */
export function trendSummary(points: TrendPoint[]): string {
  const known = points.map((p) => p.median).filter((m): m is number => m != null);
  if (known.length < 2) return 'Not enough quarters to show a trend';
  const [a, b] = [num(known[0]), num(known[known.length - 1])], span = `over ${points.length} quarters`;
  return a === b ? `Median unchanged at ${a} days ${span}` : `Median ${Number(b) < Number(a) ? 'fell' : 'rose'} from ${a} to ${b} days ${span}`;
}
