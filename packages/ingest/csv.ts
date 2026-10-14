/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF; first row is the header. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted && c === '"') {
      if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (quoted) field += c;
    else if (c === '"') quoted = true;
    else if (c === ',') [row, field] = [[...row, field], ''];
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rows.push([...row, field]);
      [row, field] = [[], ''];
    } else field += c;
  }
  return field.length > 0 || row.length > 0 ? [...rows, [...row, field]] : rows;
}

export function parseCsv(text: string): { header: string[]; records: Record<string, string>[] } {
  const [first = [], ...body] = parseCsvRows(text.replace(/^\uFEFF/, ''));
  const header = first.map((h) => h.trim());
  const records = body.filter((r) => r.length > 1 || r[0] !== '').map((r) => {
    if (r.length !== header.length) throw new Error(`csv row width mismatch: ${r.length} vs ${header.length}`);
    return Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']));
  });
  return { header, records };
}
