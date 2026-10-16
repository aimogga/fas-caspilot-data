import { describe, expect, it } from 'vitest';
import { MANUAL_HINT } from '../dashboard/words';
import { FOUNDATION_FIELDS } from './foundation';
import { addedMonth, DROP_HELP, FORM_HELP, formHelp, HEADER, HIDDEN, IMPORT_INTRO, importFailure, PREVIEW_FIX, RECENT_TERMS, recentCells, recentNote, saveFailure } from './form-words';

const BANNED = /\b(N\/A|null|undefined|NaN|pct|FIPS|MOE|TBD|lorem|CasePilot)\b|!|M[1-6]\b|\$0\.00/;
const ROW = { id: 'a', title: 'Synthetic Access Fund', funder: 'Synthetic Foundation', close_date: '2027-03-31', award_floor: 5000, award_ceiling: 25000, source: 'foundation_manual', imported: '2026-10' };

describe('DS-24 foundation grant words', () => {
  it('every form field has one or two plain sentences, and no help is written for a field that does not exist', () => {
    for (const f of FOUNDATION_FIELDS) {
      const help = formHelp(f.key);
      expect(help, f.key).toMatch(/^[A-Z].*\.$/);
      expect((help ?? '').split(/\. /).length, `${f.key} sentences`).toBeLessThanOrEqual(2);
      expect(help, f.key).not.toMatch(BANNED);
    }
    expect(Object.keys(FORM_HELP).sort()).toEqual(FOUNDATION_FIELDS.map((f) => f.key).sort());
  });
  it('helper words name the rules the validator enforces: required, both date formats, the date order, dollars, the floor/ceiling order, semicolons, the URL prefix', () => {
    for (const k of ['title', 'funder']) expect(formHelp(k)).toContain('Required');
    for (const k of ['posted_date', 'close_date']) expect(formHelp(k)).toContain('like 2026-03-31 or 3/31/2026');
    expect(formHelp('close_date')).toContain('on or after the posted date');
    expect(formHelp('award_floor')).toContain('in dollars, like 25000 or $25,000.00');
    expect(formHelp('award_ceiling')).toContain('at least the award floor');
    for (const k of ['applicant_types', 'program_themes']) expect(formHelp(k)).toContain('separated by semicolons');
    expect(formHelp('url')).toContain('http:// or https://');
  });
  it('header, import and preview words are plain sentences with a thousands comma and no banned strings', () => {
    for (const s of [HEADER.description, IMPORT_INTRO, DROP_HELP, PREVIEW_FIX]) { expect(s).toMatch(/^[A-Z].*\.$/); expect(s).not.toMatch(BANNED); }
    expect(HEADER.eyebrow).toBe('Foundation grants');
    expect(HEADER.title).toBe('Add the grants foundations publish');
    expect(IMPORT_INTRO).toContain('up to 2,000 rows or 2 MB');
  });
  it('a full row: badge, close date and award carry the term, value, source and added month; the funder is plain text', () => {
    const c = recentCells(ROW);
    expect(c.badge).toEqual({ text: 'Manual entry', attrs: { 'data-term': 'manual_entry', 'data-value': 'Added by hand', 'data-source': 'Typed in by FAS staff', 'data-asof': 'Oct 2026' } });
    expect(c.close.text).toBe('Closes Mar 31, 2027');
    expect(c.close.attrs).toMatchObject({ 'data-term': 'close_date', 'data-value': 'Mar 31, 2027' });
    expect(c.award).toMatchObject({ text: '$5,000–$25,000', attrs: { 'data-term': 'award_range', 'data-value': '$5,000–$25,000' } });
    expect(c.funder).toEqual({ text: 'Synthetic Foundation', attrs: {} });
    expect(c.award.attrs['data-hidden']).toBeUndefined();
  });
  it('missing values read as words with the reason, never $0 or blank; a 0 floor is no floor; an import says so', () => {
    const c = recentCells({ ...ROW, funder: null, close_date: null, award_floor: null, award_ceiling: null, source: 'foundation_csv', imported: null });
    expect(c.award).toMatchObject({ text: 'Award not stated', attrs: { 'data-value': 'Not stated', 'data-hidden': HIDDEN.award } });
    expect(c.close).toMatchObject({ text: 'No close date', attrs: { 'data-hidden': HIDDEN.close } });
    expect(c.funder).toMatchObject({ text: 'Funder not stated', attrs: { 'data-term': 'funder', 'data-hidden': HIDDEN.funder } });
    expect(c.badge.attrs).toMatchObject({ 'data-value': 'Imported from a list', 'data-source': 'Imported by FAS staff from a list' });
    expect(c.badge.attrs['data-asof']).toBeUndefined();
    expect(recentCells({ ...ROW, award_floor: 0, award_ceiling: 12000 }).award.text).toBe('Up to $12,000');
    expect(recentCells({ ...ROW, award_floor: 2500, award_ceiling: null }).award.text).toBe('From $2,500');
    expect(recentCells({ ...ROW, award_floor: 0, award_ceiling: null }).award.text).toBe('Award not stated');
  });
  it('terms have a title and plain words; the badge says what the dashboard badge says; the month parser rejects junk', () => {
    for (const t of Object.values(RECENT_TERMS)) { expect(t.title).toMatch(/^[A-Z]/); expect(t.plain).toMatch(/\.$/); expect(t.plain).not.toMatch(BANNED); }
    expect(RECENT_TERMS.manual_entry.plain).toBe(MANUAL_HINT);
    expect([addedMonth('2026-01'), addedMonth('2026-13'), addedMonth('2026-10-05'), addedMonth(undefined)]).toEqual(['Jan 2026', undefined, undefined, undefined]);
    expect(recentNote(1)).toMatch(/^The newest grant, as each funder published it/);
    expect(recentNote(10)).toMatch(/^The 10 newest grants, as each funder published them/);
  });
  it('save and import failures say what happened and what to do, never a table name', () => {
    expect(saveFailure(409, 'An opportunity with the same funder, title and close date already exists')).toBe('An opportunity with the same funder, title and close date already exists. Check the list below before adding it again.');
    expect(saveFailure(500, 'Could not save to opportunity')).toBe('The save did not finish. Reload the page to see whether it was saved, then try again.');
    expect(importFailure(422, { errors: [{}, {}] })).toBe('2 rows were rejected when saving, so nothing was imported. Fix those rows in your file and choose it again.');
    expect(importFailure(422, { errors: [{}] })).toContain('1 row was rejected');
    expect(importFailure(409, { error: 'An opportunity with the same funder, title and close date already exists' })).toContain('so nothing was imported');
    for (const s of [saveFailure(500), importFailure(500, { error: 'Could not save to pipeline_status' })]) expect(s).not.toMatch(/opportunity|pipeline_status|500/);
  });
});
