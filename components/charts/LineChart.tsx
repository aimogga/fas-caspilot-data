import { ChartFrame, HATCH, PointTable, TICK } from "@/components/charts/ChartFrame";
import { LineHover } from "@/components/charts/LineHover";
import type { SourceFooterProps } from "@/components/trust";
import { fmt, linear, lineRuns, lineSummary, type ChartPoint } from "@/lib/charts/scale";
export type LineChartProps = {
  points: ChartPoint[]; noun: string; unit?: string; eyebrow?: string; headline?: string; footer?: SourceFooterProps; periodHead?: string;
  /** A horizontal goal or benchmark, drawn as a labelled dashed line. */ reference?: { value: number; label: string };
};
const pos = (x: number, y: number) => ({ left: `${x}%`, top: `${y}%` });
/** One line over time: the line, grid and hidden bands are a stretched SVG; every label, dot and value is HTML positioned by percent so text never shrinks.
 * The hover layer sits beside the `role="img"` picture, not inside it (an img's children are presentational), over the plot column. */
export function LineChart({ points, noun, unit = "", eyebrow, headline, footer, reference, periodHead = "Period" }: LineChartProps) {
  const n = Math.max(points.length - 1, 1), s = linear(points.map((p) => p.value), 100, { include: reference ? [reference.value] : [] });
  const x = (i: number) => (i * 100) / n, y = (v: number) => 100 - s.at(v), runs = lineRuns(points, x, y), summary = lineSummary(points, noun, unit);
  const known = points.map((p, i) => ({ ...p, i, v: p.value as number })).filter((p) => p.value != null), first = known[0], last = known[known.length - 1];
  const ends = (first && last && first !== last ? [first, last] : known.slice(0, 1)).map((p) => {
    const next = p === first ? known[1] : known[known.length - 2], down = next ? next.v < p.v === (p === first) : true;
    const slope = p === first ? !down : down, yv = y(p.v); // at the top or bottom edge the label goes inward, whatever the slope
    return { ...p, below: yv < 20 ? true : yv > 80 ? false : slope };
  });
  return (
    <ChartFrame eyebrow={eyebrow} headline={headline ?? summary} footer={footer} table={<PointTable points={points} caption={`${noun} by period`} head={[periodHead, noun]} unit={unit} />}>
      <div className="relative">
      <div role="img" aria-label={summary} className="grid grid-cols-[2.5rem_1fr] gap-x-2 text-sm">
        <div className={`relative h-48 ${TICK}`}>{s.ticks.map((t) => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>{fmt(t)}</span>)}</div>
        <div className="relative mr-20 h-48 min-w-0">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
            {s.ticks.map((t) => <line key={t} x1={0} x2={100} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
            {reference ? <line x1={0} x2={100} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" /> : null}
            {runs.map((r) => <polyline key={r[0]} points={r.join(" ")} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
          </svg>
          {points.map((p, i) => p.value == null ? <span key={p.label} className="absolute inset-y-0 -translate-x-1/2" style={{ left: `${x(i)}%`, width: `${100 / n}%`, ...HATCH }} /> : null)}
          {known.map((p) => <span key={p.label} className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-chart-1" style={pos(x(p.i), y(p.v))} />)}
          {ends.map((p) => <span key={`v${p.label}`} style={pos(x(p.i), y(p.v))}
            className={`absolute ml-2 whitespace-nowrap rounded-sm bg-background/80 px-0.5 text-xs font-semibold tabular-nums ${p === last && p !== first ? "-translate-y-1/2" : p.below ? "translate-y-2" : "-mt-2 -translate-y-full"}`}>{fmt(p.value, unit)}</span>)}
        </div>
        <span /><div className={`mr-20 flex justify-between pt-1 ${TICK}`}>{points.map((p) => <span key={p.label}>{p.label}</span>)}</div>
        {reference ? <><span /><span className="flex items-center gap-2 pt-1 text-xs font-semibold"><span aria-hidden className="w-6 border-t-2 border-dashed border-foreground" />{reference.label} {fmt(reference.value, unit)}</span></> : null}
      </div>
      <LineHover noun={noun} unit={unit} points={points.map((p, i) => ({ ...p, x: x(i), y: p.value == null ? null : y(p.value) }))} />
      </div>
    </ChartFrame>
  );
}
