import { describe, expect, it } from 'vitest';
import { asOfLabel, asOfNote, NOT_AVAILABLE } from './cards';

describe('as-of wording', () => {
  it('writes the month when there is one and never "as of Not available yet"', () => {
    expect([asOfLabel('Jul 2026'), asOfLabel(NOT_AVAILABLE)]).toEqual(['Data as of Jul 2026', 'Data date not available yet']);
    expect([asOfNote('Jul 2026'), asOfNote(NOT_AVAILABLE)]).toEqual(['as of Jul 2026', 'date not available yet']);
  });
});
