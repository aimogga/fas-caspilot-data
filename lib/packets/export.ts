/** F-404 export envelope (pure): format → body, MIME type and a month-only filename. The route never ships a packet with an `assertPacket` violation. */
import { packetToCsv } from './csv';
import { packetToDocx } from './docx';
import type { Packet } from './model';

export type ExportFormat = 'docx' | 'csv';
export const FORMATS: ExportFormat[] = ['docx', 'csv'];
export const MIME: Record<ExportFormat, string> = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', csv: 'text/csv; charset=utf-8' };
export const isFormat = (v: string | null): v is ExportFormat => v === 'docx' || v === 'csv';
/** `fas-evidence-packet-<variant>-<scope>-<YYYY-MM>.<ext>`: the month only (privacy rule 5), the scope slug from the packet's own label. */
export function exportFilename(p: Packet, format: ExportFormat, now: Date): string {
  const scope = p.scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `fas-evidence-packet-${p.variant}-${scope}-${now.toISOString().slice(0, 7)}.${format}`;
}
export async function renderExport(p: Packet, format: ExportFormat, now: Date): Promise<{ body: Uint8Array<ArrayBuffer>; mime: string; filename: string }> {
  const body = format === 'docx' ? await packetToDocx(p) : new TextEncoder().encode(packetToCsv(p));
  return { body, mime: MIME[format], filename: exportFilename(p, format, now) };
}
