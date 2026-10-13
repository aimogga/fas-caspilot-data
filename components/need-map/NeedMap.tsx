import type { CSSProperties } from "react";
import { CountyPanel } from "@/components/need-map/CountyPanel";
import { NeedMapQuery, type CountyRow, type NeedTableData } from "@/lib/need-map/query";
import geo from "@/public/geo/utah-counties.json";

const GEO = geo as { source: string; viewBox: string; counties: Record<string, { d: string; centroid: number[]; bbox: number[] }> };
/** DS-06 ramp: `--chart-1` at these opacity steps for bins 1–5. Placeholder bins until George sets the weights. */
export const RAMP = [15, 35, 55, 75, 100];
const NAMES = [[], ["All scored"], ["Lowest", "Highest"], ["Lowest", "Middle", "Highest"], ["Lowest", "Lower", "Higher", "Highest"], ["Lowest", "Lower", "Middle", "Higher", "Highest"]];
const HATCH_LINE = "color-mix(in oklch, var(--foreground) 30%, transparent)";
const HATCH_CSS: CSSProperties = { backgroundColor: "var(--suppressed)", backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, ${HATCH_LINE} 3px, ${HATCH_LINE} 4px)` };
const MIN_LABEL_BOX = 28;
const fillFor = (bin: number) => `color-mix(in oklch, var(--chart-1) ${RAMP[bin - 1]}%, transparent)`;

/** Legend lines per bin: `<Name> <min> to <max>` from the data (U+2212 for negatives). */
export function legendBins(counties: CountyRow[]): string[] {
  const k = Math.max(0, ...counties.map((c) => c.binNo ?? 0));
  return Array.from({ length: k }, (_, i) => {
    const values = counties.flatMap((c) => (c.binNo === i + 1 && c.value !== null ? [c.value] : []));
    return `${NAMES[k]?.[i] ?? `Bin ${i + 1}`} ${NeedMapQuery.signed(Math.min(...values))} to ${NeedMapQuery.signed(Math.max(...values))}`;
  });
}

/** `aria-describedby` summary: top 3, bottom 3 and the not-published count. */
export function summary(counties: CountyRow[]): string {
  const ranked = counties.filter((c) => c.status === "Ranked");
  const names = (rows: CountyRow[]) => rows.map((r) => r.name).join(", ");
  return `Highest need: ${names(ranked.slice(0, 3))}. Lowest need: ${names(ranked.slice(-3).reverse())}. ${counties.length - ranked.length} counties not published.`;
}

const Swatch = ({ style }: { style?: CSSProperties }) => <span aria-hidden="true" className="inline-block size-3.5 shrink-0 rounded-xs border border-border" style={style} />;

/** Inline SVG county map (DS-06b). `fas` greys non-FAS counties to `--muted`; they stay focusable and labelled. `selected` gets the ring and the panel. */
export function NeedMap({ data, fas = false, selected = null }: { data: NeedTableData; fas?: boolean; selected?: CountyRow | null }) {
  const counties = data.counties.filter((c) => GEO.counties[c.fips]);
  const ring = selected && GEO.counties[selected.fips] ? selected.fips : null;
  const shown = (c: CountyRow) => !fas || c.fas;
  const labelled = (c: CountyRow) => shown(c) && c.binNo !== null && GEO.counties[c.fips].bbox.every((v, i, b) => i < 2 || b[i] - b[i - 2] >= MIN_LABEL_BOX);
  return (
    <figure data-slot="need-map" className="m-0 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-12 [&>*]:min-w-0">
      <p id="need-map-summary" className="sr-only">{summary(counties)}</p>
      <svg viewBox={GEO.viewBox} role="group" aria-label="Utah county need map" aria-describedby="need-map-summary" className="mx-auto h-auto max-h-[640px] w-full lg:col-span-7 lg:row-span-2">
        <defs>
          <pattern id="need-map-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)"><rect width="6" height="6" fill="var(--suppressed)" /><line x1="0" y1="0" x2="0" y2="6" stroke={HATCH_LINE} strokeWidth="1.5" /></pattern>
        </defs>
        {counties.map((c) => {
          const fill = !shown(c) ? "var(--muted)" : c.binNo === null ? "url(#need-map-hatch)" : fillFor(c.binNo);
          const on = c.fips === ring;
          return (
            <path key={c.fips} d={GEO.counties[c.fips].d} data-fips={c.fips} data-bin={shown(c) ? c.binNo ?? 0 : undefined} data-dim={shown(c) ? undefined : "true"} data-selected={on ? "true" : undefined}
              tabIndex={0} role="button" aria-pressed={on} aria-label={NeedMapQuery.rowLabel(c)} style={{ fill }} stroke="var(--border)" strokeWidth={1} className="focus-visible:outline-2 focus-visible:outline-ring" />
          );
        })}
        {/* FAS counties: 2 px --foreground outline in a second pass so neighbours never cover it (DESIGN need-map rule 2). */}
        {counties.filter((c) => c.fas).map((c) => <path key={c.fips} d={GEO.counties[c.fips].d} data-fas-outline={c.fips} fill="none" stroke="var(--foreground)" strokeWidth={2} pointerEvents="none" aria-hidden="true" />)}
        {/* Selected county: 3 px --ring outline in a third pass, above the FAS outline (DS-06 colour rules). */}
        {ring ? <path d={GEO.counties[ring].d} data-selected-outline={ring} fill="none" stroke="var(--ring)" strokeWidth={3} pointerEvents="none" aria-hidden="true" /> : null}
        {/* Rank at the centroid at ≥ 1440 only, where the county box is ≥ 28 px each way (DS-06 1440 layout). */}
        {counties.filter(labelled).map((c) => {
          const [x, y] = GEO.counties[c.fips].centroid;
          const fill = (c.binNo ?? 0) >= 4 ? "var(--primary-foreground)" : "var(--foreground)";
          return <text key={c.fips} x={x} y={y} fill={fill} fontSize={11} textAnchor="middle" dominantBaseline="central" aria-hidden="true" pointerEvents="none" className="hidden font-mono tabular-nums min-[1440px]:block">{c.rank.split(" ")[0]}</text>;
        })}
      </svg>
      {/* Panel: right column above the legend at ≥ 1024 (sticky), a card under the map and legend below (DS-06 L38-46). */}
      <div className="order-last lg:order-none lg:col-span-5 lg:sticky lg:top-4 lg:self-start">
        <CountyPanel county={selected} columns={data.columns} version={data.version} rankedCount={counties.filter((c) => c.status === "Ranked").length} sources={data.sources} />
      </div>
      <figcaption data-slot="map-legend" className="flex flex-col gap-2 text-sm lg:col-span-5">
        <p className="m-0 font-medium">Need score (version {data.version}) · Placeholder bins</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {legendBins(counties).map((text, i) => <li key={text} className="flex items-center gap-2 tabular-nums"><Swatch style={{ background: fillFor(i + 1) }} />{text}</li>)}
          <li className="flex items-center gap-2"><Swatch style={HATCH_CSS} />Not published</li>
          <li className="flex items-center gap-2"><Swatch style={{ outline: "2px solid var(--foreground)", outlineOffset: "-1px" }} />FAS county (outlined)</li>
        </ul>
        <p className="m-0 text-muted-foreground">Placeholder bins (5 equal-count groups) until need-score weights are set.</p>
        <p className="m-0 text-muted-foreground">Relative ranking, not absolute need.</p>
      </figcaption>
    </figure>
  );
}
