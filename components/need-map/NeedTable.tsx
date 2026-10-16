import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { ResponsiveTable } from "@/components/layout";
import { HATCH_CSS, Swatch, fillFor } from "@/components/need-map/NeedMap";
import { ExplainCard } from "@/components/trust/explain";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Badge } from "@/components/ui/badge";
import { header, needMapHref, orderColumns, plainCell, rankNumber, type ColumnMode } from "@/lib/need-map/columns";
import { NOT_PUBLISHED, NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { FAS_BADGE, NEED_TERMS, indicatorCell, needTerm, scoreCell, type CellData } from "@/lib/need-map/terms";
import { bandName } from "@/lib/need-map/words";

const NUM = "text-right tabular-nums whitespace-nowrap";
// Key measures fit the content column from 1024, so the box stops clipping there and the header sticks under the top bar; All measures scroll inside a bounded box with the header stuck to its top.
const BOX = { key: "overflow-x-auto lg:overflow-x-visible", all: "max-h-[80vh] overflow-auto" };
const HEAD = { key: "lg:sticky lg:top-14", all: "sticky top-0" };
const LINK = "scroll-mt-32 rounded-sm text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
// Cells are reading targets for the one explain card: focusable by arrow keys and tap, not Tab stops (the county link is the row's control).
// `scroll-mt-32` keeps a focused cell or link clear of the top bar and the sticky header row (WCAG 2.2 focus not obscured).
const CELL = "scroll-mt-32 py-2 pr-2.5 align-middle rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2";
const OPTION = "inline-flex min-h-11 items-center rounded-sm px-3 text-sm no-underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 lg:min-h-9";

function Cell({ data, className = NUM, children }: { data: CellData; className?: string; children: ReactNode }) {
  return <td tabIndex={-1} {...data} className={`${CELL} ${className}`}>{children}</td>;
}

/** County table (DS-20c): Key measures by default, every measure under `?cols=all`; one line per number, units in the headers, the margin of error in each cell's explain card. County names link to `?county=` (keeping the filter and the view); the selected county's row is marked. */
export function NeedTable({ data, fas = false, cols = "key", selected = null }: { data: NeedTableData; fas?: boolean; cols?: ColumnMode; selected?: string | null }) {
  const columns = orderColumns(data.columns, cols), source = (code: string) => data.sources.find((s) => s.code === code);
  const version = data.version ? `Need score version ${data.version}` : undefined;
  const k = Math.max(0, ...data.counties.map((c) => c.binNo ?? 0)), ranked = data.counties.filter((c) => c.status === "Ranked").length;
  const head = `bg-card shadow-[inset_0_-1px_0_var(--border)] py-2 pr-2.5 align-bottom font-medium ${HEAD[cols]}`;
  const notes = [...new Set(columns.map((c) => c.note))];
  return (
    <section data-slot="need-table-section" aria-labelledby="need-table-title" className="hidden flex-col gap-3 md:flex">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="need-table-title" className="m-0 font-serif text-xl leading-snug font-semibold">All {data.rows.length} {fas ? "FAS " : ""}{data.rows.length === 1 ? "county" : "counties"}</h2>
        <nav aria-label="Columns to show" data-slot="need-table-view" className="flex rounded-md border border-border bg-card p-0.5">
          {(["key", "all"] as const).map((m) => (
            <Link key={m} href={needMapHref({ fas, county: selected, cols: m })} scroll={false} aria-current={m === cols ? "true" : undefined}
              className={`${OPTION} ${m === cols ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{m === "key" ? "Key measures" : "All measures"}</Link>
          ))}
        </nav>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{cols === "key" ? "The five rates that make up the need score." : "Every measure we load: the rates first, then the counts."}</p>
      <ExplainLayer terms={NEED_TERMS}>
      <div role="region" tabIndex={0} aria-label="County need table" aria-describedby="need-table-keys" data-slot="need-table" data-cols={cols} className={`w-full max-w-full rounded-md border border-border bg-card text-sm [&_table]:w-full ${BOX[cols]}`}>
        <p id="need-table-keys" className="sr-only">Arrow keys move through the numbers and read what each one means; Enter keeps the explanation open and Escape closes it.</p>
        <ResponsiveTable stack>
          <caption className="sr-only">Utah counties by need rank, with public measures</caption>
          <thead>
            <tr>
              <th scope="col" className={`${head} z-30 pl-3 text-left md:left-0 md:sticky`}>County</th>
              <th scope="col" aria-sort="ascending" className={`${head} z-20 text-right`}><ExplainCard term="rank" source={version}>Rank of{"\u00a0"}{ranked}</ExplainCard></th>
              <th scope="col" className={`${head} z-20 text-right`}><ExplainCard term="need_score" source={version}>Need score</ExplainCard></th>
              {columns.map((c) => <th key={c.code} scope="col" data-code={c.code} className={`${head} z-20 max-w-28 text-right ${cols === "all" ? "min-w-28" : ""}`}><ExplainCard term={needTerm(`ind:${c.code}`, c.label)} source={c.note} asOf={source(c.code)?.asOf}>{header(c)}</ExplainCard></th>)}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const on = row.fips === selected, rank = rankNumber(row);
              const score = scoreCell("need_score", row, data.version);
              return (
                <tr key={row.fips} data-fips={row.fips} aria-label={NeedMapQuery.rowLabel(row)} aria-current={on ? "true" : undefined} data-selected={on ? "true" : undefined}
                  className={`border-t border-border ${on ? "bg-accent" : "bg-card hover:bg-muted"}`}>
                  <th scope="row" className="bg-inherit py-2 pr-2.5 pl-3 text-left font-medium md:sticky md:left-0 md:z-10">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><Link href={needMapHref({ fas, county: row.fips, cols })} scroll={false} className={LINK}>{row.name}</Link>
                    {row.fas ? <Badge variant="info" tabIndex={-1} {...FAS_BADGE} prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}</span>
                  </th>
                  <Cell data={scoreCell("rank", row, data.version)}>{rank ?? <><span aria-hidden="true">—</span><span className="sr-only">{row.rank}</span></>}</Cell>
                  <Cell data={{ ...score, "data-value": row.binNo ? `${row.score} · ${bandName(row.binNo, k)} band (${row.bin})` : score["data-value"] }}>
                    <span className="inline-flex items-center gap-1.5">{row.binNo ? <Swatch style={{ background: fillFor(row.binNo) }} /> : row.score === NOT_PUBLISHED ? <Swatch style={HATCH_CSS} /> : null}{row.score}</span>
                  </Cell>
                  {columns.map((c) => <Cell key={c.code} data={indicatorCell(row, c, source(c.code))}>{plainCell(row, c)}</Cell>)}
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      </div>
      </ExplainLayer>
      {notes.length ? <p data-slot="need-table-sources" className="m-0 text-xs text-muted-foreground">Sources: {notes.join(", ")}. Point at a heading or number to see what it means, its margin of error and when we loaded it.</p> : null}
    </section>
  );
}
