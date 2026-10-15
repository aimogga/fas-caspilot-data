import { describe, expect, it } from 'vitest';
import { nearestIndex, stepIndex, tooltipText } from './hover';
describe('chart hover helpers', () => {
  it('snaps an x position to the nearest of n evenly spread points, clamped to the plot', () => {
    expect([nearestIndex(0, 4), nearestIndex(16, 4), nearestIndex(17, 4), nearestIndex(50, 4), nearestIndex(100, 4)]).toEqual([0, 0, 1, 2, 3]);
    expect([nearestIndex(-20, 4), nearestIndex(140, 4), nearestIndex(50, 1), nearestIndex(50, 0)]).toEqual([0, 3, 0, 0]);
  });
  it('writes the tooltip with the unit, Hidden for a suppressed point, and the note', () => {
    expect(tooltipText({ label: 'Q3 ’26', value: 23 }, ' days')).toBe('Q3 ’26 · 23 days');
    expect(tooltipText({ label: 'Q1 ’26', value: null })).toBe('Q1 ’26 · Hidden (n < 11)');
    expect(tooltipText({ label: 'Unknown', value: null, note: 'Hidden to protect another band' })).toBe('Unknown · Hidden (n < 11) · Hidden to protect another band');
  });
  it('moves the active point with arrow, Home and End keys and ignores the rest', () => {
    expect([stepIndex(1, 'ArrowRight', 4), stepIndex(3, 'ArrowRight', 4), stepIndex(1, 'ArrowLeft', 4), stepIndex(0, 'ArrowLeft', 4)]).toEqual([2, 3, 0, 0]);
    expect([stepIndex(2, 'Home', 4), stepIndex(0, 'End', 4), stepIndex(2, 'Enter', 4)]).toEqual([0, 3, 2]);
  });
});
