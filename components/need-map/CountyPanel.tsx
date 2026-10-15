import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompareBars } from "@/components/need-map/CompareBars";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { NeedCompare } from "@/lib/need-map/compare";
import type { Column, CountyRow } from "@/lib/need-map/query";

export const SELECT_PROMPT = "Select a county on the map or in the table.";
const NOT_PUBLISHED = "Not published";
export type PanelSource = { code: string; name: string; vintage: string; asOf: string };
export type CountyPanelProps = { county: CountyRow | null; columns: Column[]; version: string | null; rankedCount: number; sources: PanelSource[]; /** All counties, for the comparison. */ counties?: CountyRow[] };

/** County detail: heading, score line, the county in words and bars against the state median, then one row per indicator with source, vintage and as-of (DS-06). */
export function CountyPanel({ county, columns, version, rankedCount, sources, counties = [] }: CountyPanelProps) {
  const title = county ? county.name : "County detail", compare = county ? NeedCompare.rows(county, counties, columns) : [];
  return (
    <Card data-slot="county-panel" aria-labelledby="county-panel-title" role="region">
      <CardHeader>
        <h2 id="county-panel-title" data-slot="card-title" aria-live="polite" className="flex flex-wrap items-center gap-2 text-base leading-none font-semibold">
          {title}{county?.fas ? <Badge variant="info" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
        </h2>
        {county ? <p className="text-sm text-muted-foreground tabular-nums">Rank {county.rank} · Need score {county.score}</p> : null}
        {county ? <p className="text-xs text-muted-foreground">Need score version {version ?? NOT_PUBLISHED} · {rankedCount} counties ranked</p> : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {county && counties.length ? <p data-slot="county-compare" className="font-serif text-base leading-snug">{NeedCompare.sentence(county, compare)}</p> : null}
        <CompareBars rows={compare} />
        {county ? <dl className="grid gap-3">{columns.map((c) => <Indicator key={c.code} county={county} column={c} source={sources.find((s) => s.code === c.code)} />)}</dl> : <p className="text-sm text-muted-foreground">{SELECT_PROMPT}</p>}
      </CardContent>
    </Card>
  );
}

function Indicator({ county, column, source }: { county: CountyRow; column: Column; source?: PanelSource }) {
  const value = county.cells[column.code] ?? NOT_PUBLISHED;
  const name = source?.name ?? "Source";
  const vintage = source?.vintage ?? NOT_PUBLISHED;
  return (
    // A <dl> may only hold <dt>/<dd> groups, or one <div> per group (axe definition-list, dlitem): the notes are extra <dd> rows.
    <div data-slot="panel-indicator" className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 border-t border-border pt-2">
      <dt className="text-sm">{column.label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums">{value}</dd>
      {value === NOT_PUBLISHED ? <dd className="col-span-2 text-xs text-muted-foreground">{name} did not publish this for {county.name} in {vintage}.</dd> : null}
      <dd data-slot="source-footer" className="col-span-2 text-xs font-medium tracking-wide text-muted-foreground">{name} · {vintage} · as of {source?.asOf ?? NOT_PUBLISHED}</dd>
    </div>
  );
}
