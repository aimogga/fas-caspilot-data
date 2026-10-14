// F-502: CSV template, parser and report for foundation imports. Pure; no I/O. csvCell and parseCsv come from lib/intake/csv.ts (f301).
import { FOUNDATION_KEYS, type FoundationInput, type RowError, type ValidFoundation, validateFoundation } from './foundation';

export const EXAMPLE_MARKER = 'EXAMPLE-DELETE-ME', MAX_CSV_BYTES = 2 * 1024 * 1024, MAX_CSV_ROWS = 2000; export type CsvRow = { row: number; input: FoundationInput };
const EXAMPLE: Record<string, string> = {
  title: `${EXAMPLE_MARKER} Family Therapy Access Fund 2027`, funder: 'Synthetic Utah Foundation', posted_date: '2026-11-01', close_date: '2027-01-31', award_floor: '5000', award_ceiling: '25000',
  applicant_types: '501(c)(3); Utah nonprofits', program_themes: 'mental health; family preservation', eligibility_notes: 'Utah 501(c)(3)', url: 'https://example.test/rfp', description: 'Synthetic example row. Delete before importing.',
};
export const csvCell = (v: unknown): string => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const line = (cells: unknown[]) => cells.map(csvCell).join(',');
/** Header (field keys) plus one synthetic example row marked `EXAMPLE-DELETE-ME`; the importer skips marked rows. */
export const FOUNDATION_TEMPLATE_CSV = `${line(FOUNDATION_KEYS)}\r\n${line(FOUNDATION_KEYS.map((k) => EXAMPLE[k] ?? ''))}\r\n`;

/** RFC-4180-tolerant: quoted fields, escaped quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [], src = text.startsWith('﻿') ? text.slice(1) : text;
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) { if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Header-keyed records with their 1-based spreadsheet row; unknown columns are ignored, example rows dropped. */
export function parseFoundationCsv(text: string): { rows: CsvRow[]; error?: string } {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) return { rows: [], error: 'File is larger than 2 MB' };
  const [headers = [], ...body] = parseCsv(text), hs = headers.map((h) => h.trim().toLowerCase());
  if (!hs.includes('title') || !hs.includes('funder')) return { rows: [], error: 'The first row must name the columns and include title and funder' };
  const rows = body.map((r, i) => ({ row: i + 2, input: Object.fromEntries(hs.map((h, j) => [h, r[j] ?? ''])) })).filter((r) => !(r.input.title ?? '').startsWith(EXAMPLE_MARKER));
  return rows.length > MAX_CSV_ROWS ? { rows: [], error: `File has ${rows.length} rows; the limit is ${MAX_CSV_ROWS}` } : { rows };
}

export function importReport(rows: CsvRow[]): { ok: ValidFoundation[]; errors: RowError[] } {
  const ok: ValidFoundation[] = [], errors: RowError[] = [];
  for (const r of rows) { const v = validateFoundation(r.input, r.row); if (v.ok) ok.push(v.ok); else errors.push(...v.errors); } return { ok, errors };
}

export const toErrorReportCsv = (errors: RowError[]): string => [line(['row', 'column', 'code', 'message']), ...errors.map((e) => line([e.row, e.column, e.code, e.message]))].join('\r\n') + '\r\n';
