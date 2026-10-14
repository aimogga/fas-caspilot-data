// F-503: shared shapes for Phase 5 grant matching. Inputs are DB-shaped (`opportunity` and `org` tables, F-102),
// so the Grants.gov ingest (F-501) and this rules layer meet at the table, not at each other's code.
export type Unknown = 'unknown';
/** `opportunity.eligibility` jsonb: the Simpler.Grants.gov v1 `summary` fields that drive eligibility. */
export interface OpportunityEligibility {
  applicant_types?: string[] | null; // e.g. 'nonprofits_non_higher_education_with_501c3', 'state_governments'
  applicant_eligibility_description?: string | null;
  is_cost_sharing?: boolean | null;
  funding_categories?: string[] | null; // e.g. 'health', 'income_security_and_social_services'
}

/** One `opportunity` row. `raw` is the full Grants.gov v1 opportunity JSON when source = 'grants_gov'. */
export interface OpportunityInput {
  id?: string;
  source: 'grants_gov' | 'foundation_manual' | 'foundation_csv';
  title: string;
  funder?: string | null;
  assistance_listing?: string | null;
  posted_date?: string | null;
  close_date?: string | null; // ISO date (yyyy-mm-dd)
  award_floor?: number | null;
  award_ceiling?: number | null;
  eligibility: OpportunityEligibility;
  description?: string | null;
  raw?: { summary?: OpportunityEligibility & { summary_description?: string | null } } & Record<string, unknown>;
}
export type SamStatus = 'active' | 'expired' | Unknown;
/** FAS facts the hard checks need. Every field accepts 'unknown' so a missing fact becomes an info flag. */
export interface OrgProfile {
  name: string;
  is_501c3: boolean | Unknown;
  state: string | Unknown; // 'UT'
  sam_status: SamStatus; // SAM.gov registration / UEI
  service_counties: string[] | Unknown;
  annual_budget_usd: number | Unknown;
  populations_served: string[] | Unknown;
  program_themes: string[] | Unknown;
  has_audited_financials: boolean | Unknown;
  years_operating: number | Unknown;
}
export type FlagSeverity = 'blocker' | 'warning' | 'info';
/** message: plain English for staff, never color-only. source_ref: the field or criterion the flag came from. */
export interface Flag { code: string; severity: FlagSeverity; message: string; source_ref: string }
export type CheckStatus = 'pass' | 'flagged' | 'unclear';
/** checks: one entry per FLAG_CODES code, for F-504 "eligibility certainty". */
export interface EligibilityResult { eligible: boolean | Unknown; flags: Flag[]; checks: Record<string, CheckStatus> }
