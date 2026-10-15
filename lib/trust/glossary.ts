import { METRIC_CARDS } from "@/lib/dashboard/cards";

/** One explainable thing: what it means in plain words, where it comes from, its unit, and why it can be hidden (DS-09, D-040). */
export type Term = { id: string; title: string; plain: string; source?: string; unit?: string; hidden?: string };

export const HIDDEN_SMALL = "Fewer than 11 families, so the number is hidden to protect privacy.";
const FAS = "FAS records";
const title = (id: string) => METRIC_CARDS.find((c) => c.id === id)?.title ?? id;
const t = (id: string, plain: string, rest: Partial<Term> = {}): Term => ({ id, title: title(id), plain, ...rest });

/** Core terms. Page packets add domain terms beside their domain (`lib/need-map/terms.ts`, `lib/grants/terms.ts`), never here. */
export const GLOSSARY = {
  m1: t("m1", "How many days a family waited between the court order and their first therapy session. We report the median, the middle value, so one very long wait cannot skew it.", { source: FAS, unit: "days", hidden: HIDDEN_SMALL }),
  m2: t("m2", "How many days passed between a family's application and FAS deciding whether to fund therapy. We report the median, the middle value.", { source: FAS, unit: "days", hidden: HIDDEN_SMALL }),
  m3: t("m3", "The share of families whose therapy was approved but who had no session within 60 days. Lower is better.", { source: FAS, unit: "% of approved families", hidden: HIDDEN_SMALL }),
  m4: t("m4", "Of the families whose therapy closed, the share who finished the planned course, grouped by household income.", { source: FAS, unit: "% of closed episodes", hidden: HIDDEN_SMALL }),
  m5: t("m5", "What FAS paid, on average, for one completed course of therapy.", { source: FAS, unit: "dollars per completed episode", hidden: HIDDEN_SMALL }),
  m6: t("m6", "The share of therapy spending that went to providers affiliated with FAS versus other providers, shown with each group's average rate per hour.", { source: FAS, unit: "% of dollars", hidden: HIDDEN_SMALL }),
  o1: t("o1", "How families' survey scores changed between the start and end of therapy. A negative change on a distress scale means they felt better.", { source: FAS, unit: "points", hidden: HIDDEN_SMALL }),
  median: { id: "median", title: "Median", plain: "The middle value: half the families waited less, half waited more. One very long wait cannot skew it." },
  delta: { id: "delta", title: "Change from last quarter", plain: "How this quarter compares with the quarter before, in the same unit. The arrow and the words say which way is better." },
  as_of: { id: "as_of", title: "As of", plain: "The date of the newest record behind this number. Family numbers show a month or quarter, never a day." },
  suppressed: { id: "suppressed", title: "Hidden to protect privacy", plain: HIDDEN_SMALL, hidden: HIDDEN_SMALL },
  complementary: { id: "complementary", title: "Hidden to protect another number", plain: "Hidden so the smaller group next to it cannot be worked out from the total." },
  not_published: { id: "not_published", title: "Not published", plain: "The source did not publish this value for this place in that release. It is not a zero." },
  not_available: { id: "not_available", title: "Not available yet", plain: "This number appears once the data behind it is set up. Nothing is hidden; there is no number to show yet." },
  fresh_current: { id: "fresh_current", title: "Current", plain: "The newest release from this source is loaded." },
  fresh_stale: { id: "fresh_stale", title: "Stale", plain: "Overdue for a refresh: the last good update is older than the source's usual cycle." },
  fresh_failed: { id: "fresh_failed", title: "Last update failed", plain: "The last update from this source failed; we show the last good release and the date." },
  aggregate: { id: "aggregate", title: "Aggregate submission", plain: "A total that FAS entered as a total, not built up from individual records." },
  draft: { id: "draft", title: "AI draft", plain: "Written by software from stored numbers; a person must review it before it is used." },
  need_score: { id: "need_score", title: "County need score", plain: "A relative score built from public indicators such as poverty and uninsured rates; higher means more need compared with other Utah counties." },
  rank: { id: "rank", title: "Rank", plain: "This county's place among the counties that have a score, 1 being the highest need." },
  placeholder_bins: { id: "placeholder_bins", title: "Placeholder bands", plain: "Five equal-count colour bands used until FAS sets the final weights." },
  fas_county: { id: "fas_county", title: "FAS county", plain: "A county where FAS currently funds therapy." },
} as const satisfies Record<string, Term>;

export type TermId = keyof typeof GLOSSARY;
/** A glossary id or a ready term; an unknown id falls back to a term that says so instead of throwing in a render path. */
export const term = (idOrTerm: string | Term): Term =>
  typeof idOrTerm !== "string" ? idOrTerm : (GLOSSARY as Record<string, Term>)[idOrTerm] ?? { id: idOrTerm, title: idOrTerm, plain: "No explanation is written for this yet." };
const SOURCES: Record<string, string> = {
  [FAS]: "Case records FAS uploaded or entered. Counts under 11 families are hidden, dates are shown by month or quarter, and places by county only.",
  "Census SAHIE": "The Census Bureau's Small Area Health Insurance Estimates: how many people in each county have no health insurance, by age and income.",
  "Census SAIPE": "The Census Bureau's Small Area Income and Poverty Estimates: poverty rates and median income for each county, each year.",
  "Census ACS 5-year": "The Census Bureau's American Community Survey, five years pooled: county figures such as single-parent households and households without a vehicle.",
  "Grants.gov": "The federal list of grant opportunities. We search it for openings that fit FAS and keep the posting and closing dates.",
};

/** The term behind a source footer; any other name gets the generic public-source words. */
export const sourceTerm = (name: string): Term =>
  ({ id: `source:${name}`, title: name, plain: SOURCES[name] ?? "A public data source. The footer shows the period it covers and the date of our last successful load." });
export type HiddenKind = "suppressed" | "complementary" | "not_published" | "not_available" | "error";
const WHY_HIDDEN: Record<HiddenKind, string> = {
  suppressed: HIDDEN_SMALL, complementary: GLOSSARY.complementary.plain, not_published: "The source did not publish this for this county in that release.",
  not_available: "This number appears once the data behind it is set up.", error: "This number could not be loaded, so nothing is shown until the next try.",
};
/** One plain sentence for each reason a value is hidden. */
export const whyHidden = (kind: HiddenKind): string => WHY_HIDDEN[kind];
