import { COUNTIES } from '../synthetic/generate';

export type FasRow = { fips: string };

export class FasCounties {
  /** Fips set from `fas_service_county` rows. Unknown fips are ignored, duplicates collapse, an empty list is fine. */
  static fromRows(rows: FasRow[], counties: { fips: string }[] = COUNTIES): Set<string> {
    const known = new Set(counties.map((c) => c.fips));
    return new Set(rows.map((r) => r.fips).filter((fips) => known.has(fips)));
  }
}
