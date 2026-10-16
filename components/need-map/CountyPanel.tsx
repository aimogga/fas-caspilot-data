import { MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CompareBars } from "@/components/need-map/CompareBars";
import { Swatch, fillFor } from "@/components/need-map/NeedMap";
import { ExplainCard, Hint, Provenance } from "@/components/trust/explain";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NeedCompare } from "@/lib/need-map/compare";
import { NOT_YET, NeedMapQuery, type Column, type CountyRow } from "@/lib/need-map/query";
import { FAS_BADGE, NEED_TERMS, moeWords, needTerm, scoreCell, splitMoe } from "@/lib/need-map/terms";

export const SELECT_PROMPT = "Select a county on the map or in the table.";
/** Before a pick (DS-20a): the top ranked counties answer the page's question, then one line on how to go further. */
export const TOP_PROMPT = "Select any county on the map or in the table to see why it ranks where it does.";
const TOP_ROW = "grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border text-sm";
const LINK = "flex min-h-11 min-w-0 items-center gap-2 rounded-sm font-medium text-foreground no-underline hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
const CELL = "rounded-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring";
const NOT_PUBLISHED = "Not published";
export type PanelSource = { code: string; name: string; vintage: string; asOf: string };
export type CountyPanelProps = { county: CountyRow | null; columns: Column[]; version: string | null; rankedCount: number; sources: PanelSource[]; /** All counties, for the comparison. */ counties?: CountyRow[];
  /** Before a pick: the top ranked rows (FAS-filtered when `fas`). */ top?: CountyRow[]; fas?: boolean };

/** County detail: heading, score line, the county in words and bars against the state median, then one row per indicator with source, vintage and as-of (DS-06). */
export function CountyPanel({ county, columns, version, rankedCount, sources, counties = [], top = [], fas = false }: CountyPanelProps) {
  const title = county ? county.name : top.length ? `Highest need${fas ? " among FAS counties" : ""}` : "County detail", compare = county ? NeedCompare.rows(county, counties, columns) : [];
  const scoreSource = `Need score version ${version ?? NOT_PUBLISHED}`;
  return (
    <Card id="county-panel" data-slot="county-panel" aria-labelledby="county-panel-title" role="region">
      <CardHeader>
        <h2 id="county-panel-title" data-slot="card-title" aria-live="polite" className="flex flex-wrap items-center gap-2 text-base leading-none font-semibold">
          {title}{county?.fas ? <Badge variant="info" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
        </h2>
        {county ? <p className="text-sm text-muted-foreground tabular-nums">Rank <ExplainCard term="rank" value={county.rank} source={scoreSource}>{county.rank}</ExplainCard> ·{" "}
          Need score <ExplainCard term="need_score" value={county.score} source={scoreSource}>{county.score}</ExplainCard></p> : null}
        {county ? <p className="text-xs text-muted-foreground">Need score version {version ?? NOT_PUBLISHED} · {rankedCount} counties ranked</p> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {county && counties.length ? <p data-slot="county-compare" className="font-serif text-base leading-snug">{NeedCompare.sentence(county, compare)}</p> : null}
        <CompareBars rows={compare} />
        {county ? <dl className="grid gap-3">{columns.map((c) => <Indicator key={c.code} county={county} column={c} source={sources.find((s) => s.code === c.code)} />)}</dl>
          : top.length ? <TopCounties rows={top} version={version} fas={fas} /> : <p className="text-sm text-muted-foreground">{SELECT_PROMPT}</p>}
      </CardContent>
    </Card>
  );
}

/** Rank · county (swatch, name, FAS badge) · need score. The name links to `?county=`; rank and score explain themselves through one layer, the header terms through their cards. */
function TopCounties({ rows, version, fas }: { rows: CountyRow[]; version: string | null; fas: boolean }) {
  const source = version ? `Need score version ${version}` : undefined;
  return (
    <ExplainLayer terms={NEED_TERMS} className="grid gap-3">
      <div data-slot="top-counties">
        <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-x-3 pb-1 text-xs text-muted-foreground">
          <ExplainCard term="rank" source={source}>Rank</ExplainCard><span className="self-center">County</span><ExplainCard term="need_score" source={source}>Need score</ExplainCard>
        </div>
        <ol className="m-0 list-none p-0">
          {rows.map((row) => (
            <li key={row.fips} data-fips={row.fips} className={TOP_ROW}>
              <span tabIndex={-1} {...scoreCell("rank", row, version)} className={`${CELL} text-right text-base font-medium`}>{row.rank.split(" ")[0]}</span>
              <Link href={`?county=${row.fips}${fas ? "&fas=1" : ""}`} scroll={false} aria-label={NeedMapQuery.rowLabel(row)} className={LINK}>
                <Swatch style={{ background: fillFor(row.binNo ?? 1) }} /><span className="truncate">{row.name}</span>
                {row.fas ? <Badge variant="info" {...FAS_BADGE} prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
              </Link>
              <span tabIndex={-1} {...scoreCell("need_score", row, version)} className={`${CELL} text-right font-medium`}>{row.score}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{TOP_PROMPT}</p>
    </ExplainLayer>
  );
}

function Indicator({ county, column, source }: { county: CountyRow; column: Column; source?: PanelSource }) {
  const cell = county.cells[column.code] ?? NOT_PUBLISHED, { value, moe } = splitMoe(cell), term = needTerm(`ind:${column.code}`, column.label);
  const name = source?.name ?? "Source";
  const vintage = source?.vintage ?? NOT_PUBLISHED, asOf = source?.asOf ?? NOT_YET;
  return (
    // A <dl> may only hold <dt>/<dd> groups, or one <div> per group (axe definition-list, dlitem): the notes are extra <dd> rows.
    <div data-slot="panel-indicator" className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-border pt-2">
      <dt className="text-sm"><ExplainCard term={term} value={cell} source={`${name} ${vintage}`} asOf={asOf}>{column.label}</ExplainCard></dt>
      <dd className="text-right text-sm font-medium tabular-nums">{value}{moe ? <Hint text={moeWords(moe)} className="ml-1 font-normal text-muted-foreground">± {moe}</Hint> : null}</dd>
      {cell === NOT_PUBLISHED ? <dd className="col-span-2 text-xs text-muted-foreground">{name} did not publish this for {county.name} in {vintage}.</dd> : null}
      <dd data-slot="source-footer" className="col-span-2 text-xs font-medium tracking-wide text-muted-foreground"><Provenance source={name} period={vintage} n="" asOf={asOf}>{name} · {vintage} · as of {asOf}</Provenance></dd>
    </div>
  );
}
