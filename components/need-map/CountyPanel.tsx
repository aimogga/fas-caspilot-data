import { ChevronRight, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CompareBars } from "@/components/need-map/CompareBars";
import { CountyPicker } from "@/components/need-map/CountyPicker";
import { LowReliability } from "@/components/need-map/LowReliability";
import { Swatch, fillFor } from "@/components/need-map/NeedMap";
import { ExplainCard, Hint, Provenance } from "@/components/trust/explain";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NeedCompare, type Compare } from "@/lib/need-map/compare";
import { KEY_MEASURES, measureGroups, rankLine } from "@/lib/need-map/panel";
import type { PickerOption } from "@/lib/need-map/picker";
import { NeedMapQuery, type Column, type CountyRow } from "@/lib/need-map/query";
import { FAS_BADGE, NEED_TERMS, moeWords, needTerm, scoreCell, splitMoe } from "@/lib/need-map/terms";

export const SELECT_PROMPT = "Pick a county on the map or from the menu above.";
/** Before a pick (DS-20a, DS-22): the top ranked counties answer the page's question, then one line on how to go further. */
export const TOP_PROMPT = "Pick a county on the map or from the menu above to see why it ranks where it does.";
const TOP_ROW = "grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border text-sm";
const LINK = "flex min-h-11 min-w-0 items-center gap-2 rounded-sm font-medium text-foreground no-underline hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
const CELL = "rounded-sm tabular-nums focus-visible:outline-2 focus-visible:outline-ring";
const NOT_PUBLISHED = "Not published";
const SUMMARY = "flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden";
export type PanelSource = { code: string; name: string; vintage: string; asOf: string };
export type CountyPanelProps = { county: CountyRow | null; columns: Column[]; version: string | null; rankedCount: number; sources: PanelSource[]; /** All counties, for the comparison. */ counties?: CountyRow[];
  /** Before a pick: the top ranked rows (FAS-filtered when `fas`). */ top?: CountyRow[]; fas?: boolean; /** County picker options (DS-22). */ options?: PickerOption[] };

/** County detail (DS-20b): name, the rank in words, the score, the county in one sentence, the five key measures against the state median, then every measure behind one disclosure, grouped by source. */
export function CountyPanel({ county, columns, version, sources, counties = [], top = [], fas = false, options = [] }: CountyPanelProps) {
  const title = county ? county.name : top.length ? `Highest need${fas ? " among FAS counties" : ""}` : "County detail", compare = county ? NeedCompare.rows(county, counties, columns) : [];
  return (
    <Card id="county-panel" data-slot="county-panel" aria-labelledby="county-panel-title" role="region">
      <CardHeader>
        <CountyPicker options={options} selected={county?.fips ?? null} />
        <h2 id="county-panel-title" data-slot="card-title" aria-live="polite" className="flex flex-wrap items-center gap-2 text-base leading-none font-semibold">
          {title}{county?.fas ? <Badge variant="info" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
        </h2>
        {county ? <RankHeader county={county} counties={counties} version={version} /> : null}
      </CardHeader>
      <CardContent className="grid gap-6">
        {county && counties.length ? <p data-slot="county-compare" className="m-0 font-serif text-base leading-snug">{NeedCompare.sentence(county, compare)}</p> : null}
        {county ? <KeyMeasures rows={KEY_MEASURES.flatMap((code) => compare.filter((r) => r.code === code))} /> : null}
        {county ? <AllMeasures county={county} columns={columns} sources={sources} />
          : top.length ? <TopCounties rows={top} version={version} fas={fas} /> : <p className="text-sm text-muted-foreground">{SELECT_PROMPT}</p>}
      </CardContent>
    </Card>
  );
}

/** One prominent line: `3rd highest need of 26 counties scored · Highest need band` (the place explains the rank), then the score with its card. Unscored: says so, and why. */
function RankHeader({ county, counties, version }: { county: CountyRow; counties: CountyRow[]; version: string | null }) {
  const line = rankLine(county, counties), source = `Need score version ${version ?? NOT_PUBLISHED}`;
  if (!line.ranked) return <div data-slot="rank-line"><p className="m-0 font-serif text-xl leading-snug">{line.place}</p><p className="m-0 text-sm text-muted-foreground">{line.rest}</p></div>;
  return (
    <div data-slot="rank-line" className="grid gap-1">
      <p className="m-0 font-serif text-xl leading-snug tabular-nums"><ExplainCard term="rank" value={county.rank} source={source} className="text-left">{line.place}</ExplainCard>{line.rest}</p>
      <p className="m-0 text-sm text-muted-foreground tabular-nums">Need score <ExplainCard term="need_score" value={county.score} source={source}>{county.score}</ExplainCard> · version {version ?? NOT_PUBLISHED}</p>
      {county.flags?.length ? <p data-slot="reliability" className="m-0 flex flex-wrap gap-2">{county.flags.map((f) => <LowReliability key={f.code} flag={f} />)}</p> : null}
    </div>
  );
}

function KeyMeasures({ rows }: { rows: Compare[] }) {
  if (rows.length === 0) return null;
  return <div data-slot="key-measures" className="grid gap-3"><h3 className="m-0 text-sm font-medium">Key measures</h3><CompareBars rows={rows} /></div>;
}

/** Every loaded measure, closed by default. One heading and one source line per source (George decision 3); each label keeps its own card with source, release and as-of. */
function AllMeasures({ county, columns, sources }: { county: CountyRow; columns: Column[]; sources: PanelSource[] }) {
  if (columns.length === 0) return null;
  return (
    <details data-slot="all-measures" className="group border-t border-border">
      <summary className={SUMMARY}><ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-(--duration-md) ease-out group-open:rotate-90" />All measures ({columns.length})</summary>
      <div className="grid gap-6 pt-2">
        {measureGroups(columns, sources).map((g) => (
          <div key={`${g.source.name}${g.source.vintage}`} data-slot="measure-group" className="grid gap-1">
            <h3 className="m-0 text-sm font-medium">{g.topic}</h3>
            <p data-slot="source-footer" className="m-0 text-xs font-medium tracking-wide text-muted-foreground"><Provenance source={g.source.name} period={g.source.vintage} n="" asOf={g.source.asOf}>{g.source.name} {g.source.vintage} · as of {g.source.asOf}</Provenance></p>
            <dl className="m-0 grid">{g.columns.map((c) => <Indicator key={c.code} county={county} column={c} source={g.source} />)}</dl>
          </div>
        ))}
      </div>
    </details>
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

function Indicator({ county, column, source }: { county: CountyRow; column: Column; source: PanelSource }) {
  const cell = county.cells[column.code] ?? NOT_PUBLISHED, { value, moe } = splitMoe(cell), term = needTerm(`ind:${column.code}`, column.label);
  return (
    // A <dl> may only hold <dt>/<dd> groups, or one <div> per group (axe definition-list, dlitem): the note is an extra <dd>.
    <div data-slot="panel-indicator" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border first:border-t-0 lg:py-1.5">
      <dt className="text-sm"><ExplainCard term={term} value={cell} source={`${source.name} ${source.vintage}`} asOf={source.asOf}>{column.label}</ExplainCard></dt>
      <dd className="m-0 text-right text-sm font-medium tabular-nums">{value}{moe ? <Hint text={moeWords(moe)} className="ml-1 font-normal text-muted-foreground">± {moe}</Hint> : null}</dd>
      {cell === NOT_PUBLISHED ? <dd className="col-span-2 m-0 pb-2 text-xs text-muted-foreground">{source.name} did not publish this for {county.name} in {source.vintage}.</dd> : null}
    </div>
  );
}
