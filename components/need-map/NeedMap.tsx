import type { CSSProperties } from "react";
import { CountyPanel } from "@/components/need-map/CountyPanel";
import { MapHover } from "@/components/need-map/MapHover";
import { Hint } from "@/components/trust/explain";
import { NeedMapQuery, type CountyRow, type NeedTableData } from "@/lib/need-map/query";
import { LEGEND_NOTE, bandHint, hoverWords, legendBands, topCounties } from "@/lib/need-map/words";
import { GLOSSARY, whyHidden } from "@/lib/trust/glossary";
import geo from "@/public/geo/utah-counties.json";

const GEO = geo as { source: string; viewBox: string; counties: Record<string, { d: string; centroid: number[]; bbox: number[] }> };
/** DS-06 ramp: `--chart-1` at these opacity steps for bins 1–5. Placeholder bins until George sets the weights. */
export const RAMP = [15, 35, 55, 75, 100];
const HATCH_LINE = "color-mix(in oklch, var(--foreground) 30%, transparent)";
export const HATCH_CSS: CSSProperties = { backgroundColor: "var(--suppressed)", backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${HATCH_LINE} 3px, ${HATCH_LINE} 4px)` };
// From 1024 the map draws at about 0.64 px per viewBox unit (7 of 12 grid columns in a 704 px page), so a 24 px box is 38 units; a rank label needs that much room each way.
const MIN_LABEL_UNITS = 38;
export const fillFor = (bin: number) => `color-mix(in oklch, var(--chart-1) ${RAMP[bin - 1]}%, transparent)`;
const countiesWord = (n: number) => `${n} ${n === 1 ? "county" : "counties"}`;
const LEGEND_ITEM = "justify-start gap-2 text-left";

/** `aria-describedby` summary: top 3, bottom 3 and the not-published count. */
export function summary(counties: CountyRow[]): string {
  const ranked = counties.filter((c) => c.status === "Ranked");
  const names = (rows: CountyRow[]) => rows.map((r) => r.name).join(", ");
  return `Highest need: ${names(ranked.slice(0, 3))}. Lowest need: ${names(ranked.slice(-3).reverse())}. ${counties.length - ranked.length} counties not published.`;
}

export const Swatch = ({ style, wide = false }: { style?: CSSProperties; wide?: boolean }) => <span aria-hidden="true" className={`inline-block shrink-0 border border-border ${wide ? "h-3.5 w-11 lg:w-8" : "size-3.5 rounded-xs"}`} style={style} />;

/** Inline SVG county map (DS-06b). `fas` greys non-FAS counties to `--muted`; they stay focusable and labelled. `selected` gets the ring and the panel. One hover card serves all 29 counties (DS-11b). */
export function NeedMap({ data, fas = false, selected = null }: { data: NeedTableData; fas?: boolean; selected?: CountyRow | null }) {
  const counties = data.counties.filter((c) => GEO.counties[c.fips]);
  const ring = selected && GEO.counties[selected.fips] ? selected.fips : null;
  const shown = (c: CountyRow) => !fas || c.fas;
  const labelled = (c: CountyRow) => shown(c) && c.binNo !== null && GEO.counties[c.fips].bbox.every((v, i, b) => i < 2 || b[i] - b[i - 2] >= MIN_LABEL_UNITS);
  const bands = legendBands(counties), unpublished = counties.filter((c) => c.binNo === null).length;
  const words = Object.fromEntries(counties.map((c) => [c.fips, hoverWords(c, counties, data.columns, data.version)]));
  return (
    <MapHover words={words} selected={ring}>
    <div data-slot="need-map" className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12 [&>*]:min-w-0">
      {/* Map and its legend share the left 7 columns from 1024 (DS-20a); the panel is the right column. Below 1024: map, legend, then the panel. */}
      <figure className="m-0 flex min-w-0 flex-col gap-4 lg:col-span-7">
      <p id="need-map-summary" className="sr-only">{summary(counties)}</p>
      <svg viewBox={GEO.viewBox} role="group" aria-label="Utah county need map" aria-describedby="need-map-summary" preserveAspectRatio="xMinYMid meet" className="h-auto max-h-[640px] w-full">
        <defs>
          <pattern id="need-map-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)"><rect width="6" height="6" fill="var(--suppressed)" /><line x1="0" y1="0" x2="0" y2="6" stroke={HATCH_LINE} strokeWidth="1.5" /></pattern>
        </defs>
        {counties.map((c) => {
          const fill = !shown(c) ? "var(--muted)" : c.binNo === null ? "url(#need-map-hatch)" : fillFor(c.binNo);
          const on = c.fips === ring;
          return (
            <path key={c.fips} d={GEO.counties[c.fips].d} data-fips={c.fips} data-bin={shown(c) ? c.binNo ?? 0 : undefined} data-dim={shown(c) ? undefined : "true"} data-selected={on ? "true" : undefined}
              tabIndex={0} role="button" aria-pressed={on} aria-label={NeedMapQuery.rowLabel(c)} style={{ fill }} stroke="var(--border)" strokeWidth={1}
              className="cursor-pointer hover:stroke-2 hover:stroke-foreground focus-visible:outline-2 focus-visible:outline-ring" />
          );
        })}
        {/* FAS counties: 2 px --foreground outline in a second pass so neighbours never cover it (DESIGN need-map rule 2). */}
        {counties.filter((c) => c.fas).map((c) => <path key={c.fips} d={GEO.counties[c.fips].d} data-fas-outline={c.fips} fill="none" stroke="var(--foreground)" strokeWidth={2} pointerEvents="none" aria-hidden="true" />)}
        {/* Selected county: 3 px --ring outline in a third pass, above the FAS outline (DS-06 colour rules). */}
        {ring ? <path d={GEO.counties[ring].d} data-selected-outline={ring} fill="none" stroke="var(--ring)" strokeWidth={3} pointerEvents="none" aria-hidden="true" /> : null}
        {/* Rank at the centroid from 1024 where the county box is ≥ 24 px each way: 20 units reads as 13 px at 1024; 16 units reads as 13 px at 1440 (0.84 px per unit). */}
        {counties.filter(labelled).map((c) => {
          const [x, y] = GEO.counties[c.fips].centroid;
          const fill = (c.binNo ?? 0) >= 4 ? "var(--primary-foreground)" : "var(--foreground)";
          return <text key={c.fips} x={x} y={y} fill={fill} textAnchor="middle" dominantBaseline="central" aria-hidden="true" pointerEvents="none" className="hidden font-medium tabular-nums lg:block lg:text-xl min-[1440px]:text-base">{c.rank.split(" ")[0]}</text>;
        })}
      </svg>
        <figcaption data-slot="map-legend" className="flex flex-col gap-2 text-sm">
          <p className="m-0 text-xs font-medium text-muted-foreground">Need score, version {data.version}</p>
          {/* One strip (DS-20a): the five band swatches from lower to higher need, then the hatch and the FAS outline. Each keeps its Hint (range and count, why hatched, what an FAS county is). */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <div data-slot="legend-ramp" className="grid grid-cols-2 text-xs text-muted-foreground">
              <ul className="col-span-2 m-0 flex list-none items-center p-0">
                {bands.map((b, i) => <li key={b.name}><Hint text={bandHint(b, i + 1, bands.length)} label={`${b.name} · ${countiesWord(b.count)}`} className="lg:p-0.5"><Swatch wide style={{ background: fillFor(i + 1) }} /></Hint></li>)}
              </ul>
              <span aria-hidden="true">Lower need</span><span aria-hidden="true" className="text-right">Higher need</span>
            </div>
            <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 p-0">
              <li><Hint text={whyHidden("not_published")} className={LEGEND_ITEM}><Swatch style={HATCH_CSS} />Not published · {countiesWord(unpublished)}</Hint></li>
              <li><Hint text={GLOSSARY.fas_county.plain} className={LEGEND_ITEM}><Swatch style={{ outline: "2px solid var(--foreground)", outlineOffset: "-1px" }} />FAS county (outlined)</Hint></li>
            </ul>
          </div>
          <p data-slot="legend-note" className="m-0 text-xs text-muted-foreground">{LEGEND_NOTE}</p>
        </figcaption>
      </figure>
      {/* Panel: the right column from 1024 (sticky); below 1024 it follows the legend. */}
      <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start">
        <CountyPanel county={selected} columns={data.columns} version={data.version} rankedCount={counties.filter((c) => c.status === "Ranked").length} sources={data.sources} counties={counties} top={topCounties(data.rows)} fas={fas} />
      </div>
    </div>
    </MapHover>
  );
}
