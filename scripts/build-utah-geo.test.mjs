import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VIEW, build, decodeArcs, projector, ring, shape } from './build-utah-geo.mjs';

// Two 10-degree squares sharing arc 1 (the edge at lon -100): "49001" is the left square, "49003" the right one, "01001" is another state.
const topo = {
  transform: { scale: [0.5, 0.5], translate: [-110, 38] },
  arcs: [[[20, 20], [-20, 0], [0, -20]], [[20, 0], [0, 20]], [[0, 0], [20, 0]], [[20, 20], [20, 0], [0, -20], [-20, 0]]],
  objects: { counties: { geometries: [{ type: 'Polygon', arcs: [[2, 1, 0]], id: '49001' }, { type: 'MultiPolygon', arcs: [[[-2, 3]]], id: '49003' }, { type: 'Polygon', arcs: [[2, 1, 0]], id: '01001' }] } },
};

describe('build-utah-geo', () => {
  it('decodes delta-encoded arcs through the transform and joins them into rings', () => {
    const arcs = decodeArcs(topo);
    expect(arcs[0]).toEqual([[-100, 48], [-110, 48], [-110, 38]]);
    expect(ring(arcs, [2, 1, 0])).toEqual([[-110, 38], [-100, 38], [-100, 48], [-110, 48], [-110, 38]]);
    expect(ring(arcs, [-2])).toEqual([[-100, 48], [-100, 38]]);
  });

  it('projects the kept counties into the shared viewBox, rounded to one decimal', () => {
    const out = build(topo);
    expect(Object.keys(out)).toEqual(['49001', '49003']);
    expect(out['49001']).toMatchObject({ d: expect.stringMatching(/^M[\d. ]+(L[\d. ]+){3}Z$/), bbox: [0, expect.any(Number), expect.any(Number), expect.any(Number)] });
    expect(out['49003'].bbox[2]).toBe(VIEW[0]);
    expect(out['49001'].bbox[2]).toBeCloseTo(out['49003'].bbox[0], 1);
    expect(out['49001'].centroid[0]).toBeLessThan(out['49003'].centroid[0]);
    expect(shape([[[0, 0], [1, 0], [1, 1], [1, 1], [0, 1], [0, 0]]])).toEqual({ d: 'M0 0L1 0L1 1L0 1Z', centroid: [0.5, 0.5], bbox: [0, 0, 1, 1] });
    expect(projector([[0, 0], [10, 10]])([5, 5]).map(Math.round)).toEqual([300, 380]);
  });

  it('committed public/geo/utah-counties.json has 29 counties with paths and is under 100 KB', () => {
    const file = new URL('../public/geo/utah-counties.json', import.meta.url);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    expect(json).toMatchObject({ source: expect.stringMatching(/^us-atlas@3\.\d+\.\d+ \(Census cartographic boundary 1:10m, ISC\)$/), viewBox: '0 0 600 760' });
    const fips = Object.keys(json.counties);
    expect(fips).toHaveLength(29);
    expect(fips.every((f) => /^49\d{3}$/.test(f) && json.counties[f].d.length > 0 && json.counties[f].centroid.length === 2 && json.counties[f].bbox.length === 4)).toBe(true);
    expect(statSync(file).size).toBeLessThan(100 * 1024);
  });
});
