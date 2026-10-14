import { describe, expect, it } from 'vitest';
import { externalId, FOUNDATION_FIELDS, toOpportunityRow, validateFoundation } from './foundation';
import { FOUNDATION_TEMPLATE_CSV, importReport, parseCsv, parseFoundationCsv, toErrorReportCsv } from './foundation-csv';

const good = { title: 'Family Therapy Fund', funder: 'Synthetic Utah Foundation', posted_date: '1/15/2026', close_date: '2026-03-31', award_floor: '$5,000', award_ceiling: '25000', applicant_types: '501(c)(3); Utah nonprofits', url: 'https://example.test/rfp' };
const codes = (input: Record<string, string>) => validateFoundation(input, 3).errors.map((e) => `${e.row}:${e.column}:${e.code}`);

describe('F-502 foundation validation and CSV', () => {
  it('coerces a valid row into an opportunity row with a stable external_id, and reports every bad cell', () => {
    const v = validateFoundation(good), row = toOpportunityRow(v.ok!, 'foundation_manual', new Date('2026-10-14T12:00:00Z'));
    expect(v.errors).toEqual([]);
    expect(row).toMatchObject({ source: 'foundation_manual', external_id: 'foundation:synthetic-utah-foundation:family-therapy-fund:2026-03-31', title: good.title, posted_date: '2026-01-15', award_floor: 5000, award_ceiling: 25000, description: null });
    expect(row.eligibility).toEqual({ applicant_types: ['501(c)(3)', 'Utah nonprofits'], funding_categories: [], description: null }); expect(row.raw).toMatchObject({ url: 'https://example.test/rfp', imported_at: '2026-10' });
    expect(externalId({ funder: 'Café & Co.', title: 'Y', close_date: null })).toBe('foundation:cafe-co:y:none'); expect(codes({})).toEqual(['3:title:required', '3:funder:required']);
    expect(codes({ ...good, posted_date: '2026-04-01' })).toEqual(['3:close_date:date_order']);
    expect(codes({ ...good, award_floor: '-5', award_ceiling: '2/30/2026', url: 'ftp://x', close_date: '2026-02-30' })).toEqual(['3:close_date:type', '3:award_floor:type', '3:award_ceiling:type', '3:url:type']);
    expect(codes({ ...good, award_floor: '30000' })).toEqual(['3:award_ceiling:money_order']); expect(codes({ ...good, title: 'x'.repeat(201) })).toEqual(['3:title:length']);
  });
  it('parses the template (skipping the example row), tolerant CSV, limits, and writes the error report', () => {
    expect(FOUNDATION_TEMPLATE_CSV.split('\r\n')[0].split(',')).toEqual(FOUNDATION_FIELDS.map((f) => f.key)); expect(parseFoundationCsv(FOUNDATION_TEMPLATE_CSV).rows).toEqual([]);
    expect(parseCsv('﻿a,b\r\n"x, ""q""",2\n')).toEqual([['a', 'b'], ['x, "q"', '2']]);
    const report = importReport(parseFoundationCsv('title,funder,award_floor\r\nA,F,10\r\nB,,-1\r\n').rows);
    expect(report.ok.map((r) => r.title)).toEqual(['A']); expect(report.errors.map((e) => `${e.row}:${e.column}`)).toEqual(['3:funder', '3:award_floor']);
    expect(toErrorReportCsv(report.errors).split('\r\n')[1]).toBe('3,funder,required,Funder is required');
    expect(parseFoundationCsv('name\r\nA\r\n').error).toMatch(/title and funder/); expect(parseFoundationCsv(`title,funder\r\n${'A,F\r\n'.repeat(2001)}`).error).toMatch(/limit is 2000/);
  });
});
