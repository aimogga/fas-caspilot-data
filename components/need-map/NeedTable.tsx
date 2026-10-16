import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { ResponsiveTable } from "@/components/layout";
import { ExplainCard } from "@/components/trust/explain";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Badge } from "@/components/ui/badge";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { FAS_BADGE, NEED_TERMS, indicatorCell, needTerm, scoreCell, type CellData } from "@/lib/need-map/terms";

const NUM = "text-right tabular-nums";
const STICKY = "bg-card pl-3 md:sticky md:left-0 md:z-10";
// Below `md` the ranked list (`RankedList`) replaces the table; from `md` the table sits in a bordered box that scrolls sideways, so a cut-off column reads as "more to the right".
const BOX = "hidden w-full max-w-full overflow-x-auto rounded-md border border-border bg-card md:block";
const LINK = "rounded-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
// Cells are reading targets for the one explain card: focusable by arrow keys and tap, not Tab stops (the county link is the row's control).
const CELL = "min-w-0 break-words py-2 pr-3 align-top rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2";
const HEAD = [["rank", "Rank"], ["need_score", "Need score"], ["placeholder_bins", "Band (placeholder)"]] as const;

function Cell({ label, data, className = NUM, children }: { label: string; data: CellData; className?: string; children: ReactNode }) {
  return <td tabIndex={-1} {...data} className={`${CELL} ${className}`}><span className="text-xs text-muted-foreground md:hidden">{label}: </span>{children}</td>;
}

/** County names link to `?county=<fips>` (keeping `?fas=1`), which selects the county on the map and in the panel. Headers explain their column; every cell explains its value through the shared layer. */
export function NeedTable({ data, fas = false }: { data: NeedTableData; fas?: boolean }) {
  const href = (fips: string) => `?county=${fips}${fas ? "&fas=1" : ""}`;
  const version = data.version ? `Need score version ${data.version}` : undefined;
  return (
    <ExplainLayer terms={NEED_TERMS}>
    <div role="region" tabIndex={0} aria-label="County need table" aria-describedby="need-table-keys" data-slot="need-table" className={BOX}>
      <p id="need-table-keys" className="sr-only">Arrow keys move through the numbers and read what each one means; Enter keeps the explanation open and Escape closes it.</p>
      <ResponsiveTable stack>
        <caption className="sr-only">Utah counties by need rank, with public indicators</caption>
        <thead>
          <tr>
            <th scope="col" className={STICKY}>County</th>
            {HEAD.map(([id, label]) => <th key={id} scope="col" aria-sort={id === "rank" ? "ascending" : undefined} className={NUM}><ExplainCard term={id} source={version}>{label}</ExplainCard></th>)}
            {data.columns.map((c) => (
              <th key={c.code} scope="col" className={`${NUM} align-bottom`}>
                <ExplainCard term={needTerm(`ind:${c.code}`, c.label)} source={c.note} asOf={data.sources.find((s) => s.code === c.code)?.asOf}>{c.label}</ExplainCard>
                <span className="block text-xs font-normal text-muted-foreground">{c.note}</span>
              </th>
            ))}
            <th scope="col"><ExplainCard term={NEED_TERMS.status!}>Status</ExplainCard></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.fips} data-fips={row.fips} aria-label={NeedMapQuery.rowLabel(row)} className="border-t border-border">
              <th scope="row" className={`py-2 pr-3 text-left font-medium ${STICKY}`}>
                <Link href={href(row.fips)} scroll={false} className={LINK}>{row.name}</Link>
                {row.fas ? <Badge variant="info" tabIndex={-1} {...FAS_BADGE} className="ml-2 align-middle" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
              </th>
              <Cell label="Rank" data={scoreCell("rank", row, data.version)}>{row.rank}</Cell>
              <Cell label="Need score" data={scoreCell("need_score", row, data.version)}>{row.score}</Cell>
              <Cell label="Band (placeholder)" data={scoreCell("placeholder_bins", row, data.version)}>{row.bin}</Cell>
              {data.columns.map((c) => <Cell key={c.code} label={`${c.label} (${c.note})`} data={indicatorCell(row, c, data.sources.find((s) => s.code === c.code))}>{row.cells[c.code]}</Cell>)}
              <Cell label="Status" data={scoreCell("status", row, data.version)} className="">{row.status}</Cell>
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
    </div>
    </ExplainLayer>
  );
}
