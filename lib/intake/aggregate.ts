import type { Field } from './schema';
import { coerce, type ValidateCtx } from './validate';

/** F-303: period totals for orgs that only have aggregates (PRD §C2). Rows land in `aggregate_submission` and are always shown with `Σ Aggregate`. */
export const AGGREGATE_ACTION = 'intake.aggregate', NOTE_MAX = 200;
/** Metric codes stored in `aggregate_submission.metric_code` (for George: counts map to PRD M3–M5 inputs; dollars to M5). */
export const AGGREGATE_METRICS = [
  { code: 'families_served', label: 'Families served', kind: 'count' },
  { code: 'episodes_completed', label: 'Episodes completed', kind: 'count' },
  { code: 'applications_approved', label: 'Applications approved', kind: 'count' },
  { code: 'dollars_paid', label: 'Dollars paid to providers', kind: 'money' },
] as const;
export type MetricCode = (typeof AGGREGATE_METRICS)[number]['code'];
export type AggregateInput = Record<'period' | 'metric' | 'value' | 'county_fips' | 'note', string>;
export type AggregateError = { column: keyof AggregateInput; code: string; message: string };
export type AggregateValid = { period: string; metric_code: MetricCode; value: number; n: number | null; county_fips: string | null; notes: string | null };
export type AggregateRecent = { id: string; period: string; metric_code: string; value: number | string | null; county_fips: string | null };

export const EMPTY_AGGREGATE: AggregateInput = { period: '', metric: '', value: '', county_fips: '', note: '' };
export const metricFor = (code: string) => AGGREGATE_METRICS.find((m) => m.code === code), metricLabel = (code: string) => metricFor(code)?.label ?? code;
const COUNT: Field = { key: 'value', label: 'Total', type: 'integer', min: 0 }, MONEY: Field = { ...COUNT, type: 'money' }, COUNTY: Field = { key: 'county_fips', label: 'County', type: 'county_fips' };
const QUARTER = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

/** `2026-Q2`, `2026 Q2` or `2026q2` → `2026-Q2`; years 2000–2099 and quarters 1–4 only. */
export function parsePeriod(raw: string): string | null {
  const m = /^(20\d{2})[\s-]?Q([1-4])$/i.exec(raw.trim());
  return m ? `${m[1]}-Q${m[2]}` : null;
}
/** DS-07 quarter label, e.g. `Apr–Jun 2026 (Q2)`; unknown shapes pass through. */
export function periodLabel(period: string): string {
  const p = parsePeriod(period);
  return p ? `${QUARTER[Number(p[6]) - 1]} ${p.slice(0, 4)} (Q${p[6]})` : period;
}
export const formatValue = (code: string, v: number | string | null): string =>
  v == null ? '—' : metricFor(code)?.kind === 'money' ? Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : Number(v).toLocaleString('en-US');

/** One error per field, in plain English. Reuses the upload coercions so totals and row-level data agree. */
export function validateAggregate(input: Partial<AggregateInput>, ctx: ValidateCtx): { ok: AggregateValid } | { errors: AggregateError[] } {
  const get = (k: keyof AggregateInput) => (input[k] ?? '').trim();
  const errors: AggregateError[] = [];
  const err = (column: keyof AggregateInput, code: string, message: string) => errors.push({ column, code, message });
  const period = parsePeriod(get('period'));
  if (get('period') === '') err('period', 'required', 'Period is required');
  else if (!period) err('period', 'type', `Period must be a quarter like 2026-Q2, got "${get('period')}"`);
  const metric = metricFor(get('metric'));
  if (get('metric') === '') err('metric', 'required', 'Metric is required');
  else if (!metric) err('metric', 'enum', `Metric "${get('metric')}" is not allowed. Use one of: ${AGGREGATE_METRICS.map((m) => m.code).join(', ')}`);
  let value: number | null = null;
  if (get('value') === '') err('value', 'required', 'Total is required');
  else {
    const c = coerce(metric?.kind === 'money' ? MONEY : COUNT, get('value'), ctx);
    if ('code' in c) err('value', c.code, c.message); else value = Number(c.value);
  }
  let county: string | null = null;
  if (get('county_fips') !== '') {
    const c = coerce(COUNTY, get('county_fips'), ctx);
    if ('code' in c) err('county_fips', c.code, c.message); else county = String(c.value);
  }
  const note = get('note').replace(/\s+/g, ' '); // plain text only; no client data belongs here (label says so)
  if (note.length > NOTE_MAX) err('note', 'max', `Note must be ${NOTE_MAX} characters or fewer, got ${note.length}`);
  if (errors.length || !period || !metric || value === null) return { errors };
  return { ok: { period, metric_code: metric.code, value, n: metric.kind === 'count' ? value : null, county_fips: county, notes: note || null } };
}

/** Insert row: `org_id` and `created_by` pinned to the caller (the INSERT policy rejects any other `created_by`). */
export const rowForInsert = (valid: AggregateValid, orgId: string, userId: string): Record<string, unknown> => ({ ...valid, org_id: orgId, created_by: userId });
/** `audit_log` row; `actor` must equal `auth.uid()`. */
export const auditRow = (id: string, orgId: string, userId: string, metric: string): Record<string, unknown> =>
  ({ org_id: orgId, actor: userId, action: AGGREGATE_ACTION, entity: 'aggregate_submission', entity_id: id, details: { metric_code: metric } });
