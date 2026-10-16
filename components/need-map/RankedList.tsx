import { MapPin } from "lucide-react";
import Link from "next/link";
import { HATCH_CSS, Swatch, fillFor } from "@/components/need-map/NeedMap";
import { Badge } from "@/components/ui/badge";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";
import { bandName } from "@/lib/need-map/words";

const ROW = "grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-sm py-2 text-foreground no-underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

/** Below `md` the table gives way to a ranked list: one row per county with its rank, name, score, band and FAS badge (DS-11b; the stacked table was 48 000 px tall at 375).
 * A tap selects the county and moves to its panel (`#county-panel`). The full table stays from `md` up. */
export function RankedList({ data, fas = false }: { data: NeedTableData; fas?: boolean }) {
  const k = Math.max(0, ...data.counties.map((c) => c.binNo ?? 0)), scored = data.rows.filter((r) => r.binNo !== null).length;
  return (
    <section data-slot="ranked-list" aria-labelledby="ranked-list-title" className="md:hidden">
      <h2 id="ranked-list-title" className="m-0 font-serif text-lg leading-snug font-semibold">{data.rows.length} counties, highest need first</h2>
      <p className="mt-1 mb-2 text-sm text-muted-foreground">{scored} of {data.rows.length} have a need score. Tap a county to see why it ranks where it does.</p>
      <ol className="m-0 list-none divide-y divide-border p-0">
        {data.rows.map((row) => (
          <li key={row.fips} data-fips={row.fips}>
            <Link href={`?county=${row.fips}${fas ? "&fas=1" : ""}#county-panel`} aria-label={NeedMapQuery.rowLabel(row)} className={ROW}>
              <span className="row-span-2 text-right text-xl font-medium tabular-nums">{row.binNo === null ? <Swatch style={HATCH_CSS} /> : row.rank.split(" ")[0]}</span>
              <span className="truncate font-medium">{row.name}</span>
              <span className="row-span-2 text-right text-base font-medium tabular-nums">{row.binNo === null ? <span className="text-sm font-normal text-muted-foreground">Not published</span> : row.score}</span>
              <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {row.binNo === null ? "No need score" : <Badge prefix={<Swatch style={{ background: fillFor(row.binNo) }} />}>{bandName(row.binNo, k)}</Badge>}
                {row.fas ? <Badge variant="info" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
