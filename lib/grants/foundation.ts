// F-502: foundation opportunities entered by hand or imported from CSV. Pure; no I/O.
export type FoundationSource = 'foundation_manual' | 'foundation_csv';
export type Field = { key: string; label: string; type: 'text' | 'date' | 'money' | 'url' | 'list'; required?: boolean; max?: number; hint?: string };
export type RowError = { row: number; column: string; code: string; message: string }; export type FoundationInput = Record<string, string | undefined>;
export type ValidFoundation = { title: string; funder: string; posted_date: string | null; close_date: string | null; award_floor: number | null; award_ceiling: number | null;
  eligibility_notes: string | null; applicant_types: string[]; program_themes: string[]; url: string | null; description: string | null };
export type OpportunityRow = Omit<ValidFoundation, 'eligibility_notes' | 'applicant_types' | 'program_themes' | 'url'> & { source: FoundationSource; external_id: string; eligibility: Record<string, unknown>; raw: Record<string, unknown> };

/** Same columns as federal (`opportunity`) where they apply; list fields are semicolon-separated. */
export const FOUNDATION_FIELDS: readonly Field[] = [
  { key: 'title', label: 'Opportunity title', type: 'text', required: true, max: 200 }, { key: 'funder', label: 'Funder', type: 'text', required: true, max: 200 },
  { key: 'posted_date', label: 'Posted date', type: 'date', hint: '2026-01-31 or 1/31/2026' }, { key: 'close_date', label: 'Close date', type: 'date', hint: '2026-03-31 or 3/31/2026' },
  { key: 'award_floor', label: 'Award floor (USD)', type: 'money' }, { key: 'award_ceiling', label: 'Award ceiling (USD)', type: 'money' },
  { key: 'applicant_types', label: 'Applicant types', type: 'list', max: 500, hint: 'Separate with semicolons, e.g. 501(c)(3); Utah nonprofits' },
  { key: 'program_themes', label: 'Program themes', type: 'list', max: 500, hint: 'Separate with semicolons, e.g. mental health; family preservation' },
  { key: 'eligibility_notes', label: 'Eligibility notes', type: 'text', max: 2000 }, { key: 'url', label: 'Opportunity URL', type: 'url', max: 500, hint: 'Starts with http:// or https://' },
  { key: 'description', label: 'Description', type: 'text', max: 4000 },
];
export const FOUNDATION_KEYS = FOUNDATION_FIELDS.map((f) => f.key);
/** Stored pipeline stage for a freshly added opportunity (PRD §C6: new → reviewing → …; DS-07 shows it as `New`). */
export const PIPELINE_NEW_STATUS = 'new', MONEY = /^\$?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/, bad = (code: string, message: string) => ({ code, message });

/** From lib/intake/validate.ts (f301): ISO `YYYY-MM-DD` or `M/D/YYYY` → ISO; impossible dates rejected. */
export function parseDate(raw: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw), us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]].map(Number) : us ? [us[3], us[1], us[2]].map(Number) : [], dt = new Date(Date.UTC(y, m - 1, d));
  return y !== undefined && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
}

function coerce(f: Field, raw: string): { value: unknown } | { code: string; message: string } {
  if (f.max !== undefined && raw.length > f.max) return bad('length', `${f.label} must be ${f.max} characters or fewer (got ${raw.length})`);
  if (f.type === 'date') { const d = parseDate(raw); return d ? { value: d } : bad('type', `${f.label} must be a date like ${f.hint}, got "${raw}"`); }
  if (f.type === 'money') return MONEY.test(raw) ? { value: Number(raw.replace(/[$,]/g, '')) } : bad('type', `${f.label} must be a dollar amount like 25000 or $25,000.00, got "${raw}"`);
  if (f.type === 'url') return /^https?:\/\/\S+$/i.test(raw) ? { value: raw } : bad('type', `${f.label} must start with http:// or https://`);
  return { value: f.type === 'list' ? raw.split(';').map((s) => s.trim()).filter(Boolean) : raw };
}

/** One record (form or CSV row) → typed values or plain-English errors; `row` is the 1-based spreadsheet row (0 for the form). */
export function validateFoundation(input: FoundationInput, row = 0): { ok?: ValidFoundation; errors: RowError[] } {
  const errors: RowError[] = [], v: Record<string, unknown> = {}, err = (column: string, e: { code: string; message: string }) => errors.push({ row, column, ...e });
  for (const f of FOUNDATION_FIELDS) {
    const raw = (input[f.key] ?? '').trim(), c = raw === '' ? { value: f.type === 'list' ? [] : null } : coerce(f, raw);
    if (raw === '' && f.required) err(f.key, bad('required', `${f.label} is required`));
    else if ('code' in c) err(f.key, c); else v[f.key] = c.value;
  }
  if (typeof v.posted_date === 'string' && typeof v.close_date === 'string' && v.posted_date > v.close_date) err('close_date', bad('date_order', `Close date (${v.close_date}) is before posted date (${v.posted_date})`));
  if (typeof v.award_floor === 'number' && typeof v.award_ceiling === 'number' && v.award_floor > v.award_ceiling) err('award_ceiling', bad('money_order', `Award ceiling (${v.award_ceiling}) is below award floor (${v.award_floor})`));
  return errors.length ? { errors } : { ok: v as ValidFoundation, errors };
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'none';
/** `foundation:<slug(funder)>:<slug(title)>:<close_date|none>` so a later unique index on (source, external_id) holds. */ export const externalId = (v: Pick<ValidFoundation, 'funder' | 'title' | 'close_date'>) => `foundation:${slug(v.funder)}:${slug(v.title)}:${v.close_date ?? 'none'}`;

export function toOpportunityRow(v: ValidFoundation, source: FoundationSource, now = new Date()): OpportunityRow {
  const { title, funder, posted_date, close_date, award_floor, award_ceiling, description } = v, raw = { ...v, imported_at: now.toISOString().slice(0, 7) };
  return { source, external_id: externalId(v), title, funder, posted_date, close_date, award_floor, award_ceiling, description, raw, eligibility: { applicant_types: v.applicant_types, funding_categories: v.program_themes, description: v.eligibility_notes } };
}
