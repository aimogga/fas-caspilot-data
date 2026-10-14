import { TrendToggle } from "@/components/dashboard/TrendToggle";
import { SuppressedCell } from "@/components/trust";
import { quarterLabel } from "@/lib/dashboard/filters";
import { num, quarterShort, trendSummary, type TrendPoint } from "@/lib/dashboard/format";
const W = 320, H = 64, PAD = 8, stroke = { fill: "none", stroke: "var(--chart-1)", vectorEffect: "non-scaling-stroke" as const };
/** Four quarters of the M1 median as an inline SVG (`--chart-1`, 64px tall, full width) with a text summary and a quarter-by-quarter table. */
export function TrendLine({ points, label }: { points: TrendPoint[]; label: string }) {
  const known = points.map((p) => p.median).filter((m): m is number => m != null), [lo, hi] = [Math.min(...known), Math.max(...known)];
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(points.length - 1, 1);
  const y = (v: number) => (hi === lo ? H / 2 : PAD + (H - 2 * PAD) * (1 - (v - lo) / (hi - lo)));
  const coords = points.flatMap((p, i) => (p.median == null ? [] : [`${x(i)},${y(p.median).toFixed(1)}`]));
  const table = (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">{label} by quarter</caption>
      <thead><tr><th scope="col" className="text-left font-medium">Quarter</th><th scope="col" className="text-right font-medium">Median days</th></tr></thead>
      <tbody>{points.map((p) => (
        <tr key={p.period}><th scope="row" className="text-left font-normal">{quarterLabel(p.period)}</th><td className="text-right tabular-nums">{p.median == null ? <SuppressedCell /> : num(p.median)}</td></tr>
      ))}</tbody>
    </table>
  );
  return (
    <TrendToggle table={table}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={trendSummary(points)} className="h-16 w-full">
        {coords.length > 1 ? <polyline points={coords.join(" ")} strokeWidth={2} {...stroke} /> : null}
        {coords.map((c) => <polyline key={c} points={`${c} ${c}`} strokeWidth={6} strokeLinecap="round" {...stroke} />)}
      </svg>
      <div aria-hidden className="flex justify-between text-xs text-muted-foreground">{points.map((p) => <span key={p.period}>{quarterShort(p.period)}</span>)}</div>
    </TrendToggle>
  );
}
