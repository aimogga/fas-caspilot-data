import { CensusTable, CENSUS_NOT_PUBLISHED, UTAH_COUNTY_FIPS } from '../census-table';
import type { IndicatorRow } from '../public-indicator';
import { Socrata } from '../socrata';

/** PLACES measureid → indicator_code; both are "% of adults", so unit is percent. */
const MEASURES: Record<string, string> = { MHLTH: 'mental_distress_rate', DEPRESSION: 'depression_rate' };
const CODES = Object.values(MEASURES);
type Env = Record<string, string | undefined>;

export type PlacesParse = { rows: IndicatorRow[]; rejects: string[] };

/**
 * CDC PLACES county release (Socrata `swc5-untb`). Age-adjusted prevalence only: it is the figure comparable across
 * counties for the need score; a county/measure with no age-adjusted row is stored as `not_published`, never as crude.
 */
export class CdcPlaces {
  static readonly SOURCE_NAME = 'cdc-places';
  static readonly HOST = 'https://data.cdc.gov';
  static readonly DATASET = 'swc5-untb';
  static readonly VALUE_TYPE = 'Age-adjusted prevalence';
  static readonly NOT_PUBLISHED = CENSUS_NOT_PUBLISHED;

  static requestUrl(year?: string, env: Env = process.env): URL {
    let where = `stateabbr='UT' AND measureid in('MHLTH','DEPRESSION') AND data_value_type='${CdcPlaces.VALUE_TYPE}'`;
    if (year !== undefined) where += ` AND year='${year}'`;
    return Socrata.url(CdcPlaces.HOST, CdcPlaces.DATASET, {
      $where: where, $select: 'year,locationid,locationname,measureid,data_value,low_confidence_limit,high_confidence_limit,data_value_type', $limit: '1000',
    }, env);
  }

  static async fetch(year?: string, env: Env = process.env, httpFetch = fetch): Promise<unknown> {
    return Socrata.fetchJson(CdcPlaces.requestUrl(year, env), 'PLACES', httpFetch);
  }

  /** Non-Utah rows, other measures and non-age-adjusted rows are skipped; bad Utah rows are rejected (fail closed). */
  static parse(json: unknown): PlacesParse {
    if (!Array.isArray(json)) throw new Error('PLACES response is not a JSON array');
    const rows: IndicatorRow[] = [];
    const rejects: string[] = [];
    for (const item of json as unknown[]) {
      const row = (item ?? {}) as Record<string, unknown>;
      /** Socrata numbers arrive as strings; absent key / null / '' → null; non-finite → undefined. */
      const num = (k: string) => CensusTable.num(row[k] == null ? '' : String(row[k]));
      const geo_fips = String(row.locationid ?? '').replace(/\D/g, '').padStart(5, '0');
      const code = MEASURES[String(row.measureid)];
      if (!UTAH_COUNTY_FIPS.has(geo_fips) || !code || row.data_value_type !== CdcPlaces.VALUE_TYPE) continue;
      const vintage = String(row.year ?? '').trim();
      const [value, lo, hi] = [num('data_value'), num('low_confidence_limit'), num('high_confidence_limit')];
      const err = !/^\d{4}$/.test(vintage) ? 'missing year' : value === undefined ? 'not numeric'
        : lo === undefined || hi === undefined ? 'ci not numeric' : value != null && (value < 0 || value > 100) ? 'out of range' : null;
      if (err) {
        rejects.push(`${geo_fips} ${code} ${err}`);
        continue;
      }
      const moe = value != null && lo != null && hi != null ? (hi - lo) / 2 : null;
      const unit = value == null ? CdcPlaces.NOT_PUBLISHED : 'percent';
      rows.push({ indicator_code: code, geo_fips, period: vintage, value: value ?? null, moe, unit, vintage });
    }
    return { rows, rejects };
  }

  /** Counties × codes absent from the response become explicit not_published rows (no values invented). */
  static fill(parsed: PlacesParse): PlacesParse {
    const vintages = [...new Set(parsed.rows.map((r) => r.vintage))];
    if (vintages.length !== 1) return parsed;
    const [vintage] = vintages as [string];
    const have = new Set(parsed.rows.map((r) => `${r.geo_fips}:${r.indicator_code}`));
    const rows = [...parsed.rows];
    for (const geo_fips of UTAH_COUNTY_FIPS) {
      for (const code of CODES) {
        if (have.has(`${geo_fips}:${code}`)) continue;
        rows.push({ indicator_code: code, geo_fips, period: vintage, value: null, moe: null, unit: CdcPlaces.NOT_PUBLISHED, vintage });
      }
    }
    return { rows, rejects: parsed.rejects };
  }

  static requireComplete(parsed: PlacesParse): IndicatorRow[] {
    CensusTable.requireCountyCoverage(parsed.rows, parsed.rejects, CODES.length, 'PLACES');
    if (new Set(parsed.rows.map((r) => r.vintage)).size !== 1) throw new Error('PLACES mixed vintages');
    return parsed.rows;
  }

  static checksum(rows: IndicatorRow[]): string {
    return CensusTable.checksum(rows);
  }
}
