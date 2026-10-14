import { ResponsiveTable } from "@/components/layout";
import { FreshnessChip } from "@/components/trust";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { UNLABELED } from "@/lib/methodology/labels";
import type { Draft, InputRow, MethodologyView, WeightRow } from "@/lib/methodology/query";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

export const TOC = [["how", "How we calculate it"], ["inputs", "Inputs"], ["weights", "Weights"], ["vintages", "Vintages"], ["limits", "Limits"]] as const;
const NUM = "text-right tabular-nums";
const LIMITS = [
  ["It is not a measure of how well FAS is doing.", "Public county indicators only, not FAS cases or outcomes."],
  ["It is county-level only.", "No cities, ZIP codes, tracts, or addresses."],
  ["It is a relative ranking among Utah counties, not an absolute level of need.", ""],
  ["Small-population counties are noisier.", "Survey estimates swing more; treat thin counties carefully."],
  ["Vintages differ by source.", "One input may lag another; each row's vintage stays visible."],
  ["Placeholder weights may be in use.", "Synthetic or single-input configs are labeled as such until FAS sets production weights."],
] as const;
const PLAIN = "For each Utah county we turn every input into a z-score (how far that county sits from the statewide average, in standard deviations). We multiply each z-score by its weight, add them up, and rank counties from highest to lowest score. "
  + "The rank is relative — a high score means higher need than other Utah counties on these inputs, not a fixed level of need.";
const TOC_LINK = "inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm lg:min-h-0 lg:border-0 lg:px-0 lg:py-1";

export function MethodologyToc({ items }: { items: readonly (readonly [string, string])[] }) {
  return <nav aria-label="On this page" data-slot="methodology-toc" className="flex flex-wrap gap-2 lg:sticky lg:top-20 lg:flex-col lg:self-start">{items.map(([id, label]) => <a key={id} href={`#${id}`} className={TOC_LINK}>{label}</a>)}</nav>;
}

export function VersionLine({ version, approvedAtLabel, synthetic }: { version: string; approvedAtLabel: string; synthetic: boolean }) {
  return <p data-slot="version-line" className="flex flex-wrap items-center gap-2 text-sm"><span>Version {version}, approved {approvedAtLabel}</span>{synthetic ? <Badge variant="info" prefix={<Info aria-hidden />}>Synthetic data</Badge> : null}</p>;
}

export function DraftNotice({ draft }: { draft: Draft }) {
  const body = `Version ${draft.version} was created ${draft.createdLabel} and is not approved. The map and this page still use the approved version.`;
  return <Alert variant="info" data-slot="draft-notice" role="status" aria-live="polite"><Info /><AlertTitle>Newer draft on file</AlertTitle><AlertDescription>{body}</AlertDescription></Alert>;
}

export function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="flex flex-col gap-4"><h2 id={id} tabIndex={-1} className="scroll-mt-20 font-serif text-xl font-semibold">{title}</h2>{children}</section>;
}

export type Col = readonly [label: string, numeric: boolean];
export type Row = { key: string; label: string; known: boolean; cells: ReactNode[] };

export function MTable({ caption, cols, rows }: { caption: string; cols: readonly Col[]; rows: Row[] }) {
  return (
    <ResponsiveTable stack>
      <caption className="sr-only">{caption}</caption>
      <thead><tr><th scope="col">Input</th>{cols.map(([label, num]) => <th key={label} scope="col" className={num ? NUM : ""}>{label}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-row={r.key} className="border-t border-border">
            <th scope="row" className="py-2 pr-3 text-left font-medium">{r.known ? r.label : <><span className="font-mono">{r.label}</span> <span className="text-xs text-muted-foreground">{UNLABELED}</span></>}</th>
            {r.cells.map((cell, i) => <td key={cols[i]?.[0]} className={`min-w-0 break-words py-2 pr-3 align-top ${cols[i]?.[1] ? NUM : ""}`}><span className="text-xs text-muted-foreground md:hidden">{cols[i]?.[0]}: </span>{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

export const COLS: Record<"input" | "weight", Col[]> = { input: [["Source", false], ["Vintage", true], ["As of", false], ["Status", false]], weight: [["Weight", true], ["Share of total", true]] };
export function inputRows(rows: InputRow[]): Row[] {
  return rows.map((r) => ({ ...r, cells: [r.source, r.vintage, r.asOf, r.status === "current" ? <FreshnessChip status="current" /> : "Not published"] }));
}
export function weightRows(rows: WeightRow[], sum: string): Row[] {
  return [...rows.map((r) => ({ ...r, cells: [r.weight, r.share] })), { key: "total", label: "Total", known: true, cells: [sum, "100%"] }];
}

export function FormulaBlock({ view }: { view: MethodologyView }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>{PLAIN}</p>
      <pre data-slot="formula" className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-sm">score_c = Σ_i ( w_i × z_i,c ){"\n"}z_i,c = (x_i,c − μ_i) / σ_i</pre>
      <p className="text-muted-foreground">z_i,c is computed over counties with a published value for input i. Counties missing a required input for this version are Not published and get no rank (same rule as the need map).</p>
      {view.singleInput ? <p className="text-muted-foreground">This approved version ({view.version}) uses a placeholder single input for previews. Real multi-input weights are set by FAS policy.</p> : null}
    </div>
  );
}

export function LimitsSection() {
  const items = LIMITS.map(([title, body], i) => <li key={title} data-testid={`limit-${i + 1}`}><span className="font-medium">{title}</span>{body ? <span className="text-muted-foreground"> {body}</span> : null}</li>);
  return <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">{items}</ol>;
}
