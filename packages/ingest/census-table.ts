export class CensusTable {
  static parse(json: unknown): Record<string, string>[] {
    if (!Array.isArray(json) || json.length < 1) throw new Error('census table must be a JSON array');
    const header = json[0];
    if (!Array.isArray(header) || header.some((h) => typeof h !== 'string')) {
      throw new Error('census header must be strings');
    }
    return json.slice(1).map((raw) => {
      if (!Array.isArray(raw) || raw.length !== header.length) throw new Error('census row width mismatch');
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i] as string] = raw[i] == null ? '' : String(raw[i]);
      return row;
    });
  }
}
