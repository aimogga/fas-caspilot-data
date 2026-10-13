import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../synthetic/generate';
import { NEIGHBORS, NeedNeighbors } from './neighbors';

const known = new Set(COUNTIES.map((c) => c.fips));

describe('NEIGHBORS', () => {
  it('covers every county once and only known counties', () => {
    expect(Object.keys(NEIGHBORS).sort()).toEqual([...known].sort());
    for (const list of Object.values(NEIGHBORS)) {
      expect(list.length).toBeGreaterThan(0);
      expect(new Set(list).size).toBe(list.length);
      for (const n of list) expect(known.has(n)).toBe(true);
    }
  });

  it('is symmetric with no self-loops', () => {
    for (const [fips, list] of Object.entries(NEIGHBORS)) {
      expect(list).not.toContain(fips);
      for (const n of list) expect(NEIGHBORS[n], `${n} should list ${fips}`).toContain(fips);
    }
  });

  it('matches known borders', () => {
    expect(NeedNeighbors.of('49009').sort()).toEqual(['49043', '49047']);
    expect(NeedNeighbors.of('49035').sort()).toEqual(['49011', '49029', '49043', '49045', '49049', '49051']);
    expect(NeedNeighbors.of('00000')).toEqual([]);
  });

  it('picks the neighbour nearest each arrow direction from the centroids, or none within 90°', () => {
    expect([0, 90, 180, 270].map((a) => NeedNeighbors.toward('49035', a))).toEqual(['49043', '49049', '49045', '49011']);
    expect([0, 90, 180, 270].map((a) => NeedNeighbors.toward('49053', a))).toEqual(['49025', null, null, '49021']);
    expect(NeedNeighbors.toward('00000', 0)).toBeNull();
  });
});
