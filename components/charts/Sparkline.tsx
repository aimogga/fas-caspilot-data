import { direction, fmt, linear, lineRuns, lineSummary, type ChartPoint } from "@/lib/charts/scale";
const W = 120, H = 32, PAD = 5;
const WORD = { better: "Better", worse: "Worse", same: "Same" } as const;
/** A 120×32 trend beside a stat: muted line, accent dot on the current period, and a `Better`/`Worse`/`Same` word so colour is never alone. */
export function Sparkline({ points, noun, unit = "", goodWhen }: { points: ChartPoint[]; noun: string; unit?: string; goodWhen: "up" | "down" }) {
  const n = Math.max(points.length - 1, 1), s = linear(points.map((p) => p.value), H - 2 * PAD, { count: 2 });
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / n, y = (v: number) => H - PAD - s.at(v), runs = lineRuns(points, x, y);
  const last = points[points.length - 1], prior = points[points.length - 2], d = direction(last?.value ?? null, prior?.value ?? null, goodWhen);
  const tone = d === "better" ? "var(--success)" : d === "worse" ? "var(--destructive)" : "var(--muted-foreground)";
  return (
    <span data-slot="sparkline" className="inline-flex items-center gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={lineSummary(points, noun, unit)} className="shrink-0">
        {runs.map((r) => <polyline key={r[0]} points={r.join(" ")} fill="none" stroke="var(--chart-5)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
        {last?.value != null ? <><circle cx={x(points.length - 1)} cy={y(last.value)} r={5} fill="var(--background)" /><circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} fill={tone} /></> : null}
      </svg>
      {d ? <span className="text-xs font-semibold" style={{ color: tone }}>{WORD[d]} <span className="sr-only">than {prior?.label}</span></span> : <span className="text-xs text-muted-foreground">{fmt(null)}</span>}
    </span>
  );
}
