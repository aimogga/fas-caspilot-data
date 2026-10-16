/** Plain words for manual entry (DS-18b, D-040): one helper sentence per field (what to enter, why, what it feeds), the data attributes one `ExplainLayer`
 * reads off a recent aggregate total, and the Σ badge hint. Pure; only rules `validate.ts` enforces and only metrics the glossary names are mentioned. */
import { GLOSSARY } from '../trust/glossary';
import { formatValue, metricLabel, NOTE_MAX, periodLabel, type AggregateInput, type AggregateRecent } from './aggregate';
import { PARENT_TABLE } from './entry';
import type { Field, FieldType } from './schema';

export type CellData = { 'data-term': string; 'data-value'?: string; 'data-source'?: string; 'data-asof'?: string; 'data-hidden'?: string };
const DAY = 'as year-month-day, like 2024-03-31', DOLLARS = 'in dollars, like 1840.00', WHOLE = 'as a whole number of 0 or more';

/** One or two sentences per field key; keys shared across entities (`case_id`) mean the same thing everywhere. */
export const FIELD_HELP: Record<string, string> = {
  referral_source: 'Who sent the family to FAS, such as a court or a school. Pick the closest match; the team dashboard can filter by it.',
  court_involved: 'Yes if a court ordered or referred the therapy. Required; it tells us which families to count in the wait from a court order.',
  court_order_date: `The date on the court order, ${DAY}. It must be on or before the referral date; the wait to a first session is counted from here.`,
  referral_date: `The day FAS first heard about this family, ${DAY}. Required.`,
  county_fips: 'The Utah county the family lives in. Required; shared views only ever show counts by county, never an address.',
  household_size: 'How many people live in the household, as a whole number of 1 or more.',
  income_band: 'The household income band, A to D, from the application. The completion rate is grouped by it.',
  prior_services: 'Services the family tried before FAS, separated by semicolons, like "school counselor; IOP". Plain words, no names.',
  application_date: `The day the family applied, ${DAY}. Required; the time to a funding decision is counted from here.`,
  decision_date: `The day FAS decided, ${DAY}. It must be on or after the application date.`,
  decision: 'Whether FAS approved, denied or is still deciding. Leave blank until a decision is made.',
  award_amount: `What FAS approved, ${DOLLARS}. No sign.`,
  family_contribution: `What the family pays themselves, ${DOLLARS}.`,
  service_type: 'What was authorized: therapy, an assessment or something else. Required.',
  units: `How many sessions or hours were authorized, ${WHOLE}.`,
  rate: `What one unit costs, ${DOLLARS}.`,
  total_authorized: `The whole amount authorized, ${DOLLARS}.`,
  first_session_date: `The family's first therapy session, ${DAY}. The wait to a first session ends here.`,
  last_session_date: `The most recent session, ${DAY}. It must be on or after the first session.`,
  sessions_attended: `Sessions the family attended, ${WHOLE}.`,
  no_shows: `Sessions missed without notice, ${WHOLE}.`,
  discharge_status: 'Completed if the planned course was finished, dropped if it ended early. The completion rate counts completed episodes.',
  non_start_reason: 'Why approved therapy never started, if it did not. Pick the closest reason.',
  dollars_paid: `What FAS paid providers for this episode, ${DOLLARS}. The cost per completed episode is built from it.`,
  measure_code: 'Which survey the family took. Required so scores from different surveys are never mixed.',
  baseline_score: `The score at the start of therapy, ${WHOLE}. Required.`,
  baseline_date: `The day the first survey was taken, ${DAY}. Required.`,
  followup_score: `The score at the end of therapy, ${WHOLE}. Leave blank until the follow-up survey is in.`,
  followup_date: `The day the follow-up survey was taken, ${DAY}. It must be on or after the baseline date.`,
};
const TYPE_HELP: Partial<Record<FieldType, string>> = {
  date: `A date ${DAY}.`, money: `An amount ${DOLLARS}.`, integer: 'A whole number.', boolean: 'Yes or no.', enum: 'Pick one of the listed values.',
  county_fips: 'A Utah county.', text: 'Plain words, no names.',
};
/** The parent record's words for a `uuid_ref` field: where the id comes from and the rule the server checks. */
const refHelp = (key: string) => {
  const parent = PARENT_TABLE[key] ?? 'record';
  return `Paste the id of the saved ${parent} this belongs to. It appears after you save a ${parent}, with a Copy id button, and must be in your organization.`;
};

/** The helper sentence under a field: its own words first, the parent words for ids, then the words for its type. Null only for hidden fields. */
export function fieldHelp(field: Field): string | null {
  if (field.type === 'uuid') return null;
  return FIELD_HELP[field.key] ?? (field.type === 'uuid_ref' ? refHelp(field.key) : TYPE_HELP[field.type] ?? null);
}

/** DS-23: the aggregate form's helper sentences, one per field, naming only the rules `validateAggregate` checks. */
export const AGGREGATE_HELP: Record<keyof AggregateInput, string> = {
  period: 'The quarter the total covers, like 2026-Q2. Required; Q1 is January to March and Q4 is October to December.',
  metric: 'What the total counts, such as families served or dollars paid to providers. Required.',
  value: `The total for the quarter, ${WHOLE}; for dollars paid, ${DOLLARS}. Required.`,
  county_fips: 'The Utah county the total covers. Leave as All counties for a total across the whole organization.',
  note: `Anything a reader needs to know about this total, up to ${NOTE_MAX} characters. Plain words, no names or client details.`,
};

/** Σ badge hint: the glossary sentence, so the badge, the notice and the card say the same thing. */
export const AGGREGATE_BADGE_HINT = GLOSSARY.aggregate.plain;
export const AGGREGATE_SOURCE = 'FAS aggregate total, entered by staff';

type County = { fips: string; name: string };
/** The county's name, the code when the list lacks it, `All counties` for an org-wide total. */
export const countyWords = (fips: string | null, counties: County[]): string => (fips ? counties.find((c) => c.fips === fips)?.name ?? fips : 'All counties');

/** The attributes for one recent aggregate total: the value in words, the source, no as-of (the table stores a quarter, not a date). */
export function aggregateCell(r: Pick<AggregateRecent, 'period' | 'metric_code' | 'value' | 'county_fips'>, counties: County[]): CellData {
  const value = `${formatValue(r.metric_code, r.value)} ${metricLabel(r.metric_code).toLowerCase()}, ${periodLabel(r.period)}, ${countyWords(r.county_fips, counties)}`;
  return { 'data-term': 'aggregate', 'data-value': value, 'data-source': AGGREGATE_SOURCE };
}
