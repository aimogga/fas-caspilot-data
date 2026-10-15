/** F-403 export assertions (pure): every rule in docs/PRIVACY_AND_COMPLIANCE.md that a packet can break becomes a check. `assertPacket` returns the
 * violations found (an empty list is the pass); nothing here reads the database. */
import { pictureCaption } from '../charts/svg';
import type { Figure, Packet, PacketSection } from './model';

export type Violation = { rule: 'exact-date' | 'small-cell' | 'case-field' | 'unsourced'; where: string; text: string };
const MONTHS = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
/** ISO `2026-07-01`, slashed `7/1/2026`, `Jul 1, 2026`, `1 Jul 2026`: any day-level date. Month/quarter strings (`Jul 2026`, `Q3`) pass. */
export const EXACT_DATE = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b|\\b${MONTHS} \\d{1,2}, \\d{4}\\b|\\b\\d{1,2} ${MONTHS} \\d{4}\\b`, 'g');
/** Case-level column names that must never leave the staff screens. */
export const CASE_FIELDS = /\b(case_id|client_name|first_name|last_name|zip(_code)?|street|address|dob|date_of_birth|clinical_notes|ssn|npi)\b/gi;
/** Count patterns as the dashboards write them: `n = 7`, `(3 of 14)`. */
const COUNTS = /\bn = (\d+)\b|\((\d+) of (\d+)\)/g;
const AS_OF = /^(\w{3} \d{4}|Not available yet)$/;

/** Flattens the packet to the strings a reader would see, in reading order. */
export function renderText(p: Packet): string[] {
  const section = (s: PacketSection) => [s.title, ...s.paragraphs, ...s.figures.map((f) => `${f.label}: ${f.value} · ${f.sourceLabel} · as of ${f.asOf}`), s.source];
  return [p.title, p.scopeLabel, p.prepared, p.asOf, p.ribbon, ...p.sections.flatMap(section), ...p.pictures.map(pictureCaption), p.footer];
}
export const SMALL_CELL = 11, underCell = (s: string | undefined) => s !== undefined && Number(s) < SMALL_CELL;
export function assertFigure(f: Figure, where: string): Violation[] {
  const out: Violation[] = [];
  if (!f.sourceLabel.trim() || !AS_OF.test(f.asOf)) out.push({ rule: 'unsourced', where, text: `${f.label}: ${f.value} (${f.sourceLabel || 'no source'} · ${f.asOf || 'no as-of'})` });
  if (f.kind === 'count' && /^\d/.test(f.value) && Number(f.value.replace(/,/g, '').split(' ')[0]) < SMALL_CELL) out.push({ rule: 'small-cell', where, text: `${f.label}: ${f.value}` });
  return out;
}
export function assertPacket(p: Packet): Violation[] {
  const out: Violation[] = [];
  const scan = (text: string, where: string) => {
    for (const m of text.matchAll(EXACT_DATE)) out.push({ rule: 'exact-date', where, text: m[0] });
    for (const m of text.matchAll(CASE_FIELDS)) out.push({ rule: 'case-field', where, text: m[0] });
    for (const m of text.matchAll(COUNTS)) if (underCell(m[1]) || underCell(m[2])) out.push({ rule: 'small-cell', where, text: m[0] });
  };
  renderText(p).forEach((t, i) => scan(t, `text[${i}]`));
  for (const s of p.sections) {
    s.figures.forEach((f, i) => out.push(...assertFigure(f, `${s.id}.figures[${i}]`)));
    if (!s.source.trim() && s.paragraphs.some((t) => /\d/.test(t))) out.push({ rule: 'unsourced', where: s.id, text: 'numbers without a section source' });
  }
  return out;
}
