/** F-404 CSV appendix (pure): one row per `Figure`, no free-text paragraphs. Header `section,label,value,unit,source,as_of,status`; a suppressed
 * figure keeps its label with an empty value and status `fewer_than_11` or `hidden`. RFC 4180 quoting, CRLF rows, UTF-8 BOM so Excel opens it. */
import type { Figure, Packet } from './model';

export const CSV_HEADER = ['section', 'label', 'value', 'unit', 'source', 'as_of', 'status'] as const, BOM = '﻿';
export type FigureStatus = 'shown' | 'fewer_than_11' | 'hidden';
/** Quote a cell when it holds a comma, quote, CR or LF; inner quotes double. */
export const csvCell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const figureStatus = (f: Figure): FigureStatus => (f.value === 'fewer than 11' ? 'fewer_than_11' : f.value === 'hidden' ? 'hidden' : 'shown');
/** Unit read off the model's formatted value (never recomputed): `18%` → percent, `$1,840` → usd, `23 days` → days, `weight 1 (100%)` → weight. */
export function unitOf(value: string): string {
  if (/^[+\-−]?\$/.test(value)) return 'usd';
  if (/%/.test(value)) return 'percent';
  if (/\bdays?\b/.test(value)) return 'days';
  return /^weight\b/.test(value) ? 'weight' : '';
}
export function csvRows(p: Packet): string[][] {
  return p.sections.flatMap((s) => s.figures.map((f) => {
    const status = figureStatus(f), shown = status === 'shown';
    return [s.title, f.label, shown ? f.value : '', shown ? unitOf(f.value) : '', f.sourceLabel, f.asOf, status];
  }));
}
export const packetToCsv = (p: Packet): string => BOM + [[...CSV_HEADER], ...csvRows(p)].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
