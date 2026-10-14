/**
 * F-306 small-cell suppression (docs/PRIVACY_AND_COMPLIANCE.md rule 4): hide any count below THRESHOLD, hide rates
 * whose numerator or denominator is hidden, and apply complementary suppression so a hidden cell cannot be recovered
 * from a shown total: when exactly one row of a count column is hidden while that column's total is shown, the
 * next-smallest row in the column is hidden too (marked `complementary`). Pure; used by every shared view and export.
 */
import { r4 } from './compute';

export const THRESHOLD = 11;
export type Cell = { value: number | null; suppressed: boolean };

export const suppressCount = (n: number): Cell => (n < THRESHOLD ? { value: null, suppressed: true } : { value: n, suppressed: false });

export const suppressRate = (numerator: number, denominator: number): Cell =>
  numerator < THRESHOLD || denominator < THRESHOLD ? { value: null, suppressed: true } : { value: r4(numerator / denominator), suppressed: false };

type Row = Record<string, unknown>;
export type SuppressedRow<T extends Row> = T & { suppressed: boolean; complementary: boolean };
export type TableOptions = { countKeys: string[]; rateKeys?: string[]; total?: Row | null };

/** Band tables like M4: `countKeys` are suppressed per row, `rateKeys` go with them, `total` enables complementary suppression. */
export function suppressTable<T extends Row>(rows: T[], { countKeys, rateKeys = [], total = null }: TableOptions) {
  const out: SuppressedRow<T>[] = rows.map((r) => ({ ...r, suppressed: false, complementary: false }));
  const totalShown = total != null && countKeys.every((k) => Number(total[k]) >= THRESHOLD);
  const hide = (r: SuppressedRow<T>, k: string, complementary: boolean) =>
    Object.assign(r, { [k]: null, suppressed: true, complementary: r.complementary || complementary }, Object.fromEntries(rateKeys.map((rk) => [rk, null])));
  for (const k of countKeys) {
    const small = out.filter((_, i) => Number(rows[i]![k]) < THRESHOLD);
    small.forEach((r) => hide(r, k, false));
    if (totalShown && small.length === 1) {
      const rest = out.filter((r) => r[k] != null).sort((a, b) => Number(a[k]) - Number(b[k]));
      if (rest[0]) hide(rest[0], k, true);
    }
  }
  const shownTotal = total == null ? null : Object.fromEntries(Object.entries(total).map(([k, v]) => [k, !totalShown && [...countKeys, ...rateKeys].includes(k) ? null : v]));
  return { rows: out, total: shownTotal, totalShown, includesHiddenBands: out.some((r) => r.suppressed) };
}
