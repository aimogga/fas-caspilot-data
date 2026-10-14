import { INTAKE_SCHEMA, type IntakeEntity } from './schema';
import type { RowError, ValidRow } from './validate';

/** F-301 part 2: pure helpers behind the upload wizard. Field key → file header (null = "Not in file"). */
export type Mapping = Record<string, string | null>;
export const MAX_FILE_BYTES = 5 * 1024 * 1024, PREVIEW_ROWS = 20;

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

/** Pre-fill each field with the first header matching its key or label, case- and spacing-insensitive. */
export function autoMap(headers: string[], entity: IntakeEntity): Mapping {
  const byNorm = new Map<string, string>();
  for (const h of headers) if (h.trim() && !byNorm.has(norm(h))) byNorm.set(norm(h), h);
  return Object.fromEntries(INTAKE_SCHEMA[entity].fields.map((f) => [f.key, byNorm.get(norm(f.key)) ?? byNorm.get(norm(f.label)) ?? null]));
}

/** Required fields still set to "Not in file"; the mapping step cannot continue while any remain. */
export function missingRequired(mapping: Mapping, entity: IntakeEntity): string[] {
  return INTAKE_SCHEMA[entity].fields.filter((f) => f.required && !mapping[f.key]).map((f) => f.label);
}

/** Parsed CSV body rows → records keyed by field key, ready for `validateRows`. Unmapped fields are ''. */
export function applyMapping(headers: string[], rows: string[][], mapping: Mapping): Record<string, string>[] {
  const col = Object.fromEntries(Object.entries(mapping).map(([key, h]) => [key, h == null ? -1 : headers.indexOf(h)]));
  return rows.map((r) => Object.fromEntries(Object.keys(mapping).map((key) => [key, col[key] >= 0 ? r[col[key]] ?? '' : ''])));
}

/** Plain-English check of a chosen file. Null means the file can go to the mapping step. */
export function fileProblem(bytes: number, parsed: string[][]): string | null {
  if (bytes > MAX_FILE_BYTES) return 'This file is over 5 MB. Split it into smaller files and upload them one at a time.';
  if (parsed.length === 0 || parsed[0].every((h) => h.trim() === '')) return 'This file has no header row. The first row must name the columns.';
  if (parsed.length < 2) return 'This file has a header row but no data rows.';
  return null;
}

export type Summary = { ready: number; withErrors: number; text: string; byCell: Map<string, string> };

/** Counts for the preview plus a `row:column` → message index so the table can mark each failing cell. */
export function summarize(result: { ok: ValidRow[]; errors: RowError[] }): Summary {
  const byCell = new Map<string, string>();
  for (const e of result.errors) byCell.set(`${e.row}:${e.column}`, e.message);
  const withErrors = new Set(result.errors.map((e) => e.row)).size;
  const plural = (n: number) => (n === 1 ? 'row' : 'rows');
  const ready = result.ok.length;
  return { ready, withErrors, byCell, text: `${ready} ${plural(ready)} ready · ${withErrors} ${plural(withErrors)} with errors` };
}
