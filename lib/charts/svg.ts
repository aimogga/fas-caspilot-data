/** The board's pictures as standalone SVG (pure, no CSS tokens) for the DOCX export: black ink on white, the chart colour as a fixed hex, Arial.
 * Same words as the HTML charts: values on the marks, `Hidden (n < 11)` on a hatched band, the reference as a dashed line, the summary as the caption. */
import type { Picture } from '../board/pictures';
import { barSummary, fmt, linear, lineRuns, lineSummary, type ChartPoint } from './scale';

export const SVG_WIDTH = 640, INK = '#1f1f1f', MUTED = '#666666', GRID = '#d9d9d9', CHART = '#2e5e48', FONT = 'font-family="Arial, Helvetica, sans-serif"';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
type TextStyle = { size?: number; fill?: string; anchor?: 'start' | 'middle' | 'end'; bold?: boolean };
/** One attribute each (a repeated attribute is malformed XML, which LibreOffice and Word reject whole). */
const text = (x: number, y: number, s: string, { size = 13, fill = INK, anchor = 'start', bold = false }: TextStyle = {}) =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ''} ${FONT}>${esc(s)}</text>`;
const HATCH = `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f2f2f2"/><line x1="0" y1="0" x2="0" y2="6" stroke="#9a9a9a" stroke-width="1.5"/></pattern></defs>`;
const open = (h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${h}" viewBox="0 0 ${SVG_WIDTH} ${h}">${HATCH}<rect width="${SVG_WIDTH}" height="${h}" fill="#ffffff"/>`;

/** The one sentence under the picture: the bar headline (rank first) or the line summary (direction over the period). */
export const pictureCaption = (p: Picture): string => p.kind === 'bar' ? p.headline ?? barSummary(p.points, p.noun, p.unit) : lineSummary(p.points, p.noun, p.unit);
/** Height in SVG units for the picture's own layout (bars grow with their rows). */
export const svgHeight = (p: Picture): number => (p.kind === 'bar' ? 52 + 28 * p.points.length + (p.reference ? 20 : 0) : 240);

export function barSvg(p: Picture): string {
  const h = svgHeight(p), left = 150, right = 70, plot = SVG_WIDTH - left - right, top = p.reference ? 28 : 8, rowH = 28;
  const s = linear(p.points.map((q) => q.value), plot, { floor: 0, include: [...(p.include ?? []), ...(p.reference ? [p.reference.value] : [])] });
  const x = (v: number) => left + s.at(v), parts: string[] = [open(h)];
  for (const t of s.ticks) parts.push(`<line x1="${x(t).toFixed(1)}" y1="${top}" x2="${x(t).toFixed(1)}" y2="${top + rowH * p.points.length}" stroke="${GRID}"/>`, text(x(t), top + rowH * p.points.length + 16, fmt(t), { anchor: 'middle', fill: MUTED, size: 11 }));
  p.points.forEach((q, i) => {
    const y = top + i * rowH, mid = y + rowH / 2;
    parts.push(text(left - 8, mid + 4, q.label, { anchor: 'end' }));
    if (q.value == null) {
      parts.push(`<rect x="${left}" y="${y + 5}" width="${(plot * 0.18).toFixed(1)}" height="${rowH - 10}" fill="url(#hatch)"/>`);
      parts.push(text(left + plot * 0.18 + 6, mid + 4, 'Hidden (n < 11)', { fill: MUTED, size: 12 }));
    } else {
      parts.push(`<rect x="${left}" y="${y + 5}" width="${Math.max(s.at(q.value), 1).toFixed(1)}" height="${rowH - 10}" fill="${CHART}"/>`);
      parts.push(text(x(q.value) + 6, mid + 4, fmt(q.value, p.unit), { bold: true }));
    }
  });
  if (p.reference) {
    const rx = x(p.reference.value).toFixed(1);
    parts.push(`<line x1="${rx}" y1="${top - 4}" x2="${rx}" y2="${top + rowH * p.points.length}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    parts.push(text(x(p.reference.value), top - 10, `${p.reference.label} ${fmt(p.reference.value, p.unit)}`, { anchor: 'middle', bold: true, size: 12 }));
  }
  return parts.join('') + '</svg>';
}

export function lineSvg(p: Picture): string {
  const h = svgHeight(p), left = 56, right = 90, top = 16, bottom = 40, plot = SVG_WIDTH - left - right, ph = h - top - bottom, n = Math.max(p.points.length - 1, 1);
  const s = linear(p.points.map((q) => q.value), ph, { include: p.reference ? [p.reference.value] : [] });
  const x = (i: number) => left + (i * plot) / n, y = (v: number) => top + ph - s.at(v), parts: string[] = [open(h)];
  for (const t of s.ticks) parts.push(`<line x1="${left}" y1="${y(t).toFixed(1)}" x2="${left + plot}" y2="${y(t).toFixed(1)}" stroke="${GRID}"/>`, text(left - 8, y(t) + 4, fmt(t), { anchor: 'end', fill: MUTED, size: 11 }));
  p.points.forEach((q, i) => {
    if (q.value == null) parts.push(`<rect x="${(x(i) - plot / n / 2).toFixed(1)}" y="${top}" width="${(plot / n).toFixed(1)}" height="${ph}" fill="url(#hatch)"/>`);
    parts.push(text(x(i), h - bottom + 18, q.label, { anchor: 'middle', fill: MUTED, size: 11 }));
  });
  if (p.reference) {
    const ry = y(p.reference.value).toFixed(1);
    parts.push(`<line x1="${left}" y1="${ry}" x2="${left + plot}" y2="${ry}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 3"/>`);
    parts.push(text(left + plot + 6, y(p.reference.value) + 4, `${p.reference.label} ${fmt(p.reference.value, p.unit)}`, { size: 11 }));
  }
  for (const run of lineRuns(p.points, x, y)) if (run.length > 1) parts.push(`<polyline points="${run.join(' ')}" fill="none" stroke="${CHART}" stroke-width="2.5" stroke-linejoin="round"/>`);
  const known = p.points.map((q, i) => ({ ...q, i })).filter((q): q is ChartPoint & { i: number; value: number } => q.value != null);
  for (const q of known) parts.push(`<circle cx="${x(q.i).toFixed(1)}" cy="${y(q.value).toFixed(1)}" r="4" fill="${CHART}"/>`);
  const first = known[0], last = known[known.length - 1];
  if (first) parts.push(text(x(first.i) + 8, y(first.value) - 8, fmt(first.value, p.unit), { bold: true, size: 12 }));
  if (last && last !== first) parts.push(text(x(last.i) + 8, y(last.value) + 4, fmt(last.value, p.unit), { bold: true, size: 12 }));
  if (known.length === 0) parts.push(text(left + plot / 2, top + ph / 2, 'Hidden (n < 11)', { anchor: 'middle', fill: MUTED }));
  return parts.join('') + '</svg>';
}
export const pictureSvg = (p: Picture): string => (p.kind === 'bar' ? barSvg(p) : lineSvg(p));
