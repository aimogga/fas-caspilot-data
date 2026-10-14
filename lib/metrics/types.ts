/** F-304 row types: the FAS tables in supabase/migrations/20261009090814_f102_part2.sql (dates as ISO strings). */
export type CaseRow = {
  id: string; referral_source: string | null; court_involved: boolean; court_order_date: string | null;
  referral_date: string | null; county_fips: string | null; income_band: string | null;
};
export type ApplicationRow = {
  id: string; case_id: string; application_date: string | null; decision_date: string | null; decision: string | null;
  award_amount: number | null; family_contribution: number | null;
};
export type AuthorizationRow = {
  id: string; application_id: string; provider_id: string | null; units: number | null; rate: number | null; total_authorized: number | null;
};
export type ProviderRow = { id: string; provider_affiliated: boolean };
export type EpisodeRow = {
  id: string; authorization_id: string; first_session_date: string | null; last_session_date: string | null;
  discharge_status: string | null; non_start_reason: string | null; dollars_paid: number | null;
};
/**
 * `county` matches case.county_fips; `referral` matches case.referral_source; `from`/`to` are inclusive ISO dates
 * applied to one anchor date per row kind: cases (M1) use `court_order_date ?? referral_date`, applications (M2, M3)
 * use `application_date`, episodes (M4, M5, M6) use `last_session_date ?? first_session_date`.
 * A row with no anchor date is excluded from a date-filtered result but included when no range is given.
 */
export type MetricFilters = { from?: string; to?: string; county?: string; referral?: string };
export type MetricInput = {
  cases: CaseRow[]; applications: ApplicationRow[]; authorizations: AuthorizationRow[]; providers: ProviderRow[]; episodes: EpisodeRow[];
};
