import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../synthetic/generate';
import { coerce, parseDate, validateRows } from './validate';
import type { Field } from './schema';

const ctx = { countyFips: new Set(COUNTIES.map((c) => c.fips)) }, CASE_ID = 'f1030000-0000-4000-a000-0000000003e8';
const fld = (type: Field['type'], extra: Partial<Field> = {}): Field => ({ key: 'x', label: 'X', type, ...extra });
const CASE_OK = { court_involved: 'yes', referral_date: '2024-02-15', county_fips: '49035', referral_source: 'court', court_order_date: '2024-02-01' };

describe('coercion', () => {
  it('money', () => {
    expect(coerce(fld('money'), '$1,840.00', ctx)).toEqual({ value: 1840 });
    expect(coerce(fld('money'), '920', ctx)).toEqual({ value: 920 });
    expect(coerce(fld('money'), '-5', ctx)).toMatchObject({ code: 'type' });
    expect(coerce(fld('money'), '1.234', ctx)).toMatchObject({ code: 'type' });
  });
  it('booleans and integers', () => {
    for (const t of ['yes', 'TRUE', '1', 'y']) expect(coerce(fld('boolean'), t, ctx)).toEqual({ value: true });
    for (const t of ['no', 'false', '0', 'N']) expect(coerce(fld('boolean'), t, ctx)).toEqual({ value: false });
    expect(coerce(fld('boolean'), 'maybe', ctx)).toMatchObject({ code: 'type', message: 'X must be yes or no, got "maybe"' });
    expect(coerce(fld('integer'), '7', ctx)).toEqual({ value: 7 });
    expect(coerce(fld('integer'), '7.5', ctx)).toMatchObject({ code: 'type' });
    expect(coerce(fld('integer', { min: 1 }), '0', ctx)).toMatchObject({ code: 'min' });
  });
  it('dates: ISO and M/D/YYYY, rejects two-digit years and impossible days', () => {
    expect(parseDate('2024-03-31')).toBe('2024-03-31');
    expect(parseDate('3/31/2024')).toBe('2024-03-31');
    expect(parseDate('3/31/24')).toBeNull();
    expect(parseDate('2024-02-30')).toBeNull();
    expect(coerce(fld('date'), '31/03/2024', ctx)).toMatchObject({ code: 'type' });
  });
  it('enums are matched exactly or case-insensitively and list allowed values', () => {
    const f = fld('enum', { values: ['PHQ-9', 'YOQ'] });
    expect(coerce(f, 'phq-9', ctx)).toEqual({ value: 'PHQ-9' });
    expect(coerce(f, 'BDI', ctx)).toMatchObject({ code: 'enum', message: 'X "BDI" is not allowed. Use one of: PHQ-9, YOQ' });
  });
  it('county codes must be Utah counties; 3-digit codes are prefixed', () => {
    expect(coerce(fld('county_fips'), '49035', ctx)).toEqual({ value: '49035' });
    expect(coerce(fld('county_fips'), '035', ctx)).toEqual({ value: '49035' });
    expect(coerce(fld('county_fips'), '49999', ctx)).toMatchObject({ code: 'county', message: 'County code 49999 is not a Utah county' });
  });
  it('uuid refs check format and, when known ids are given, membership', () => {
    const id = 'F1030000-0000-4000-A000-0000000003E8';
    expect(coerce(fld('uuid_ref'), id, ctx)).toEqual({ value: id.toLowerCase() });
    expect(coerce(fld('uuid_ref'), 'case-1', ctx)).toMatchObject({ code: 'type' });
    expect(coerce(fld('uuid_ref'), id, { ...ctx, knownIds: new Set() })).toMatchObject({ code: 'reference' });
    expect(coerce(fld('uuid'), id, { ...ctx, knownIds: new Set() })).toEqual({ value: id.toLowerCase() });
  });
});

describe('validateRows', () => {
  it('numbers rows from 2, trims, treats empty as missing, one error per failing cell', () => {
    const rows = [CASE_OK, { ...CASE_OK, referral_date: ' ', county_fips: '49999', household_size: 'four' }];
    const { ok, errors } = validateRows('case', rows, ctx);
    expect(ok.map((r) => r.row)).toEqual([2]);
    expect(ok[0]!.values).toMatchObject({ court_involved: true, county_fips: '49035', household_size: null });
    expect(errors.map((e) => [e.row, e.column, e.code])).toEqual([[3, 'referral_date', 'required'], [3, 'county_fips', 'county'], [3, 'household_size', 'type']]);
    expect(errors[0]!.message).toBe('Referral date is required');
  });
  it('enforces each cross-field date rule', () => {
    const cases: [Parameters<typeof validateRows>[0], Record<string, string>, string][] = [
      ['case', { ...CASE_OK, court_order_date: '2024-03-01' }, 'referral_date'],
      ['application', { case_id: CASE_ID, application_date: '2024-03-08', decision_date: '2024-03-01' }, 'decision_date'],
      ['delivery', { authorization_id: CASE_ID, first_session_date: '5/1/2024', last_session_date: '2024-04-01' }, 'last_session_date'],
      ['outcome', { case_id: CASE_ID, measure_code: 'YOQ', baseline_score: '3', baseline_date: '2024-05-01', followup_date: '2024-04-01' }, 'followup_date'],
    ];
    for (const [entity, row, column] of cases) {
      const { errors } = validateRows(entity, [row], ctx);
      expect(errors, entity).toEqual([expect.objectContaining({ row: 2, column, code: 'date_order' })]);
    }
    expect(validateRows('application', [{ case_id: CASE_ID, application_date: '2024-03-01' }], ctx).errors).toEqual([]);
  });
});