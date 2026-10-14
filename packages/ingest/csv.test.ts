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
});
