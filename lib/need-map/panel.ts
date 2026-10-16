/** Words and order for the selected-county panel (DS-20b): the rank line, the key measures and the all-measures groups. Pure. */
import { whyHidden } from '../trust/glossary';
import { NOT_PUBLISHED, NOT_YET, type Column, type ColumnSource, type CountyRow } from './query';
import { bandName } from './words';

/** The five rates that make up the need score (DESIGN need score rule 3), in panel order. */
export const KEY_MEASURES = ['uninsured_rate', 'poverty_rate', 'child_poverty_rate', 'single_parent_pct', 'no_vehicle_pct'] as const;
/** Plain-words topic per source name; an unknown source is its own topic. Order here is the group order. */
const TOPICS: Record<string, string> = { 'Census SAHIE': 'Health coverage', 'Census SAIPE': 'Poverty', 'Census ACS 5-year': 'Households and population', 'Utah State Courts': 'Court filings' };

/** 1 → `1st`, 2 → `2nd`, 13 → `13th`, 22 → `22nd`. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13, end = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${end}`;
}

export type RankLine = { ranked: boolean; place: string; rest: string };
/** `3rd highest need` + ` of 26 counties scored · Highest need band`, from the stored rank and band; an unscored county gets no rank, in words. */
export function rankLine(county: CountyRow, counties: CountyRow[]): RankLine {
  const [rank, of] = county.rank.split(' of ').map(Number), k = Math.max(0, ...counties.map((c) => c.binNo ?? 0));
  if (county.binNo === null || !rank || !of) return { ranked: false, place: 'No need score, so no rank or band.', rest: whyHidden(county.status === 'Not published' ? 'not_published' : 'not_available') };
  return { ranked: true, place: rank === 1 ? 'Highest need' : `${ordinal(rank)} highest need`, rest: ` of ${of} counties scored · ${bandName(county.binNo, k)} band` };
}

export type MeasureGroup = { topic: string; source: ColumnSource; columns: Column[] };
/** One group per source and release: its topic, the source line, then its measures: the key rates in key order, other rates, then counts. Known sources first, in `TOPICS` order. */
export function measureGroups(columns: Column[], sources: ColumnSource[]): MeasureGroup[] {
  const groups = new Map<string, MeasureGroup>();
  for (const c of columns) {
    const source = sources.find((s) => s.code === c.code) ?? { code: c.code, name: 'Unknown source', vintage: NOT_PUBLISHED, asOf: NOT_YET };
    const key = `${source.name}|${source.vintage}`, g = groups.get(key) ?? { topic: TOPICS[source.name] ?? source.name, source, columns: [] };
    g.columns.push(c);
    groups.set(key, g);
  }
  const order = (g: MeasureGroup) => { const i = Object.keys(TOPICS).indexOf(g.source.name); return i < 0 ? 99 : i; };
  const rate = (c: Column) => { const i = (KEY_MEASURES as readonly string[]).indexOf(c.code); return i >= 0 ? i : c.unit === 'percent' ? 5 : 6; };
  return [...groups.values()].sort((a, b) => order(a) - order(b)).map((g) => ({ ...g, columns: g.columns.sort((a, b) => rate(a) - rate(b)) }));
}
