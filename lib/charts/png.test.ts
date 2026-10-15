import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Picture } from '@/lib/board/pictures';
import { crc32, pictureFallback, pngEncode, Raster } from './png';
const be = (b: Uint8Array, i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
/** Walks the chunks, checks each CRC, and returns the inflated image rows. */
function decode(png: Uint8Array) {
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  let i = 8, idat = new Uint8Array(), width = 0, height = 0; const types: string[] = [];
  while (i < png.length) {
    const len = be(png, i), type = String.fromCharCode(...png.subarray(i + 4, i + 8)), body = png.subarray(i + 4, i + 8 + len);
    expect(crc32(body)).toBe(be(png, i + 8 + len));
    if (type === 'IHDR') { width = be(png, i + 8); height = be(png, i + 12); expect([png[i + 16], png[i + 17]]).toEqual([8, 2]); }
    if (type === 'IDAT') idat = new Uint8Array([...idat, ...png.subarray(i + 8, i + 8 + len)]);
    types.push(type); i += 12 + len;
  }
  return { types, width, height, raw: new Uint8Array(inflateSync(idat)) };
}
describe('PNG fallback', () => {
  it('crc32 matches the reference value for "123456789"', () => { expect(crc32(Uint8Array.from('123456789', (c) => c.charCodeAt(0)))).toBe(0xcbf43926); });
  it('encodes a valid RGB PNG: signature, IHDR, IDAT with filter-0 rows, IEND, CRCs', () => {
    const r = new Raster(4, 3); r.rect(1, 1, 2, 1, [46, 94, 72]);
    const d = decode(r.png());
    expect([d.types, d.width, d.height, d.raw.length]).toEqual([['IHDR', 'IDAT', 'IEND'], 4, 3, 3 * (1 + 4 * 3)]);
    expect([...d.raw.subarray(13, 13 + 1 + 12)]).toEqual([0, 255, 255, 255, 46, 94, 72, 46, 94, 72, 255, 255, 255]);
    expect(pngEncode(1, 1, Uint8Array.from([0, 0, 0])).length).toBeGreaterThan(40);
  });
  it('rasterises a bar and a line picture at the asked size with chart-coloured marks and a hatched band for hidden values', () => {
    const bar: Picture = { id: 'dollars', kind: 'bar', eyebrow: '', noun: 'share', unit: '%', valueHead: '', n: 12, asOf: '', include: [100], reference: { value: 50, label: 'Half' }, points: [{ label: 'a', value: 60 }, { label: 'b', value: null }] };
    const line: Picture = { id: 'wait', kind: 'line', eyebrow: '', noun: 'days', unit: '', valueHead: '', n: 12, asOf: '', reference: { value: 21, label: 'Goal' }, points: [{ label: 'q1', value: 30 }, { label: 'q2', value: null }, { label: 'q3', value: 20 }] };
    for (const p of [bar, line]) {
      const d = decode(pictureFallback(p, 320, 120));
      expect([d.width, d.height]).toEqual([320, 120]);
      let chart = 0, hatch = 0;
      for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) { const i = y * (1 + d.width * 3) + 1 + x * 3; if (d.raw[i] === 46 && d.raw[i + 1] === 94) chart++; if (d.raw[i] === 154 && d.raw[i + 1] === 154) hatch++; }
      expect(chart).toBeGreaterThan(100); expect(hatch).toBeGreaterThan(20);
    }
  });
});
