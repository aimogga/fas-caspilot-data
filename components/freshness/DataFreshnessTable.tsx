import { ResponsiveTable } from "@/components/layout";
import { FreshnessChip } from "@/components/trust";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { FreshnessStatus } from "@/lib/freshness/status";
import type { FreshnessPageRow, FreshnessPageView } from "@/lib/freshness/query";

const NUM = "text-right tabular-nums max-md:text-left";
const CELL = "min-w-0 break-words py-3 pr-3 align-top lg:py-2";
const COLS: ReadonlyArray<readonly [label: string, numeric: boolean]> = [["Latest vintage", true], ["Last successful run", true], ["Cadence", false], ["Status", false]];

/** Text + glyph for every status (never colour alone). Not published uses the same dashed muted badge as the dashboard widget. */
export function StatusChip({ status, staleDays }: { status: FreshnessStatus; staleDays?: number | null }) {
  if (status === "not_published") return <Badge variant="muted" className="border-dashed border-border" prefix={<span aria-hidden>○</span>}>Not published</Badge>;
  const suffix = status === "stale" && staleDays != null ? <span className="text-xs text-muted-foreground tabular-nums"> · {staleDays} days</span> : null;
  return <span className="whitespace-nowrap"><FreshnessChip status={status} />{suffix}</span>;
}

/** Right-hand summary for the PageHeader at ≥ 1024: source count plus the aggregate chip. */
export function FreshnessSummary({ view }: { view: FreshnessPageView }) {
  if (!view.aggregate) return null;
  return (
    <div data-slot="freshness-summary" className="hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
      <span className="tabular-nums">{view.rows.length} {view.rows.length === 1 ? "source" : "sources"}</span>
      <StatusChip status={view.aggregate} />
    </div>
  );
}

function Label({ text }: { text: string }) {
  return <span className="text-xs text-muted-foreground md:hidden">{text}: </span>;
}

function SourceCell({ row }: { row: FreshnessPageRow }) {
  return (
    <th scope="row" className={`${CELL} text-left font-medium max-md:col-span-full`}>
      <span className="flex flex-wrap items-center gap-2">{row.name}{row.paused ? <span className="text-xs font-normal text-muted-foreground">Paused</span> : null}</span>
      {row.owner ? <span className="block text-xs font-normal text-muted-foreground">{row.owner}</span> : null}
    </th>
  );
}

export function DataFreshnessTable({ view }: { view: FreshnessPageView }) {
  const cols = view.showRun ? [...COLS, ["Latest run", false] as const] : COLS;
  return (
    <>
      <Card data-pad className="gap-0 py-0">
        <ResponsiveTable stack>
          <caption className="sr-only">Public data sources with latest vintage, last successful run, cadence and status</caption>
          <thead><tr><th scope="col" className="py-2 pr-3">Source</th>{cols.map(([label, num]) => <th key={label} scope="col" className={`py-2 pr-3 ${num ? NUM : ""}`}>{label}</th>)}</tr></thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.name} data-row={r.name} data-status={r.status} className="border-t border-border">
                <SourceCell row={r} />
                <td className={`${CELL} ${NUM}`}><Label text="Latest vintage" />{r.latestVintage}</td>
                <td className={`${CELL} ${NUM}`}><Label text="Last successful run" />{r.lastSuccess}</td>
                <td className={CELL}><Label text="Cadence" />{r.cadence}</td>
                <td className={CELL}><Label text="Status" /><StatusChip status={r.status} staleDays={r.staleDays} /></td>
                {view.showRun ? <td className={`${CELL} font-mono text-xs`}><Label text="Latest run" />{r.runId ? r.runId.slice(0, 8) : "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </Card>
      {view.asOf ? <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">Public sources · as of {view.asOf}</p> : null}
    </>
  );
}
