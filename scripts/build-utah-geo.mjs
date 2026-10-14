// Builds public/geo/utah-counties.json from the us-atlas npm package (Census cartographic boundary 1:10m, ISC).
// D-020 / DESIGN need-map rule 7: generated at build time and committed, never fetched at runtime. Usage: node scripts/build-utah-geo.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const VIEW = [600, 760];
const require = createRequire(import.meta.url);
const r1 = (n) => Math.round(n * 10) / 10;
const same = (a, b) => a[0] === b[0] && a[1] === b[1];
const range = (pts, i) => [Math.min(...pts.map((p) => p[i])), Math.max(...pts.map((p) => p[i]))];

/** TopoJSON arcs: delta-encoded quantized points -> absolute [lon, lat]. */
export function decodeArcs({ arcs, transform: { scale = [1, 1], translate = [0, 0] } = {} }) {
  return arcs.map((arc) => {
    const p = [0, 0];
    return arc.map(([dx, dy]) => [(p[0] += dx) * scale[0] + translate[0], (p[1] += dy) * scale[1] + translate[1]]);
  });
}

/** Join an arc index list into one ring; a negative index ~i means arc i reversed; shared join points are dropped. */
export function ring(arcs, indexes) {
  return indexes.reduce((out, i) => out.concat((i < 0 ? [...arcs[~i]].reverse() : arcs[i]).slice(out.length ? 1 : 0)), []);
}

/** Equirectangular projection (x scaled by cos of the mean latitude), fitted and centred in VIEW. */
export function projector(points) {
  const [[x0, x1], [y0, y1]] = [range(points, 0), range(points, 1)];
  const k = Math.cos(((y0 + y1) / 2) * (Math.PI / 180));
  const s = Math.min(VIEW[0] / ((x1 - x0) * k), VIEW[1] / (y1 - y0));
  const [ox, oy] = [(VIEW[0] - (x1 - x0) * k * s) / 2, (VIEW[1] - (y1 - y0) * s) / 2];
  return ([lon, lat]) => [ox + (lon - x0) * k * s, oy + (y1 - lat) * s];
}

/** SVG path (1 decimal, repeated and closing points dropped), area centroid of the largest ring, and bbox. */
export function shape(rings) {
  const pts = rings.map((r) => r.map((p) => [r1(p[0]), r1(p[1])]).filter((p, i, a) => i === 0 || (!same(p, a[i - 1]) && !(i === a.length - 1 && same(p, a[0])))));
  const d = pts.map((r) => `M${r.map((p) => p.join(' ')).join('L')}Z`).join('');
  const [[x0, x1], [y0, y1]] = [range(pts.flat(), 0), range(pts.flat(), 1)];
  const big = pts.reduce((a, b) => (b.length > a.length ? b : a));
  let [area, cx, cy] = [0, 0, 0];
  for (let i = 0; i < big.length; i += 1) {
    const [p, q] = [big[i], big[(i + 1) % big.length]];
    const f = p[0] * q[1] - q[0] * p[1];
    [area, cx, cy] = [area + f, cx + (p[0] + q[0]) * f, cy + (p[1] + q[1]) * f];
  }
  const centroid = area === 0 ? [r1((x0 + x1) / 2), r1((y0 + y1) / 2)] : [r1(cx / (3 * area)), r1(cy / (3 * area))];
  return { d, centroid, bbox: [x0, y0, x1, y1] };
}

/** Counties whose id starts with `prefix`, projected together in one frame, keyed by fips. */
export function build(topo, prefix = '49') {
  const arcs = decodeArcs(topo);
  const geoms = topo.objects.counties.geometries.filter((g) => String(g.id).startsWith(prefix)).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const rings = geoms.map((g) => (g.type === 'MultiPolygon' ? g.arcs.flat() : g.arcs).map((r) => ring(arcs, r)));
  const project = projector(rings.flat(2));
  return Object.fromEntries(geoms.map((g, i) => [String(g.id), shape(rings[i].map((r) => r.map(project)))]));
}

export function main(out = new URL('../public/geo/utah-counties.json', import.meta.url)) {
  const topo = JSON.parse(readFileSync(require.resolve('us-atlas/counties-10m.json'), 'utf8'));
  const json = { source: `us-atlas@${require('us-atlas/package.json').version} (Census cartographic boundary 1:10m, ISC)`, viewBox: `0 0 ${VIEW.join(' ')}`, counties: build(topo) };
  writeFileSync(out, `${JSON.stringify(json)}\n`);
  return json;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  console.log(`wrote ${Object.keys(main().counties).length} counties`);
}
