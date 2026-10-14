import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../synthetic/generate';
import { EXAMPLE_MARKER, csvToRecords, parseCsv, toErrorReportCsv, toTemplateCsv } from './csv';
import { INTAKE_ENTITIES, TEMPLATE_HEADERS } from './schema';
import { validateRows } from './validate';
import { TemplateHttp } from './template-http';

describe('csv', () => {
  it('parses quotes, embedded commas and newlines, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, ""y""","line1\nline2"\r\n\r\n')).toEqual([['a', 'b'], ['x, "y"', 'line1\nline2']]);
    expect(csvToRecords('a,b\n1\n')).toEqual({ headers: ['a', 'b'], rows: [{ a: '1', b: '' }] });
  });
  it('template has the schema headers and a marked example row that validates once the marker is cleared', () => {
    const ctx = { countyFips: new Set(COUNTIES.map((c) => c.fips)) };
    for (const e of INTAKE_ENTITIES) {
      const { headers, rows } = csvToRecords(toTemplateCsv(e));
      expect(headers).toEqual(TEMPLATE_HEADERS[e]);
      expect(rows[0]!.id).toBe(EXAMPLE_MARKER);
      expect(validateRows(e, [{ ...rows[0]!, id: '' }], ctx).errors, e).toEqual([]);
    }
  });
  it('error report is row,column,code,message with quoting', () => {
    const csv = toErrorReportCsv([{ row: 3, column: 'county_fips', code: 'county', message: 'County code 49999 is not a Utah county' }]);
    expect(csv).toBe('row,column,code,message\r\n3,county_fips,county,County code 49999 is not a Utah county\r\n');
    expect(toErrorReportCsv([{ row: 2, column: 'x', code: 'enum', message: 'Use one of: a, b' }])).toContain('"Use one of: a, b"');
  });
});

describe('TemplateHttp', () => {
  const req = (q: string) => new Request(`http://127.0.0.1/api/intake/template${q}`);
  it('serves a CSV attachment to admin and staff', async () => {
    const res = TemplateHttp.handle(req('?entity=case'), 'staff');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toBe('attachment; filename="fas-case-template.csv"');
    expect((await res.text()).split('\r\n')[0]).toBe(TEMPLATE_HEADERS.case.join(','));
    expect(TemplateHttp.handle(req('?entity=outcome'), 'admin').status).toBe(200);
  });
  it('400 on unknown entity, 403 for board, 401 when signed out', () => {
    expect(TemplateHttp.handle(req('?entity=provider'), 'admin').status).toBe(400);
    expect(TemplateHttp.handle(req(''), 'admin').status).toBe(400);
    expect(TemplateHttp.handle(req('?entity=case'), 'board_viewer').status).toBe(403);
    expect(TemplateHttp.handle(req('?entity=case'), '').status).toBe(403);
    expect(TemplateHttp.handle(req('?entity=case'), null).status).toBe(401);
  });
});
