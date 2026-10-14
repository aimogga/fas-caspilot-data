import { describe, expect, it } from 'vitest';
import { applyMapping, autoMap, fileProblem, MAX_FILE_BYTES, missingRequired, summarize } from './mapping';
import { INTAKE_SCHEMA, TEMPLATE_HEADERS } from './schema';
import { validateRows } from './validate';

const UT = new Set(['49035', '49049']);

describe('autoMap', () => {
  it('maps a downloaded template 1:1 by key', () => {
    const m = autoMap(TEMPLATE_HEADERS.case, 'case');
    for (const f of INTAKE_SCHEMA.case.fields) expect(m[f.key]).toBe(f.key);
  });
  it('matches labels and keys case- and spacing-insensitively, first header wins, rest are null', () => {
    const m = autoMap(['Referral Date', 'COUNTY_FIPS', 'County code (Utah FIPS)', 'court-involved', 'junk', ''], 'case');
    expect(m.referral_date).toBe('Referral Date');
    expect(m.county_fips).toBe('COUNTY_FIPS');
    expect(m.court_involved).toBe('court-involved');
    expect(m.household_size).toBeNull();
    expect(Object.keys(m)).toEqual(TEMPLATE_HEADERS.case);
  });
  it('missingRequired lists required labels still set to Not in file', () => {
    expect(missingRequired(autoMap(['referral_date'], 'case'), 'case')).toEqual(['Court involved', 'County code (Utah FIPS)']);
    expect(missingRequired(autoMap(TEMPLATE_HEADERS.case, 'case'), 'case')).toEqual([]);
  });
});

describe('applyMapping', () => {
  it('re-keys rows by field key and fills unmapped or short rows with empty strings', () => {
    const headers = ['County', 'When', 'Court?'];
    const m = { ...autoMap([], 'case'), county_fips: 'County', referral_date: 'When', court_involved: 'Court?' };
    const rows = applyMapping(headers, [['035', '2024-02-15', 'yes'], ['049']], m);
    expect(rows[0]).toMatchObject({ county_fips: '035', referral_date: '2024-02-15', court_involved: 'yes', household_size: '' });
    const v = validateRows('case', rows, { countyFips: UT });
    expect(v.ok).toHaveLength(1);
    expect(v.errors.map((e) => [e.row, e.column])).toEqual([[3, 'court_involved'], [3, 'referral_date']]);
  });
});

describe('fileProblem', () => {
  it('rejects oversize, headerless and empty files in plain English', () => {
    expect(fileProblem(MAX_FILE_BYTES + 1, [['a'], ['1']])).toMatch(/over 5 MB/);
    expect(fileProblem(10, [])).toMatch(/no header row/);
    expect(fileProblem(10, [['a']])).toMatch(/no data rows/);
    expect(fileProblem(MAX_FILE_BYTES, [['a'], ['1']])).toBeNull();
  });
});

describe('summarize', () => {
  it('counts rows (not cells), pluralises, and indexes messages by row:column', () => {
    const e = (column: string, message: string) => ({ row: 2, column, code: 'x', message });
    const s = summarize({ ok: [{ row: 3, values: {} }], errors: [e('county_fips', 'County code 999 is not a Utah county'), e('referral_date', 'Referral date is required')] });
    expect([s.ready, s.withErrors, s.text]).toEqual([1, 1, '1 row ready · 1 row with errors']);
    expect(s.byCell.get('2:county_fips')).toMatch(/not a Utah county/);
    expect(s.byCell.has('3:county_fips')).toBe(false);
    expect(summarize({ ok: [], errors: [] }).text).toBe('0 rows ready · 0 rows with errors');
  });
});
