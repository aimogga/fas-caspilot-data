import { TEMPLATE_HEADERS, type IntakeEntity } from './schema';
import type { RowError } from './validate';

export const EXAMPLE_MARKER = 'EXAMPLE-DELETE-ME';
const EX: Record<string, string> = {
  referral_source: 'court', court_involved: 'yes', court_order_date: '2024-02-01', referral_date: '2024-02-15', county_fips: '49035',
  household_size: '4', income_band: 'b', prior_services: 'school counseling', case_id: 'f1030000-0000-4000-a000-0000000003e8',
  application_date: '2024-03-01', decision_date: '2024-03-08', decision: 'approved', award_amount: '$1,840.00', family_contribution: '0',
  application_id: 'f1030000-0000-4000-a000-0000000007d0', service_type: 'therapy', provider_id: '', units: '8', rate: '115', total_authorized: '920',
  authorization_id: 'f1030000-0000-4000-a000-000000000bb8', first_session_date: '2024-03-15', last_session_date: '2024-04-29',
  sessions_attended: '7', no_shows: '1', discharge_status: 'completed', non_start_reason: '', dollars_paid: '805',
  measure_code: 'PHQ-9', baseline_score: '14', baseline_date: '2024-03-15', followup_score: '9', followup_date: '2024-05-13',
};

export function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const line = (cells: unknown[]) => cells.map(csvCell).join(',');

/** Header row (column keys) plus one synthetic example row whose first cell is `EXAMPLE-DELETE-ME`. */
export function toTemplateCsv(entity: IntakeEntity): string {
  const keys = TEMPLATE_HEADERS[entity];
  const example = keys.map((k, i) => (i === 0 ? EXAMPLE_MARKER : EX[k] ?? ''));
  return `${line(keys)}\r\n${line(example)}\r\n`;
}

export function toErrorReportCsv(errors: RowError[]): string {
  return [line(['row', 'column', 'code', 'message']), ...errors.map((e) => line([e.row, e.column, e.code, e.message]))].join('\r\n') + '\r\n';
}

/** RFC-4180-tolerant parser: quoted fields, escaped quotes, commas/newlines inside quotes, CRLF or LF, optional BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const src = text.startsWith('﻿') ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** First row is the header; later rows become header-keyed records (missing cells → ''). */
export function csvToRecords(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const [headers = [], ...body] = parseCsv(text);
  const hs = headers.map((h) => h.trim());
  return { headers: hs, rows: body.map((r) => Object.fromEntries(hs.map((h, i) => [h, r[i] ?? '']))) };
}
