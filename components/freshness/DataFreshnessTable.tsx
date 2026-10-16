import { ResponsiveTable } from "@/components/layout";
import { ExplainCard, Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { FreshnessStatus } from "@/lib/freshness/status";
import type { FreshnessPageRow, FreshnessPageView } from "@/lib/freshness/query";
import { cadenceWords, footerWords, RUN_TERM, runWords, statusWords, summaryWords, VINTAGE_TERM, vintageCard } from "@/lib/freshness/words";
import { sourceName } from "@/lib/staff/home";
import { CHROME } from "./AggregateFreshnessChip";

const NUM = "text-right tabular-nums";
const CELL = "min-w-0 break-words py-3 pr-3 align-top lg:py-2";
const DOTTED = "underline decoration-dotted underline-offset-4";
const WORDS: Readonly<Record<FreshnessStatus, string>> = { current: "Current", stale: "Stale", failed: "Failed", not_published: "Not published" };
const COLS: ReadonlyArray<readonly [label: string, numeric: boolean]> = [["Latest vintage", true], ["Last successful run", true], ["Cadence", false], ["Status", false]];

/** Glyph + word badge for a status (never colour alone); Not published keeps the dashed muted badge the dashboard widget uses. */
function StatusBadge({ status }: { status: FreshnessStatus }) {
  const { glyph, variant } = CHROME[status];
  return <Badge variant={variant} className={status === "not_published" ? "border-dashed border-border" : undefined} prefix={<span aria-hidden>{glyph}</span>}>{WORDS[status]}</Badge>;
}

/** The badge plus the dated words, one `Hint` for both: `Current · loaded Oct 12, 2026`, `Stale since Aug 14, 2026 · 60 days`, `Failed on Oct 12, 2026`. */
export function StatusChip({ row }: { row: FreshnessPageRow }) {
  const w = statusWords(row), rest = w.text.slice(WORDS[row.status].length);
  return (
    <Hint text={w.hint} className="flex-wrap justify-start gap-x-2 rounded-md">
      <StatusBadge status={row.status} /><span className="text-sm text-muted-foreground tabular-nums">{rest.replace(/^\s*·\s*/, "")}</span>
    </Hint>
  );
}

/** The page sentence in words with the aggregate chip, shown at every width (DS-16a); null when there are no sources. */
export function FreshnessSummary({ view }: { view: FreshnessPageView }) {
  const s = summaryWords(view);
  if (!s || !view.aggregate) return null;
  return (
    <span data-slot="freshness-summary" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="max-w-prose font-serif text-xl leading-snug lg:text-2xl">{s.text}</span>
      <Hint text={s.hint} className="rounded-full"><StatusBadge status={view.aggregate} /></Hint>
    </span>
  );
}

function Label({ text }: { text: string }) {
  return <span className="text-xs text-muted-foreground md:hidden">{text}: </span>;
}

function SourceCell({ row }: { row: FreshnessPageRow }) {
  return (
    <th scope="row" className={`${CELL} text-left font-medium max-md:col-span-full`}>
      <span className="flex flex-wrap items-center gap-2">{sourceName(row.name)}{row.paused ? <span className="text-xs font-normal text-muted-foreground">Paused</span> : null}</span>
      {row.owner ? <span className="block text-xs font-normal text-muted-foreground">{row.owner}</span> : null}
    </th>
  );
}

function VintageCell({ row }: { row: FreshnessPageRow }) {
  const { text, ...card } = vintageCard(row);
  return <ExplainCard term={VINTAGE_TERM} value={card.value} source={card.source} asOf={card.asOf} hidden={card.hidden} className="tabular-nums">{text}</ExplainCard>;
}

function RunCell({ row }: { row: FreshnessPageRow }) {
  const { text, rows } = runWords(row.run);
  if (!row.run) return <span>{text}</span>;
  return <ExplainCard term={RUN_TERM} source={sourceName(row.name)} rows={rows} className="tabular-nums">{text}</ExplainCard>;
}

export function DataFreshnessTable({ view }: { view: FreshnessPageView }) {
  const cols = view.showRun ? [...COLS, ["Latest load", false] as const] : COLS;
  return (
    <>
      <Card data-pad className="gap-0 py-0">
        <ResponsiveTable stack>
          <caption className="sr-only">Public data sources with latest vintage, last successful run, cadence and status</caption>
          <thead><tr><th scope="col" className="py-2 pr-3">Source</th>{cols.map(([label, num]) => <th key={label} scope="col" className={`py-2 pr-3 ${num ? NUM : ""}`}>{label}</th>)}</tr></thead>
          <tbody>
            {view.rows.map((r) => {
              const cadence = cadenceWords(r.cadenceRaw);
              return (
                <tr key={r.name} data-row={r.name} data-status={r.status} className="border-t border-border">
                  <SourceCell row={r} />
                  <td data-slot="vintage" className={`${CELL} ${NUM}`}><Label text="Latest vintage" /><VintageCell row={r} /></td>
                  <td className={`${CELL} ${NUM}`}><Label text="Last successful run" />{r.lastSuccess}</td>
                  <td data-slot="cadence" className={CELL}><Label text="Cadence" /><Hint text={cadence.hint} className={DOTTED}>{cadence.text}</Hint></td>
                  <td data-slot="status" className={CELL}><Label text="Status" /><StatusChip row={r} /></td>
                  {view.showRun ? <td data-slot="run" className={`${CELL} text-sm`}><Label text="Latest load" /><RunCell row={r} /></td> : null}
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </Card>
      <p data-slot="source-footer" className="max-w-prose text-xs font-medium tracking-wide text-muted-foreground">{footerWords(view.asOf)}</p>
    </>
  );
}
