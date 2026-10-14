import { INTAKE_SCHEMA, type Field, type FieldType, type IntakeEntity } from './schema';
import type { Cell } from './validate';

/** F-302: pure helpers behind the manual entry form. Validation itself is `validateRows`, shared with uploads. */
export type Control = 'hidden' | 'text' | 'number' | 'date' | 'yesno' | 'select' | 'county' | 'ref';
export const ENTRY_ACTION = 'intake.entry';
/** Parent table behind each `uuid_ref` field; the server checks the id exists in the caller's org. */
export const PARENT_TABLE: Record<string, string> = { case_id: 'case', application_id: 'application', authorization_id: 'authorization', provider_id: 'provider' };
/** Row IDs are never typed by hand, so `uuid` is hidden. */
const CONTROL: Record<FieldType, Control> = { uuid: 'hidden', text: 'text', integer: 'number', money: 'number', date: 'date', boolean: 'yesno', enum: 'select', county_fips: 'county', uuid_ref: 'ref' };
const HINT: Partial<Record<FieldType, string>> = { date: 'Like 2024-03-31', money: 'Dollars, like 1840.00', integer: 'A whole number', uuid_ref: 'Paste the parent record id' };

/** Every field key set to '' so controlled inputs start empty (the `id` column stays blank for new rows). */
export const emptyRow = (entity: IntakeEntity): Record<string, string> => Object.fromEntries(INTAKE_SCHEMA[entity].fields.map((f) => [f.key, '']));
export const controlFor = (field: Field): Control => CONTROL[field.type];
export const hintFor = (field: Field): string | null => HINT[field.type] ?? null;

/** Validated values → insert row: blanks dropped so DB defaults apply, `org_id` pinned to the caller's org. No `entered_by` column exists (F-102). */
export function rowForInsert(entity: IntakeEntity, valid: Record<string, Cell>, orgId: string): Record<string, unknown> {
  const out: Record<string, unknown> = { org_id: orgId };
  for (const [k, v] of Object.entries(valid)) {
    if (v === null || k === 'id') continue;
    out[k] = entity === 'case' && k === 'prior_services' ? String(v).split(';').map((s) => s.trim()).filter(Boolean) : v;
  }
  return out;
}

/** `audit_log` row for one saved record; `actor` must equal `auth.uid()` for the insert policy. */
export function auditRow(entity: IntakeEntity, id: string, orgId: string, userId: string): Record<string, unknown> {
  return { org_id: orgId, actor: userId, action: ENTRY_ACTION, entity, entity_id: id, details: { table: INTAKE_SCHEMA[entity].table } };
}
