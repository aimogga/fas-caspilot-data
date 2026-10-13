import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Column, CountyRow } from "@/lib/need-map/query";

export const SELECT_PROMPT = "Select a county on the map or in the table.";
const NOT_PUBLISHED = "Not published";
export type PanelSource = { code: string; name: string; vintage: string; asOf: string };
export type CountyPanelProps = { county: CountyRow | null; columns: Column[]; version: string | null; rankedCount: number; sources: PanelSource[] };

/** County detail: heading, score line and one row per indicator, each with source, vintage and as-of (DS-06). */
export function CountyPanel({ county, columns, version, rankedCount, sources }: CountyPanelProps) {
  const title = county ? county.name : "County detail";
  return (
    <Card data-slot="county-panel" aria-labelledby="county-panel-title" role="region">
      <CardHeader>
        <CardTitle id="county-panel-title" className="flex flex-wrap items-center gap-2 text-base">
          {title}{county?.fas ? <Badge variant="info" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
        </CardTitle>
        {county ? <p className="text-sm text-muted-foreground tabular-nums">Rank {county.rank} · Need score {county.score}</p> : null}
        {county ? <p className="text-xs text-muted-foreground">Need score version {version ?? NOT_PUBLISHED} · {rankedCount} counties ranked</p> : null}
      </CardHeader>
      <CardContent>
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
    <div data-slot="panel-indicator" className="grid gap-0.5 border-t border-border pt-2">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm">{column.label}</dt>
        <dd className="text-right text-sm font-medium tabular-nums">{value}</dd>
      </div>
      {value === NOT_PUBLISHED ? <p className="text-xs text-muted-foreground">{name} did not publish this for {county.name} in {vintage}.</p> : null}
      <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{name} · {vintage} · as of {source?.asOf ?? NOT_PUBLISHED}</p>
    </div>
  );
}
