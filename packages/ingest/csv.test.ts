import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('csv', () => {
  it('parses quoted commas, doubled quotes, CRLF and a trailing newline', () => {
    const { header, records } = parseCsv('\uFEFFName ,Score\r\n"Tri-County, SE",12\r\n"Say ""hi""",3\r\n');
    expect(header).toEqual(['Name', 'Score']);
    expect(records).toEqual([{ Name: 'Tri-County, SE', Score: '12' }, { Name: 'Say "hi"', Score: '3' }]);
  });

  it('skips blank lines and fails closed on a ragged row', () => {
    expect(parseCsv('a,b\n\n1,2\n').records).toEqual([{ a: '1', b: '2' }]);
    expect(() => parseCsv('a,b\n1,2,3')).toThrow(/width mismatch/);
  });

  it('treats a trailing comma on the header as a blank column (HRSA HPSA export): rows may carry or omit it', () => {
    const { header, records } = parseCsv('a,b,\r\n1,2\r\n3,4,\r\n');
    expect(header).toEqual(['a', 'b']);
    expect(records).toEqual([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
    expect(() => parseCsv('a,b,\n1')).toThrow(/width mismatch/);
    expect(() => parseCsv('a,b,\n1,2,x')).toThrow(/width mismatch/);
  });
});
