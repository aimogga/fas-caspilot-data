import { describe, expect, it } from 'vitest';
import { bandEdges, fitBand } from './band';
import { V1_1_DRAFT_PARAMS, V1_DRAFT_PARAMS } from './config-defaults';

const words = (params: unknown, ...scores: number[]) => scores.map((s) => fitBand(s, params).label);

describe('F-504d fit bands', () => {
  it('edges: 59 Pass, 60 Worth a look, 74 Worth a look, 75 Strong fit (v1.1-draft params)', () => {
    expect(words(V1_1_DRAFT_PARAMS, 59, 60, 74, 75, 100, 0)).toEqual(['Pass', 'Worth a look', 'Worth a look', 'Strong fit', 'Strong fit', 'Pass']);
  });
  it('defaults when the band params are absent: 75 and the digest threshold (60), which follows digest_threshold / eval_threshold', () => {
    expect([bandEdges(undefined), bandEdges(null), bandEdges(V1_DRAFT_PARAMS), bandEdges({ band_strong: 'x', band_look: null })]).toEqual(Array(4).fill({ strong: 75, look: 60 }));
    expect(words({}, 59, 60, 74, 75)).toEqual(['Pass', 'Worth a look', 'Worth a look', 'Strong fit']);
    expect([bandEdges({ digest_threshold: 65 }), bandEdges({ eval_threshold: 55 }), bandEdges({ band_strong: 80, band_look: 50, digest_threshold: 65 })]).toEqual([{ strong: 75, look: 65 }, { strong: 75, look: 55 }, { strong: 80, look: 50 }]);
  });
  it('a blocker or floor cap is Pass with its stored reason, whatever the score; an uncapped Pass has no reason', () => {
    const blocker = fitBand(0, {}, [{ key: 'mission_fit', reason: 'Matched 3 of 5' }, { key: 'blocker_cap', reason: 'Score capped at 0: Only state governments may apply' }]);
    expect(blocker).toEqual({ key: 'pass', label: 'Pass', cap: 'blocker', reason: 'Score capped at 0: Only state governments may apply' });
    expect(fitBand(90, {}, [{ key: 'floor_cap', reason: 'Score capped at 0 (mission fit scored 0)' }])).toMatchObject({ key: 'pass', cap: 'floor', reason: 'Score capped at 0 (mission fit scored 0)' });
    expect(fitBand(40, {})).toEqual({ key: 'pass', label: 'Pass', cap: null, reason: null });
  });
});
