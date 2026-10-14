import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildXlsx } from '../../tests/fixtures/ut_courts/build';
import { cellText, sheetRows } from './xlsx';

describe('xlsx', () => {
  it('reads the matching sheet of the committed fixture as trimmed strings', async () => {
    const { name, rows } = await sheetRows(readFileSync('tests/fixtures/ut_courts/filings.xlsx'), /^all$/i);
    expect([name, rows.length]).toEqual(['All', 345]);
    expect(rows[0]).toEqual(['Fiscal Year', 'District', 'County', 'Court Type', 'Location', 'Category', 'Case Type', 'Filing Count']);
    expect(rows[1]).toEqual(['2025', 'District 1', 'Beaver', 'District', 'Beaver City', 'Synthetic', 'Civil', '37']);
  });

  it('picks the first matching sheet, renders blanks as "", and fails closed listing the sheets seen', async () => {
    const buf = Buffer.from(buildXlsx({ Notes: [['x']], 'FY2026 All': [['a', null, ' b ']], All: [['c']] }));
    expect((await sheetRows(buf, /all/i)).rows).toEqual([['a', '', 'b']]);
    await expect(sheetRows(buf, /filings/i)).rejects.toThrow(/no sheet matches \/filings\/i; saw Notes, FY2026 All, All/);
    expect([cellText(null), cellText(12.5), cellText(new Date('2026-07-01T00:00:00Z'))]).toEqual(['', '12.5', '2026-07-01']);
  });
});
