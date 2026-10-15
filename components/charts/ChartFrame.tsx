import type { CSSProperties, ReactNode } from "react";
import { TrendToggle } from "@/components/dashboard/TrendToggle";
import { SourceFooter, SuppressedCell, type SourceFooterProps } from "@/components/trust";
import { ExplainCard } from "@/components/trust/explain";
import { fmt, type ChartPoint } from "@/lib/charts/scale";
import type { Term, TermId } from "@/lib/trust/glossary";
/** Every chart sits in the same frame: an eyebrow, a one-sentence headline in words, the picture, a source footer and a `View as table` toggle.
 * With `term`, the headline is an ExplainCard trigger (DS-09): hover, focus or tap explains the number, its source and as-of. */
export function ChartFrame({ eyebrow, headline, footer, table, term, children }: { eyebrow?: string; headline: string; footer?: SourceFooterProps; table: ReactNode; term?: TermId | Term; children: ReactNode }) {
  return (
    <figure data-slot="chart" className="flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        {eyebrow ? <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</span> : null}
        <span className="font-serif text-lg leading-snug">{term ? <ExplainCard term={term} source={footer?.source} asOf={footer?.asOf}>{headline}</ExplainCard> : headline}</span>
      </figcaption>
      <TrendToggle table={table}>{children}</TrendToggle>
      {footer ? <SourceFooter {...footer} /> : null}
    </figure>
  );
}
/** The hatched fill that stands for a hidden (n < 11) or not-published value, on any HTML box. */
export const HATCH: CSSProperties = { backgroundColor: "var(--suppressed)", backgroundImage: "repeating-linear-gradient(45deg, transparent 0 4px, color-mix(in oklch, var(--muted-foreground) 45%, transparent) 4px 5px)" };
export const TICK = "text-xs tabular-nums text-muted-foreground";
/** The table behind any single-series chart; hidden values render the shared `SuppressedCell`. */
export function PointTable({ points, caption, head, unit = "" }: { points: ChartPoint[]; caption: string; head: [string, string]; unit?: string }) {
  return (
    <table className="w-full table-fixed text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead><tr><th scope="col" className="text-left font-medium">{head[0]}</th><th scope="col" className="text-right font-medium">{head[1]}</th></tr></thead>
      <tbody>{points.map((p) => (
        <tr key={p.label}><th scope="row" className="text-left font-normal">{p.label}</th><td className="text-right tabular-nums">{p.value == null ? <SuppressedCell /> : fmt(p.value, unit)}</td></tr>
      ))}</tbody>
    </table>
  );
}
