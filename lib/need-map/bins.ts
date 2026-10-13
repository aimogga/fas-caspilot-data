import type { Scored } from './rank';

export class NeedBins {
  /** Quantile bins 1 (lowest) to 5 (highest) over scored counties only; fewer bins when fewer distinct scores. */
  static assign(rows: Scored[]): Map<string, number> {
    const values = rows.flatMap((r) => (r.score === null ? [] : [r.score]));
    values.sort((a, b) => a - b);
    const k = Math.min(5, new Set(values).size);
    const out = new Map<string, number>();
    for (const r of rows) {
      if (r.score === null) continue;
      out.set(r.fips, Math.floor((values.indexOf(r.score) * k) / values.length) + 1);
    }
    return out;
  }
}
