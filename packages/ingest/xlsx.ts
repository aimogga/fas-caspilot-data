import readXlsx from 'read-excel-file/node';

/** Every cell as a trimmed string: '' when empty, YYYY-MM-DD for dates, numbers via String(). */
export const cellText = (v: unknown): string => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** Rows of the first sheet whose name matches `sheetMatch`. Fails closed (listing the sheets seen) when none does. */
export async function sheetRows(buffer: Buffer, sheetMatch: RegExp): Promise<{ name: string; rows: string[][] }> {
  const sheets = await readXlsx(buffer);
  const hit = sheets.find((s) => sheetMatch.test(s.sheet));
  if (!hit) throw new Error(`xlsx: no sheet matches ${sheetMatch}; saw ${sheets.map((s) => s.sheet).join(', ')}`);
  return { name: hit.sheet, rows: hit.data.map((r) => r.map(cellText)) };
}
