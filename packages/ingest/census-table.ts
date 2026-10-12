export class CensusTable {
  static parse(json: unknown): Record<string, string>[] {
    if (!Array.isArray(json) || json.length < 1) {
      throw new Error('census table must be a JSON array');
    }
    const header = json[0];
    if (!Array.isArray(header) || header.length === 0 || header.some((h) => typeof h !== 'string')) {
      throw new Error('census header must be strings');
    }
    const rows: Record<string, string>[] = [];
    for (const raw of json.slice(1)) {
      if (!Array.isArray(raw) || raw.length !== header.length) {
        throw new Error('census row width mismatch');
      }
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) {
        const key = header[i] as string;
        row[key] = raw[i] == null ? '' : String(raw[i]);
      }
      rows.push(row);
    }
    return rows;
  }
}
