import { ChartFrame, HATCH, PointTable, TICK } from "@/components/charts/ChartFrame";
import type { SourceFooterProps } from "@/components/trust";
import { barSummary, fmt, linear, type ChartPoint } from "@/lib/charts/scale";
export type BarChartProps = {
  points: ChartPoint[]; noun: string; unit?: string; eyebrow?: string; headline?: string; footer?: SourceFooterProps; valueHead?: string;
  /** A vertical reference such as the statewide median, drawn as a labelled dashed hairline. */ reference?: { value: number; label: string };
};
/** Horizontal ranked bars (one series) in plain HTML so labels stay readable at 375px. Hidden values are a hatched band with the words `Hidden (n < 11)`; the summary sentence is the `aria-label`. */
export function BarChart({ points, noun, unit = "", eyebrow, headline, footer, reference, valueHead }: BarChartProps) {
  const s = linear(points.map((p) => p.value), 100, { floor: 0, include: reference ? [reference.value] : [] }), summary = barSummary(points, noun, unit);
  return (
    <ChartFrame eyebrow={eyebrow} headline={headline ?? summary} footer={footer} table={<PointTable points={points} caption={`${noun} by group`} head={["Group", valueHead ?? noun]} unit={unit} />}>
      <div role="img" aria-label={summary} className="grid grid-cols-[minmax(5rem,9rem)_1fr] gap-x-3 gap-y-2 text-sm">
        {reference ? <><span /><span className="relative mr-14 h-5 text-xs font-semibold"><span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${s.at(reference.value)}%` }}>{reference.label} {fmt(reference.value, unit)}</span></span></> : null}
        {points.map((p) => (
          <div key={p.label} className="contents" title={`${p.label}: ${fmt(p.value, unit)}${p.note ? ` · ${p.note}` : ""}`}>
            <span className="truncate text-right leading-5">{p.label}</span>
            <span className="relative flex h-5 items-center gap-2 pr-14">
              <span aria-hidden className="absolute inset-y-0 left-0 right-14">{s.ticks.map((t) => <span key={t} className="absolute inset-y-0 border-l border-border" style={{ left: `${s.at(t)}%` }} />)}
                {reference ? <span className="absolute inset-y-0 border-l-2 border-dashed border-foreground" style={{ left: `${s.at(reference.value)}%` }} /> : null}</span>
              {p.value == null
                ? <><span className="relative h-full w-[18%] shrink-0" style={HATCH} /><span className="relative bg-background px-0.5 text-xs text-muted-foreground">Hidden (n &lt; 11)</span></>
                : <><span className="relative h-full shrink-0 rounded-r-[4px] bg-chart-1" style={{ width: `${s.at(p.value)}%` }} /><span className="relative bg-background px-0.5 font-semibold tabular-nums">{fmt(p.value, unit)}</span></>}
            </span>
          </div>
        ))}
        <span /><span className={`relative mr-14 h-4 ${TICK}`}>{s.ticks.map((t) => <span key={t} className="absolute -translate-x-1/2" style={{ left: `${s.at(t)}%` }}>{fmt(t)}</span>)}</span>
      </div>
    </ChartFrame>
  );
}
