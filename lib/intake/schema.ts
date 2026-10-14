import { MEASURES, REASONS } from '../synthetic/generate';

/** F-301 part 1: declarative intake schema. Keys match the F-102 columns; forbidden fields are never listed here. */
export type FieldType = 'text' | 'integer' | 'money' | 'date' | 'boolean' | 'enum' | 'county_fips' | 'uuid' | 'uuid_ref';
export type Field = { key: string; label: string; type: FieldType; required?: boolean; values?: readonly string[]; min?: number };
export type EntitySpec = { table: string; fields: Field[]; dateOrder: [string, string][] };
export const INTAKE_ENTITIES = ['case', 'application', 'authorization', 'delivery', 'outcome'] as const;
export type IntakeEntity = (typeof INTAKE_ENTITIES)[number];

/** Allowed values. Lists not pinned by the PRD or schema are flagged "for George" in progress.md. */
export const ALLOWED = {
  referral_source: ['court', 'self', 'school', 'provider', 'other'],
  income_band: ['a', 'b', 'c', 'd'],
  decision: ['approved', 'denied', 'pending'],
  service_type: ['therapy', 'assessment', 'other'],
  discharge_status: ['completed', 'dropped'],
  non_start_reason: [...REASONS, 'other'],
  measure_code: MEASURES.map((m) => m.code),
} as const satisfies Record<string, readonly string[]>;

const f = (key: string, label: string, type: FieldType, extra: Partial<Field> = {}): Field => ({ key, label, type, ...extra });
const en = (key: keyof typeof ALLOWED, label: string, extra: Partial<Field> = {}) => f(key, label, 'enum', { values: ALLOWED[key], ...extra });
const id = f('id', 'Row ID (leave blank for new rows)', 'uuid');

export const INTAKE_SCHEMA: Record<IntakeEntity, EntitySpec> = {
  case: { table: 'case', dateOrder: [['court_order_date', 'referral_date']], fields: [
    id, en('referral_source', 'Referral source'), f('court_involved', 'Court involved', 'boolean', { required: true }),
    f('court_order_date', 'Court order date', 'date'), f('referral_date', 'Referral date', 'date', { required: true }),
    f('county_fips', 'County code (Utah FIPS)', 'county_fips', { required: true }),
    f('household_size', 'Household size', 'integer', { min: 1 }), en('income_band', 'Income band'),
    f('prior_services', 'Prior services tried', 'text'),
  ] },
  application: { table: 'application', dateOrder: [['application_date', 'decision_date']], fields: [
    id, f('case_id', 'Case ID', 'uuid_ref', { required: true }), f('application_date', 'Application date', 'date', { required: true }),
    f('decision_date', 'Decision date', 'date'), en('decision', 'Decision'),
    f('award_amount', 'Award amount', 'money'), f('family_contribution', 'Family contribution', 'money'),
  ] },
  authorization: { table: 'authorization', dateOrder: [], fields: [
    id, f('application_id', 'Application ID', 'uuid_ref', { required: true }), en('service_type', 'Service type', { required: true }),
    f('provider_id', 'Provider ID', 'uuid_ref'), f('units', 'Units authorized', 'integer', { min: 0 }),
    f('rate', 'Rate per unit', 'money'), f('total_authorized', 'Total authorized', 'money'),
  ] },
  delivery: { table: 'delivery_episode', dateOrder: [['first_session_date', 'last_session_date']], fields: [
    id, f('authorization_id', 'Authorization ID', 'uuid_ref', { required: true }),
    f('first_session_date', 'First session date', 'date'), f('last_session_date', 'Last session date', 'date'),
    f('sessions_attended', 'Sessions attended', 'integer', { min: 0 }), f('no_shows', 'No-shows', 'integer', { min: 0 }),
    en('discharge_status', 'Discharge status'), en('non_start_reason', 'Non-start reason'), f('dollars_paid', 'Dollars paid', 'money'),
  ] },
  outcome: { table: 'outcome_measure', dateOrder: [['baseline_date', 'followup_date']], fields: [
    id, f('case_id', 'Case ID', 'uuid_ref', { required: true }), en('measure_code', 'Measure', { required: true }),
    f('baseline_score', 'Baseline score', 'integer', { min: 0, required: true }), f('baseline_date', 'Baseline date', 'date', { required: true }),
    f('followup_score', 'Follow-up score', 'integer', { min: 0 }), f('followup_date', 'Follow-up date', 'date'),
  ] },
};

/** Template header row = column keys, so a downloaded template maps 1:1 without the mapping screen. */
export const TEMPLATE_HEADERS: Record<IntakeEntity, string[]> = Object.fromEntries(
  INTAKE_ENTITIES.map((e) => [e, INTAKE_SCHEMA[e].fields.map((x) => x.key)]),
) as Record<IntakeEntity, string[]>;

export const isIntakeEntity = (s: string): s is IntakeEntity => (INTAKE_ENTITIES as readonly string[]).includes(s);
