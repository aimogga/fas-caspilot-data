/** A dependency-free PNG encoder and a low-fi raster of a picture's marks (bars, line, hatched bands, grid; no text) for the DOCX fallback image.
 * Word 2016+ draws the SVG; older Word and Google Docs show this raster, and the words sit in the caption and the figure table beside it. */
import { deflateSync } from 'node:zlib';
import type { Picture } from '../board/pictures';
import { linear } from './scale';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
const u32 = (n: number) => Uint8Array.from([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const chunk = (type: string, data: Uint8Array) => { const t = Uint8Array.from(type, (ch) => ch.charCodeAt(0)), body = new Uint8Array([...t, ...data]); return new Uint8Array([...u32(data.length), ...body, ...u32(crc32(body))]); };
/** RGB 8-bit, no alpha, filter 0 on every row. */
export function pngEncode(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  const ihdr = new Uint8Array([...u32(width), ...u32(height), 8, 2, 0, 0, 0]);
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', ihdr), ...chunk('IDAT', new Uint8Array(deflateSync(raw))), ...chunk('IEND', new Uint8Array())]);
}

export class Raster {
  readonly px: Uint8Array;
  constructor(readonly w: number, readonly h: number) { this.px = new Uint8Array(w * h * 3).fill(255); }
  set(x: number, y: number, [r, g, b]: number[]) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; const i = (y * this.w + x) * 3; this.px[i] = r as number; this.px[i + 1] = g as number; this.px[i + 2] = b as number; }
  rect(x: number, y: number, w: number, h: number, c: number[], hatch = false) {
    for (let j = Math.max(0, Math.round(y)); j < Math.min(this.h, Math.round(y + h)); j++) for (let i = Math.max(0, Math.round(x)); i < Math.min(this.w, Math.round(x + w)); i++) if (!hatch || (i + j) % 6 < 2) this.set(i, j, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: number[], width = 3) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1), r = Math.floor(width / 2);
    for (let k = 0; k <= steps; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / steps), y = Math.round(y0 + ((y1 - y0) * k) / steps); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) this.set(x + dx, y + dy, c); }
  }
  png() { return pngEncode(this.w, this.h, this.px); }
}
const CHART = [46, 94, 72], GRID = [217, 217, 217], HATCH = [154, 154, 154], INK = [31, 31, 31];
/** Marks only, laid out like the SVG at the same size so the two line up when a viewer swaps one for the other. */
export function pictureFallback(p: Picture, w: number, h: number): Uint8Array {
  const r = new Raster(w, h);
  if (p.kind === 'bar') {
    const left = w * 0.234, plot = w * 0.656, top = p.reference ? 28 : 8, rowH = (h - top - 24) / Math.max(p.points.length, 1);
    const s = linear(p.points.map((q) => q.value), plot, { floor: 0, include: [...(p.include ?? []), ...(p.reference ? [p.reference.value] : [])] });
    for (const t of s.ticks) r.rect(left + s.at(t), top, 1, rowH * p.points.length, GRID);
    p.points.forEach((q, i) => (q.value == null ? r.rect(left, top + i * rowH + 5, plot * 0.18, rowH - 10, HATCH, true) : r.rect(left, top + i * rowH + 5, Math.max(s.at(q.value), 1), rowH - 10, CHART)));
    if (p.reference) r.rect(left + s.at(p.reference.value), top - 4, 2, rowH * p.points.length + 4, INK);
  } else {
    const left = w * 0.0875, plot = w * 0.772, top = 16, ph = h - 56, n = Math.max(p.points.length - 1, 1);
    const s = linear(p.points.map((q) => q.value), ph, { include: p.reference ? [p.reference.value] : [] });
    const x = (i: number) => left + (i * plot) / n, y = (v: number) => top + ph - s.at(v);
    for (const t of s.ticks) r.rect(left, y(t), plot, 1, GRID);
    p.points.forEach((q, i) => { if (q.value == null) r.rect(x(i) - plot / n / 2, top, plot / n, ph, HATCH, true); });
    if (p.reference) r.rect(left, y(p.reference.value), plot, 2, INK);
    let prev: { x: number; y: number } | null = null;
    p.points.forEach((q, i) => { if (q.value == null) { prev = null; return; } const pt = { x: x(i), y: y(q.value) }; if (prev) r.line(prev.x, prev.y, pt.x, pt.y, CHART); r.rect(pt.x - 4, pt.y - 4, 8, 8, CHART); prev = pt; });
  }
  return r.png();
}
