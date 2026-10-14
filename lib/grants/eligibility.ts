// F-503: hard eligibility filters from docs/GRANT_MATCHING.md. Pure functions; flags, never silent drops.
import type { CheckStatus, EligibilityResult, Flag, FlagSeverity, OpportunityInput, OrgProfile } from './types';

export const FLAG_CODES = [
  'applicant_type', 'geography', 'close_date', 'sam_registration', 'audit_required',
  'cost_share', 'min_years_operating', 'award_size', 'theme_overlap', 'loi_required',
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

/** Thresholds the doc leaves open (for George). CLOSE_WARN_DAYS is the doc's 21, configurable. */
export const ELIGIBILITY_DEFAULTS = {
  closeWarnDays: 21, // warn when the close date is nearer than this
  maxFloorShareOfBudget: 0.5, // award floor above 50% of annual budget = too large
  minWorthUsd: 10_000, // ceiling below this = too small to be worth applying for
};
export type EligibilityOptions = typeof ELIGIBILITY_DEFAULTS;

const NONPROFIT_TYPES = new Set(['nonprofits_non_higher_education_with_501c3', 'unrestricted']);
const SEVERITY_RANK: Record<FlagSeverity, number> = { blocker: 0, warning: 1, info: 2 };
const STATES = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|'
  + 'New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';
const RESTRICTED_TO = new RegExp(`(?:located|headquartered|based|operating|serving|residents?|within|only)\\s+(?:in|of)\\s+(?:the\\s+state\\s+of\\s+)?(${STATES})\\b`, 'i');

const flag = (code: FlagCode, severity: FlagSeverity, message: string, source_ref: string): Flag => ({ code, severity, message, source_ref });
const unclear = (code: FlagCode, what: string, field: string): Flag => flag(code, 'info', `Could not check ${what}: ${field} missing`, field);
const humanize = (s: string) => s.replace(/_/g, ' ');
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

/** Every text the opportunity gives us, for keyword checks. Empty string when nothing is stored. */
export function opportunityText(o: OpportunityInput): string {
  const s = o.raw?.summary;
  return [o.description, o.eligibility.applicant_eligibility_description, s?.summary_description, s?.applicant_eligibility_description]
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0).join('\n');
}

export function checkApplicantType(o: OpportunityInput, org: OrgProfile): Flag | null {
  const types = o.eligibility.applicant_types ?? o.raw?.summary?.applicant_types;
  if (!types?.length) return unclear('applicant_type', 'applicant type', 'opportunity.eligibility.applicant_types');
  if (org.is_501c3 === 'unknown') return unclear('applicant_type', 'applicant type', 'org.is_501c3');
  if (org.is_501c3 && types.some((t) => NONPROFIT_TYPES.has(t))) return null;
  return flag('applicant_type', 'blocker', `Only ${types.map(humanize).join(', ')} may apply`, 'opportunity.eligibility.applicant_types');
}

export function checkGeography(o: OpportunityInput, org: OrgProfile): Flag | null {
  const text = opportunityText(o);
  if (!text) return unclear('geography', 'geography', 'opportunity.description');
  if (org.state === 'unknown') return unclear('geography', 'geography', 'org.state');
  if (/\butah\b/i.test(text)) return null;
  const m = RESTRICTED_TO.exec(text);
  return m ? flag('geography', 'blocker', `Only applicants in ${m[1]} may apply`, 'opportunity.description') : null;
}

export function checkCloseDate(o: OpportunityInput, now: Date, opts = ELIGIBILITY_DEFAULTS): Flag | null {
  if (!o.close_date) return unclear('close_date', 'close date', 'opportunity.close_date');
  const days = Math.ceil((Date.parse(o.close_date) - now.getTime()) / 86_400_000);
  if (Number.isNaN(days)) return unclear('close_date', 'close date', 'opportunity.close_date');
  if (days < 0) return flag('close_date', 'blocker', `Closed on ${o.close_date}`, 'opportunity.close_date');
  if (days < opts.closeWarnDays) return flag('close_date', 'warning', days === 0 ? 'Closes today' : `Closes in ${days} days`, 'opportunity.close_date');
  return null;
}

export function checkSamRegistration(o: OpportunityInput, org: OrgProfile): Flag | null {
  const required = o.source === 'grants_gov' || /\b(SAM\.gov|UEI|System for Award Management)\b/i.test(opportunityText(o));
  if (!required) return null;
  if (org.sam_status === 'unknown') return unclear('sam_registration', 'SAM.gov registration', 'org.sam_status');
  if (org.sam_status === 'expired') return flag('sam_registration', 'warning', 'SAM.gov registration expired; renew before applying', 'org.sam_status');
  return null;
}

export function checkAuditRequired(o: OpportunityInput, org: OrgProfile): Flag | null {
  if (!/\b(single audit|audited financial|audit(?:ed)? statements?)\b/i.test(opportunityText(o))) return null;
  if (org.has_audited_financials === 'unknown') return unclear('audit_required', 'audit requirement', 'org.has_audited_financials');
  return org.has_audited_financials ? null : flag('audit_required', 'blocker', 'Requires audited financial statements', 'opportunity.description');
}

export function checkCostShare(o: OpportunityInput): Flag | null {
  const text = opportunityText(o);
  const shared = o.eligibility.is_cost_sharing ?? o.raw?.summary?.is_cost_sharing;
  const mention = /\b(cost[- ]shar\w*|matching funds|match requirement|non-federal match)\b/i.test(text);
  if (shared == null && !mention) return unclear('cost_share', 'cost share', 'opportunity.eligibility.is_cost_sharing');
  if (shared === false && !mention) return null;
  const pct = /(\d{1,3})\s?%/.exec(text)?.[1];
  return flag('cost_share', 'warning', pct ? `Requires cost share or match of ${pct}%` : 'Requires cost share or match', 'opportunity.eligibility.is_cost_sharing');
}

export function checkMinYearsOperating(o: OpportunityInput, org: OrgProfile): Flag | null {
  const m = /(\d{1,2})\s+years?\s+(?:of\s+)?(?:operating|operation|in existence|history)/i.exec(opportunityText(o));
  if (!m) return null;
  if (org.years_operating === 'unknown') return unclear('min_years_operating', 'minimum years operating', 'org.years_operating');
  const need = Number(m[1]);
  return org.years_operating >= need ? null : flag('min_years_operating', 'blocker', `Requires ${need} years operating; FAS has ${org.years_operating}`, 'opportunity.description');
}

export function checkAwardSize(o: OpportunityInput, org: OrgProfile, opts = ELIGIBILITY_DEFAULTS): Flag | null {
  const { award_floor: floor, award_ceiling: ceiling } = o;
  if (floor == null && ceiling == null) return unclear('award_size', 'award size', 'opportunity.award_floor');
  if (org.annual_budget_usd === 'unknown') return unclear('award_size', 'award size', 'org.annual_budget_usd');
  const cap = org.annual_budget_usd * opts.maxFloorShareOfBudget;
  if (floor != null && floor > cap) return flag('award_size', 'warning', `Award floor ${usd(floor)} is above ${usd(cap)} (${opts.maxFloorShareOfBudget * 100}% of annual budget)`, 'opportunity.award_floor');
  if (ceiling != null && ceiling < opts.minWorthUsd) return flag('award_size', 'info', `Award ceiling ${usd(ceiling)} is below the ${usd(opts.minWorthUsd)} minimum worth applying for`, 'opportunity.award_ceiling');
  return null;
}

export function checkThemeOverlap(o: OpportunityInput, org: OrgProfile): Flag | null {
  const cats = o.eligibility.funding_categories ?? o.raw?.summary?.funding_categories ?? [];
  const text = opportunityText(o);
  if (!cats.length && !text) return unclear('theme_overlap', 'program themes', 'opportunity.eligibility.funding_categories');
  if (org.program_themes === 'unknown') return unclear('theme_overlap', 'program themes', 'org.program_themes');
  const hay = `${cats.map(humanize).join(' ')} ${text}`.toLowerCase();
  const hit = org.program_themes.filter((t) => hay.includes(t.toLowerCase()));
  if (hit.length) return null;
  return flag('theme_overlap', 'warning', `No program theme overlap (opportunity: ${cats.map(humanize).join(', ') || 'unlisted'})`, 'opportunity.eligibility.funding_categories');
}

export function checkLoiRequired(o: OpportunityInput): Flag | null {
  const hit = /\b(letter of intent|LOI|pre-?application|notice of intent)\b/i.test(opportunityText(o));
  return hit ? flag('loi_required', 'warning', 'Letter of intent or pre-application required before the full proposal', 'opportunity.description') : null;
}

export function sortFlags(flags: Flag[]): Flag[] {
  return [...flags].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.code.localeCompare(b.code));
}

export function checkEligibility(o: OpportunityInput, org: OrgProfile, now: Date, opts: EligibilityOptions = ELIGIBILITY_DEFAULTS): EligibilityResult {
  const raw: Record<FlagCode, Flag | null> = {
    applicant_type: checkApplicantType(o, org), geography: checkGeography(o, org), close_date: checkCloseDate(o, now, opts),
    sam_registration: checkSamRegistration(o, org), audit_required: checkAuditRequired(o, org), cost_share: checkCostShare(o),
    min_years_operating: checkMinYearsOperating(o, org), award_size: checkAwardSize(o, org, opts),
    theme_overlap: checkThemeOverlap(o, org), loi_required: checkLoiRequired(o),
  };
  const checks = {} as Record<FlagCode, CheckStatus>;
  for (const code of FLAG_CODES) {
    const f = raw[code];
    checks[code] = !f ? 'pass' : f.message.startsWith('Could not check') ? 'unclear' : 'flagged';
  }
  const flags = sortFlags(Object.values(raw).filter((f): f is Flag => f !== null));
  const eligible = flags.some((f) => f.severity === 'blocker') ? false : Object.values(checks).includes('unclear') ? 'unknown' : true;
  return { eligible, flags, checks };
}

/** `match_result.flags` jsonb shape: `{ eligible, flags }` (checks are derivable and not stored). */
export function toMatchFlags(result: EligibilityResult): { eligible: boolean | 'unknown'; flags: Flag[] } {
  return { eligible: result.eligible, flags: sortFlags(result.flags) };
}

export function fromMatchFlags(json: unknown): { eligible: boolean | 'unknown'; flags: Flag[] } {
  const obj = json as { eligible?: unknown; flags?: unknown } | null;
  const okEligible = obj?.eligible === true || obj?.eligible === false || obj?.eligible === 'unknown';
  if (!obj || !okEligible || !Array.isArray(obj.flags)) throw new Error('match_result.flags: expected { eligible, flags[] }');
  const flags = obj.flags.map((f: Partial<Flag>, i): Flag => {
    const ok = (FLAG_CODES as readonly string[]).includes(f?.code ?? '') && (f?.severity ?? '') in SEVERITY_RANK;
    if (!ok || typeof f.message !== 'string' || typeof f.source_ref !== 'string') throw new Error(`match_result.flags[${i}]: invalid flag`);
    return { code: f.code as string, severity: f.severity as FlagSeverity, message: f.message, source_ref: f.source_ref };
  });
  return { eligible: obj.eligible as boolean | 'unknown', flags: sortFlags(flags) };
}
