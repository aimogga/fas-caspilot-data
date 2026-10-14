import { describe, expect, it } from 'vitest';
import { Instrument, INSTRUMENTS } from './instruments';

describe('instrument registry (D-005)', () => {
  it('registers PHQ-9 and GAD-7 as active, OQ-45 and Y-OQ as inactive, all lower-is-better', () => {
    expect(Object.keys(INSTRUMENTS)).toEqual(['PHQ-9', 'GAD-7', 'OQ-45', 'YOQ']);
    expect(Object.values(INSTRUMENTS).filter((i) => i.active).map((i) => i.code)).toEqual(['PHQ-9', 'GAD-7']);
    expect(INSTRUMENTS['YOQ']!.label).toBe('Y-OQ');
    expect([INSTRUMENTS['PHQ-9']!.max, INSTRUMENTS['GAD-7']!.max, INSTRUMENTS['OQ-45']!.max, INSTRUMENTS['YOQ']!.max]).toEqual([27, 21, 180, 240]);
    expect(Object.values(INSTRUMENTS).every((i) => i.min === 0 && i.direction === 'lower_is_better')).toBe(true);
  });

  it('directionNote gives the DS-07 card copy', () => {
    expect(Instrument.directionNote('PHQ-9')).toBe('Lower is better');
    INSTRUMENTS['TEST-UP'] = { code: 'TEST-UP', label: 'Up', direction: 'higher_is_better', min: 0, max: 10, active: false };
    try { expect(Instrument.directionNote('TEST-UP')).toBe('Higher is better'); } finally { delete INSTRUMENTS['TEST-UP']; }
  });

  it('isImprovement follows the direction; zero is never an improvement', () => {
    expect(Instrument.isImprovement('GAD-7', -2)).toBe(true);
    expect(Instrument.isImprovement('GAD-7', 3)).toBe(false);
    expect(Instrument.isImprovement('GAD-7', 0)).toBe(false);
    INSTRUMENTS['TEST-UP'] = { code: 'TEST-UP', label: 'Up', direction: 'higher_is_better', min: 0, max: 10, active: false };
    try {
      expect(Instrument.isImprovement('TEST-UP', 3)).toBe(true);
      expect(Instrument.isImprovement('TEST-UP', -2)).toBe(false);
    } finally { delete INSTRUMENTS['TEST-UP']; }
  });

  it('throws a clear error for an unknown code (no silent default)', () => {
    expect(() => Instrument.directionNote('BDI')).toThrow(/Unknown outcome instrument "BDI"/);
    expect(() => Instrument.isImprovement('BDI', -1)).toThrow(/PHQ-9, GAD-7, OQ-45, YOQ/);
    expect(Instrument.has('BDI')).toBe(false);
  });
});
