import { createHash } from 'node:crypto';
import { COUNTIES } from '../../lib/synthetic/generate';
import type { IndicatorRow } from './public-indicator';

/** Utah county FIPS from the synthetic county list (29). */
export const UTAH_COUNTY_FIPS = new Set(COUNTIES.map((c) => c.fips));

/** Shared unit token when Census returns N/A / blank for a published cell. */
export const CENSUS_NOT_PUBLISHED = 'not_published';

export class CensusTable {
  static parse(json: unknown): Record<string, string>[] {
    if (!Array.isArray(json) || json.length < 1) throw new Error('census table must be a JSON array');
    const header = json[0];
    if (!Array.isArray(header) || header.some((h) => typeof h !== 'string')) {
      throw new Error('census header must be strings');
    }
    return json.slice(1).map((raw) => {
      if (!Array.isArray(raw) || raw.length !== header.length) throw new Error('census row width mismatch');
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i] as string] = raw[i] == null ? '' : String(raw[i]);
      return row;
    });
  }

  /** Sorted sha256 of indicator rows (geo_fips:indicator_code). Identical across ACS/SAHIE/SAIPE. */
  static checksum(rows: IndicatorRow[]): string {
    const key = (r: IndicatorRow) => `${r.geo_fips}:${r.indicator_code}`;
    const sorted = [...rows].sort((a, b) => key(a).localeCompare(key(b)));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }

  /**
   * Empty / N/A → null; non-finite → undefined.
   * Pass extraNulls for source-specific sentinels (ACS treats "-" as null).
   */
  static num(raw: string | undefined, extraNulls: readonly string[] = []): number | null | undefined {
    if (raw == null || raw === '' || raw === 'N/A' || extraNulls.includes(raw)) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  /** Require CENSUS_API_KEY, GET buildUrl(key), fail closed on non-OK. */
  static async fetchJson(
    buildUrl: (key: string) => URL,
    label: string,
    env: Record<string, string | undefined> = process.env,
    httpFetch: typeof fetch = fetch,
  ): Promise<unknown> {
    const key = env.CENSUS_API_KEY;
    if (!key) throw new Error('CENSUS_API_KEY is not set');
    const res = await httpFetch(buildUrl(key));
    if (!res.ok) throw new Error(`${label} fetch failed: ${res.status}`);
    return res.json();
  }

  /** Fail closed on rejects or incomplete county × code coverage. */
  static requireCountyCoverage(
    rows: IndicatorRow[],
    rejects: string[],
    codesPerCounty: number,
    label: string,
  ): void {
    if (rejects.length > 0) throw new Error(`${label} rejected ${rejects.length} rows`);
    const n = new Map<string, number>();
    for (const r of rows) n.set(r.geo_fips, (n.get(r.geo_fips) ?? 0) + 1);
    if ([...n.values()].some((c) => c !== codesPerCounty) || n.size !== COUNTIES.length) {
      throw new Error(`${label} partial response: ${n.size} counties`);
    }
  }
}
