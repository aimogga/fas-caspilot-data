import { Hint } from "@/components/trust/explain";
import { NeedCompare, type Compare } from "@/lib/need-map/compare";
const MEDIAN = "The middle Utah county for this measure: half the counties are above this line, half below. One extreme county cannot move it much.";
/** One bar per percent indicator for the selected county, with the statewide median as a dashed tick on a shared 0–max scale. The words carry the meaning; the bars illustrate. */
export function CompareBars({ rows }: { rows: Compare[] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.flatMap((r) => [r.value, r.median])) * 1.15 || 1, at = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <ul data-slot="compare-bars" className="grid gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.code} data-where={r.where} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
          <span className="truncate">{r.label}</span>
          <span className="text-right font-semibold tabular-nums">{r.value}%<span className="sr-only">, {r.where} the state median of {r.median}%</span></span>
          <span aria-hidden className="relative col-span-2 h-3 rounded-r-[4px] bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-1" style={{ width: at(r.value) }} />
            <span className="absolute -inset-y-1 border-l-2 border-dashed border-foreground" style={{ left: at(r.median) }} />
          </span>
          <span aria-hidden className="col-span-2 text-xs text-muted-foreground">{NeedCompare.words(r)} · higher than {r.higherThan} of {r.of} other counties</span>
        </li>
      ))}
      <li className="flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden className="inline-block h-3 border-l-2 border-dashed border-foreground" /><Hint text={MEDIAN} className="underline decoration-dotted underline-offset-4">State median</Hint></li>
    </ul>
  );
}
