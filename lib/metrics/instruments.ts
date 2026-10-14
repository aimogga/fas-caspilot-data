/** Outcome instrument registry (D-005): PHQ-9 and GAD-7 live now; OQ-45 and Y-OQ registered but inactive. */
export type Direction = 'lower_is_better' | 'higher_is_better';
export type Instrument = { code: string; label: string; direction: Direction; min: number; max: number; active: boolean };

export const INSTRUMENTS: Record<string, Instrument> = {
  'PHQ-9': { code: 'PHQ-9', label: 'PHQ-9', direction: 'lower_is_better', min: 0, max: 27, active: true },
  'GAD-7': { code: 'GAD-7', label: 'GAD-7', direction: 'lower_is_better', min: 0, max: 21, active: true },
  'OQ-45': { code: 'OQ-45', label: 'OQ-45', direction: 'lower_is_better', min: 0, max: 180, active: false },
  YOQ: { code: 'YOQ', label: 'Y-OQ', direction: 'lower_is_better', min: 0, max: 240, active: false },
};

function get(code: string): Instrument {
  const inst = INSTRUMENTS[code];
  if (!inst) throw new Error(`Unknown outcome instrument "${code}"; registered: ${Object.keys(INSTRUMENTS).join(', ')}`);
  return inst;
}

export const Instrument = {
  get,
  has: (code: string): boolean => Object.hasOwn(INSTRUMENTS, code),
  /** DS-07 card copy. */
  directionNote: (code: string): string => (get(code).direction === 'lower_is_better' ? 'Lower is better' : 'Higher is better'),
  /** change = followup − baseline; zero is never an improvement. */
  isImprovement: (code: string, change: number): boolean =>
    get(code).direction === 'lower_is_better' ? change < 0 : change > 0,
};
