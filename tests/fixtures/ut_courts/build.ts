import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { strToU8, zipSync } from 'fflate';
import { COUNTIES } from '../../../lib/synthetic/generate.ts';

export type Cell = string | number | null;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cell = (v: Cell, r: number, c: number) => { // up to 26 columns
  const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
  return v == null ? '' : typeof v === 'number' ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
};
const OOX = 'http://schemas.openxmlformats.org';
const OFF = 'application/vnd.openxmlformats-officedocument.spreadsheetml';
const xml = (body: string) => strToU8(`<?xml version="1.0" encoding="UTF-8"?>${body}`);

/** Minimal .xlsx (inline strings, no styles, no shared strings): one sheet per entry, enough for read-excel-file. */
export function buildXlsx(sheets: Record<string, Cell[][]>): Uint8Array {
  const names = Object.keys(sheets);
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': xml(`<Types xmlns="${OOX}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
      + `<Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${OFF}.sheet.main+xml"/>`
      + names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${OFF}.worksheet+xml"/>`).join('') + '</Types>'),
    '_rels/.rels': xml(`<Relationships xmlns="${OOX}/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${OOX}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': xml(`<workbook xmlns="${OOX}/spreadsheetml/2006/main" xmlns:r="${OOX}/officeDocument/2006/relationships"><sheets>`
      + names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': xml(`<Relationships xmlns="${OOX}/package/2006/relationships">`
      + names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${OOX}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + '</Relationships>'),
  };
  names.forEach((n, i) => {
    const rows = sheets[n].map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ri, ci)).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = xml(`<worksheet xmlns="${OOX}/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
  });
  return zipSync(files, { level: 9, mtime: '2026-10-14T00:00:00Z' });
}

/** Synthetic long-format rows shaped like the AOC `All` sheet (docs/research/ut_courts.md): FY2025 + FY2026, Daggett absent in FY2025,
 *  one blank Filing Count (Beaver Juvenile FY2025), a `Statewide` Appellate pseudo-county per year. Values are deterministic, not real. */
export function fixtureRows(): Cell[][] {
  const rows: Cell[][] = [['Fiscal Year', 'District', 'County', 'Court Type', 'Location', 'Category', 'Case Type', 'Filing Count']];
  const types: [string, string[]][] = [['District', ['Civil', 'Domestic']], ['Juvenile', ['Delinquency', 'Child Welfare']], ['Justice', ['Traffic', 'Misdemeanor']]];
  for (const fy of [2025, 2026]) {
    COUNTIES.forEach((c, i) => {
      if (fy === 2025 && c.fips === '49009') return;
      types.forEach(([type, cases], t) => cases.forEach((kase, k) => {
        const blank = fy === 2025 && c.fips === '49001' && type === 'Juvenile' && k === 1;
        rows.push([fy, `District ${(i % 8) + 1}`, c.name, type, `${c.name} City`, 'Synthetic', kase, blank ? null : (i + 1) * 37 + t * 11 + k * 3 + (fy - 2025) * 5]);
      }));
    });
    rows.push([fy, 'Appellate', 'Statewide', 'Appellate', 'Salt Lake City', 'Appeals', 'Appeal', 900 + fy - 2025]);
  }
  return rows;
}

if (process.argv[1] // regenerate: node --experimental-strip-types tests/fixtures/ut_courts/build.ts
  && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('./filings.xlsx', import.meta.url), buildXlsx({ All: fixtureRows() }));
}
