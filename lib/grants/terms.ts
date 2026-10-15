// DS-12a: the grant-matching words in plain language (D-040). Domain terms live here so page packets never edit `lib/trust/glossary.ts`.
import { STAGES } from "@/lib/dashboard/query";
import type { Term } from "@/lib/trust/glossary";
import type { FlagSeverity } from "./types";

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

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
/** Award floor and ceiling as words; both come from stored `opportunity` columns and a missing pair reads as such, never as 0. */
export function awardRange(floor: number | null, ceiling: number | null): string {
  if (floor !== null && ceiling !== null) return `${usd(floor)}–${usd(ceiling)}`;
  return ceiling !== null ? `up to ${usd(ceiling)}` : floor !== null ? `from ${usd(floor)}` : "award not stated";
}

export const GRANT_TERMS: Term[] = [FIT_SCORE, ...Object.values(COMPONENT), ...Object.values(CAP), ...Object.values(SEVERITY), ...Object.values(ELIGIBILITY), NOT_TRACKED, ...STAGES.map((s) => stageTerm(s))];
