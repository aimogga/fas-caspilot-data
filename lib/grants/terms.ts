// DS-12a: the grant-matching words in plain language (D-040). Domain terms live here so page packets never edit `lib/trust/glossary.ts`.
import { STAGES } from "@/lib/dashboard/query";
import type { Term } from "@/lib/trust/glossary";
import { FLAG_CODES, type FlagCode } from "./eligibility";
import type { CheckStatus, Flag, FlagSeverity } from "./types";

const t = (id: string, title: string, plain: string): Term => ({ id, title, plain });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** The 0–100 fit score on every row. Source words name both inputs: the opportunity text and the FAS settings an admin entered. */
export const FIT_SCORE = t("fit_score", "Fit score",
  "How well this grant fits FAS, from 0 to 100, added up from six parts: mission, eligibility, evidence, award size, geography and time to apply. Higher is better.");
export const FIT_SOURCE = "Grants.gov and FAS settings";

/** One term per `lib/grants/score.ts` component key, in the weight order of the v0 rules (30 / 20 / 15 / 15 / 10 / 10). */
export const COMPONENT: Record<string, Term> = {
  mission_fit: t("mission_fit", "Mission fit", "How many of the programme themes FAS listed appear in the grant's own text. Full marks once three themes match."),
  eligibility_certainty: t("eligibility_certainty", "Eligibility certainty", "The share of the ten eligibility checks that passed. A check that could not run counts against certainty, not against FAS."),
  evidence_readiness: t("evidence_readiness", "Evidence readiness", "Whether FAS already holds the outcome, cost or wait-time evidence the grant asks for. Full marks when it asks for none."),
  award_size_fit: t("award_size_fit", "Award size fit", "Whether the award range suits FAS's annual budget: not so large it needs more than FAS can manage, not so small it is not worth the work."),
  geography: t("geography", "Geography", "Whether the grant names Utah, a region that includes Utah, or the whole country. Naming Utah scores highest."),
  effort_vs_time: t("effort_vs_time", "Effort vs time", "The days left to the close date against the days a proposal usually takes to prepare. Full marks when there is enough time."),
};

/** The two ways a score is forced to 0; the stored reason says which rule did it. */
export const CAP: Record<string, Term> = {
  blocker_cap: t("blocker_cap", "Capped at 0 by a blocker", "A rule FAS cannot meet as things stand, such as who may apply, forces the score to 0 whatever the other parts say."),
  floor_cap: t("floor_cap", "Capped at 0 by a floor", "One part the matching rules treat as essential scored 0, so the whole score is 0."),
};

/** F-504d: the decision word beside every fit score. Edges come from the approved matching rules; the defaults are named so the word never needs a lookup. */
export const BAND: Record<"strong" | "look" | "pass", Term> = {
  strong: t("band_strong", "Strong fit", "The score is at or above the strong-fit line in the matching rules (75 unless an admin changed it). Worth starting a proposal."),
  look: t("band_look", "Worth a look", "The score clears the weekly digest line (60 unless an admin changed it) but not the strong-fit line. Read the six parts before deciding."),
  pass: t("band_pass", "Pass", "The score is under the weekly digest line, or a blocker or floor capped it at 0. Not worth the work as things stand."),
};

/** Flag severities as words for the badge hint; the badge itself shows the stored message. */
export const SEVERITY: Record<FlagSeverity, Term> = {
  blocker: t("blocker", "Blocker", "Something in the rules stops FAS applying as things stand, so the fit score is capped at 0."),
  warning: t("warning", "Worth checking", "Worth checking before you apply; it lowers the score but does not block it."),
  info: t("info", "Could not check", "A fact we needed is missing, so this check could not run. It neither raises nor lowers the score."),
};

/** The eligibility badge on a row: one of four words with a glyph, never colour alone. */
export const ELIGIBILITY: Record<"Eligible" | "Not eligible" | "Could not check" | "Flagged", Term> = {
  Eligible: t("eligible", "Eligible", "Every eligibility check we can run passed."),
  "Not eligible": t("not_eligible", "Not eligible", "At least one rule blocks FAS from applying as things stand; the score is capped at 0."),
  "Could not check": t("eligibility_unclear", "Could not check", "A fact we needed is missing, so eligibility is unclear. The panel names the missing fact."),
  Flagged: t("flagged", "Flagged", "FAS can apply, but something is worth checking first. The badges beside this say what."),
};

const STAGE_PLAIN: Record<(typeof STAGES)[number], string> = {
  New: "Scored but nobody at FAS has looked at it yet.", Reviewing: "Someone at FAS is reading it to decide whether to pursue it.",
  Pursuing: "FAS has decided to apply and is preparing the proposal.", Submitted: "The proposal has been sent to the funder.",
  Awarded: "The funder said yes.", Declined: "The funder said no.", Passed: "FAS decided not to apply.",
};
export const NOT_TRACKED = t("not_tracked", "Not tracked yet", "Nobody at FAS has picked this up. A stage appears once it is moved into the grant pipeline.");

/** The stored `pipeline_status.status` (any case) as a stage term; null means no row; an unknown word is shown as stored with a generic sentence. */
export function stageTerm(status: string | null): Term {
  if (status === null || status.trim() === "") return NOT_TRACKED;
  const stage = STAGES.find((s) => s.toLowerCase() === status.trim().toLowerCase());
  return stage ? t(`stage_${stage.toLowerCase()}`, stage, STAGE_PLAIN[stage]) : t("stage_other", cap(status.trim()), "A stage FAS entered by hand. The grant pipeline shows who owns it.");
}

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Award floor and ceiling as words; both come from stored `opportunity` columns and a missing pair reads as such, never as 0. A 0 floor is no floor (DS-12b). */
export function awardRange(floor: number | null, ceiling: number | null): string {
  if (floor === 0) floor = null;
  if (floor !== null && ceiling !== null) return `${usd(floor)}–${usd(ceiling)}`;
  return ceiling !== null ? `up to ${usd(ceiling)}` : floor !== null ? `from ${usd(floor)}` : "award not stated";
}

export const GRANT_TERMS: Term[] = [FIT_SCORE, ...Object.values(COMPONENT), ...Object.values(CAP), ...Object.values(BAND), ...Object.values(SEVERITY), ...Object.values(ELIGIBILITY), NOT_TRACKED, ...STAGES.map((s) => stageTerm(s))];

// DS-12b: the ten eligibility checks, stored flags and source refs in words. Column paths never reach the badge; the stored string stays in the hover card.
/** One name per `FLAG_CODES` code, in the order `lib/grants/eligibility.ts` runs them. */
export const CHECK: Record<FlagCode, string> = {
  applicant_type: "Who may apply", geography: "Geography", close_date: "Close date", sam_registration: "SAM.gov registration", audit_required: "Audited financials",
  cost_share: "Cost share", min_years_operating: "Years operating", award_size: "Award size", theme_overlap: "Programme themes", loi_required: "Letter of intent",
};
const WHERE: Record<string, [string, string]> = {
  opportunity: ["Grant listing", "the grant listing as the funder published it"], org: ["FAS settings", "the FAS facts an admin entered in settings"],
  match_config: ["Matching rules", "the approved matching rules"], eligibility: ["Eligibility checks", "the ten eligibility checks"],
  fas_records: ["FAS records", "the FAS records loaded in the app (at least 11 in the last 12 months)"],
};
/** Why a check could not run, by the stored field path: what the listing does not state, or what FAS has not entered. */
const MISSING: Record<string, string> = {
  "opportunity.eligibility.applicant_types": "who may apply", "opportunity.description": "any description", "opportunity.close_date": "a close date",
  "opportunity.eligibility.is_cost_sharing": "whether cost share is required", "opportunity.award_floor": "an award range", "opportunity.eligibility.funding_categories": "a funding category",
  "org.is_501c3": "whether FAS is a 501(c)(3)", "org.state": "the state FAS is in", "org.sam_status": "the SAM.gov registration status", "org.annual_budget_usd": "the annual budget",
  "org.program_themes": "the programme themes", "org.has_audited_financials": "whether FAS has audited financial statements", "org.years_operating": "how many years FAS has operated",
};
const field = (ref: string) => ref.split(".").pop()?.replace(/_/g, " ") ?? ref;
/** A stored `source_ref` such as `org.program_themes` as a chip label and a hint sentence, both without the path. */
export function sourceWords(ref: string): { label: string; plain: string } {
  const [where, plainWhere] = WHERE[ref.split(".")[0]] ?? ["Stored record", "a stored record"];
  const f = ref.includes(".") && !where.toLowerCase().endsWith(field(ref)) ? field(ref) : "";
  return { label: f ? `${where} · ${f}` : where, plain: f ? `From ${plainWhere}: the ${f} field.` : `From ${plainWhere}.` };
}
/** F-504f: where the evidence part leads. Credited FAS records → the grant evidence packet that shows them; evidence asked for but not held → Enter data. */
export const EVIDENCE_PACKET_HREF = "/staff/packets?variant=grant", ENTER_DATA_HREF = "/staff/entry";
export function evidenceLinks(c: { key: string; points: number; max: number; source_refs: string[] }): { href: string; label: string }[] {
  if (c.key !== "evidence_readiness") return [];
  const links = c.source_refs.some((r) => r.startsWith("fas_records.")) ? [{ href: EVIDENCE_PACKET_HREF, label: "See these records in the grant evidence packet" }] : [];
  return c.points < c.max && c.source_refs.includes("match_config.params.evidence_available") ? [...links, { href: ENTER_DATA_HREF, label: "Add the missing records on Enter data" }] : links;
}
/** The stored flag message in plain words. "Could not check <what>: <field> missing" becomes "<What> not checked: <why>"; anything else is already words and passes through. */
export function flagWords(code: string, message: string): string {
  const m = /^Could not check (.+): (\S+) missing$/.exec(message);
  if (!m) return message;
  const [, what, ref] = m, why = MISSING[ref] ?? field(ref);
  return `${cap(what)} not checked: ${ref.startsWith("org.") ? `FAS has not entered ${why} in settings` : `the listing does not state ${why}`}`;
}
export type CheckRow = { code: FlagCode; label: string; status: CheckStatus; words: string; flag?: Flag };
/** The ten checks for one stored flag list: a code with no flag passed; a "Could not check" flag is unclear; any other flag is flagged (mirrors `checkEligibility`). */
export function checklist(flags: Flag[]): CheckRow[] {
  return FLAG_CODES.map((code) => {
    const flag = flags.find((f) => f.code === code);
    if (!flag) return { code, label: CHECK[code], status: "pass", words: "Passed" };
    return { code, label: CHECK[code], status: flag.message.startsWith("Could not check") ? "unclear" : "flagged", words: flagWords(code, flag.message), flag };
  });
}
