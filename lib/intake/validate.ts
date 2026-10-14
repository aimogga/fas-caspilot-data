import { INTAKE_SCHEMA, type Field, type IntakeEntity } from './schema';

export type Cell = string | number | boolean | null;
export type ValidRow = { row: number; values: Record<string, Cell> };
export type RowError = { row: number; column: string; code: string; message: string };
export type ValidateCtx = { countyFips: Set<string>; knownIds?: Set<string> | Record<string, Set<string>> };
type Coerced = { value: Cell } | { code: string; message: string };

const MONEY = /^\$?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRUE = ['true', 'yes', 'y', '1'], FALSE = ['false', 'no', 'n', '0'];
const bad = (code: string, message: string): Coerced => ({ code, message });

/** ISO `YYYY-MM-DD` or `M/D/YYYY` → ISO. Two-digit years and impossible dates are rejected. */
export function parseDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw), us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]].map(Number) : us ? [us[3], us[1], us[2]].map(Number) : [];
  if (y === undefined) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** One trimmed, non-empty cell → typed value or a plain-English error. Anything ambiguous fails. */
export function coerce(field: Field, raw: string, ctx: ValidateCtx): Coerced {
  const q = `"${raw}"`;
  switch (field.type) {
    case 'text': return { value: raw };
    case 'integer': {
      if (!/^-?\d+$/.test(raw)) return bad('type', `${field.label} must be a whole number, got ${q}`);
      const n = Number(raw);
      if (field.min !== undefined && n < field.min) return bad('min', `${field.label} must be at least ${field.min}, got ${n}`);
      return { value: n };
    }
    case 'money': {
      if (!MONEY.test(raw)) return bad('type', `${field.label} must be a dollar amount like 1840.00, got ${q}`);
      return { value: Number(raw.replace(/[$,]/g, '')) };
    }
    case 'date': {
      const d = parseDate(raw);
      return d ? { value: d } : bad('type', `${field.label} must be a date like 2024-03-31 or 3/31/2024, got ${q}`);
    }
    case 'boolean': {
      const s = raw.toLowerCase();
      if (TRUE.includes(s)) return { value: true };
      if (FALSE.includes(s)) return { value: false };
      return bad('type', `${field.label} must be yes or no, got ${q}`);
    }
    case 'enum': {
      const hit = field.values?.find((v) => v === raw || v.toLowerCase() === raw.toLowerCase());
      return hit !== undefined ? { value: hit } : bad('enum', `${field.label} ${q} is not allowed. Use one of: ${field.values?.join(', ')}`);
    }
    case 'county_fips': {
      const code = /^\d{3}$/.test(raw) ? `49${raw}` : raw;
      return ctx.countyFips.has(code) ? { value: code } : bad('county', `County code ${raw} is not a Utah county`);
    }
    case 'uuid':
    case 'uuid_ref': {
      if (!UUID.test(raw)) return bad('type', `${field.label} must be a UUID, got ${q}`);
      const v = raw.toLowerCase(), known = ctx.knownIds instanceof Set ? ctx.knownIds : ctx.knownIds?.[field.key];
      if (field.type === 'uuid_ref' && known && !known.has(v)) return bad('reference', `${field.label} ${v} does not match any existing record`);
      return { value: v };
    }
  }
}

/** Rows are header-keyed records; row numbers are 1-based spreadsheet rows (header is row 1). One error per failing cell. */
export function validateRows(entity: IntakeEntity, rows: Record<string, string>[], ctx: ValidateCtx): { ok: ValidRow[]; errors: RowError[] } {
  const spec = INTAKE_SCHEMA[entity];
  const label = (k: string) => spec.fields.find((x) => x.key === k)?.label ?? k;
  const ok: ValidRow[] = [], errors: RowError[] = [];
  rows.forEach((rec, i) => {
    const row = i + 2, values: Record<string, Cell> = {}, errs: RowError[] = [];
    for (const field of spec.fields) {
      const raw = (rec[field.key] ?? '').trim();
      if (raw === '') {
        values[field.key] = null;
        if (field.required) errs.push({ row, column: field.key, code: 'required', message: `${field.label} is required` });
        continue;
      }
      const c = coerce(field, raw, ctx);
      if ('code' in c) errs.push({ row, column: field.key, ...c });
      else values[field.key] = c.value;
    }
    for (const [a, b] of spec.dateOrder) {
      const va = values[a], vb = values[b];
      if (typeof va === 'string' && typeof vb === 'string' && va > vb) {
        errs.push({ row, column: b, code: 'date_order', message: `${label(b)} (${vb}) is before ${label(a)} (${va})` });
      }
    }
    if (errs.length) errors.push(...errs);
    else ok.push({ row, values });
  });
  return { ok, errors };
}
