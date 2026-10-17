import { ResponsiveTable } from "@/components/layout";
import { LowReliability } from "@/components/need-map/LowReliability";
import { FreshnessChip, NotPublished } from "@/components/trust";
import { ExplainCard, Hint, Provenance } from "@/components/trust/explain";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { UNLABELED } from "@/lib/methodology/labels";
import type { Draft, InputRow, MethodologyView } from "@/lib/methodology/query";
import { inputTerm, NEVER_LOADED, reliabilityWords, STAT_TERMS, SYNTHETIC_HINT, weightCards } from "@/lib/methodology/words";
import { whyHidden } from "@/lib/trust/glossary";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

export const TOC = [["how", "How we calculate it"], ["inputs", "Inputs"], ["weights", "Weights"], ["reliability", "Outliers and reliability"], ["vintages", "Vintages"], ["limits", "Limits"]] as const;
const LIMITS = [
  ["It is not a measure of how well FAS is doing.", "Public county indicators only, not FAS cases or outcomes."],
  ["It is county-level only.", "No cities, ZIP codes, tracts, or addresses."],
  ["It is a relative ranking among Utah counties, not an absolute level of need.", ""],
  ["Small-population counties are noisier.", "Survey estimates swing more; treat thin counties carefully."],
  ["Vintages differ by source.", "One input may lag another; each row's vintage stays visible."],
  ["Placeholder weights may be in use.", "Synthetic or single-input configs are labeled as such until FAS sets production weights."],
] as const;
const TOC_LINK = "inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm lg:min-h-0 lg:border-0 lg:px-0 lg:py-1";
const EYEBROW = "text-xs font-semibold uppercase tracking-wide text-muted-foreground", MUTED = "text-sm text-muted-foreground", DOTTED = "underline decoration-dotted underline-offset-4";
const CARD = "flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm", BIG = "text-4xl leading-none font-semibold tabular-nums";

export function MethodologyToc({ items }: { items: readonly (readonly [string, string])[] }) {
  return <nav aria-label="On this page" data-slot="methodology-toc" className="flex flex-wrap gap-2 lg:sticky lg:top-20 lg:flex-col lg:self-start">{items.map(([id, label]) => <a key={id} href={`#${id}`} className={TOC_LINK}>{label}</a>)}</nav>;
}

/** The approved version in one strip: version and approval month, inputs and points, counties scored; the Synthetic badge explains itself. */
export function VersionLine({ lines, synthetic }: { lines: string[]; synthetic: boolean }) {
  return (
    <p data-slot="version-line" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      {lines.map((line, i) => <span key={line} data-slot="version-fact">{i ? <span aria-hidden className="mr-3 text-muted-foreground">·</span> : null}{line}</span>)}
      {synthetic ? <Hint text={SYNTHETIC_HINT} className="rounded-full"><Badge variant="info" prefix={<Info aria-hidden />}>Synthetic data</Badge></Hint> : null}
    </p>
  );
}

export function DraftNotice({ draft }: { draft: Draft }) {
  const body = `Version ${draft.version} was created ${draft.createdLabel} and is not approved. The map and this page still use the approved version.`;
  return <Alert variant="info" data-slot="draft-notice" role="status" aria-live="polite"><Info /><AlertTitle>Newer draft on file</AlertTitle><AlertDescription>{body}</AlertDescription></Alert>;
}

/** One region: eyebrow (the TOC label, so the jump target reads the same), then a serif headline in words. */
export function Sec({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-slot="methodology-section" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1"><p className={EYEBROW}>{eyebrow}</p><h2 id={id} tabIndex={-1} className="max-w-prose scroll-mt-20 font-serif text-2xl font-semibold leading-snug">{title}</h2></div>
      {children}
    </section>
  );
}

const COLS = ["Input", "Source and release", "Status"] as const;
/** Inputs: the name opens the indicator's words, the source line opens its provenance, the status chip explains itself. */
export function InputsTable({ caption, rows }: { caption: string; rows: InputRow[] }) {
  return (
    <ResponsiveTable stack>
      <caption className="sr-only">{caption}</caption>
      <thead><tr>{COLS.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} data-row={r.key} className="border-t border-border">
            <th scope="row" className="py-2 pr-3 text-left font-medium">
              {r.known
                ? <ExplainCard term={inputTerm(r.key, r.label)} source={r.source !== "—" ? `${r.source} ${r.vintage}` : undefined} asOf={r.asOf !== "—" ? r.asOf : undefined}>{r.label}</ExplainCard>
                : <><span className="font-mono">{r.label}</span> <span className="text-xs text-muted-foreground">{UNLABELED}</span></>}
            </th>
            <td data-cell="source" className="min-w-0 break-words py-2 pr-3 align-top text-sm">
              <span className="text-xs text-muted-foreground md:hidden">{COLS[1]}: </span>
              {r.source === "—" ? <Hint text={NEVER_LOADED} className={DOTTED}>—</Hint> : <Provenance source={r.source} period={r.vintage} n="" asOf={r.asOf} detail={{ vintage: r.vintage }}>{r.source} · {r.vintage} · as of {r.asOf}</Provenance>}
            </td>
            <td data-cell="status" className="py-2 pr-3 align-top"><span className="text-xs text-muted-foreground md:hidden">{COLS[2]}: </span>{r.status === "current" ? <FreshnessChip status="current" /> : <NotPublished />}</td>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}

/** Weights as points out of 100 (DESIGN.md need score rule 1): label → numeral → what the input measures → source line. The label opens the card. */
export function WeightCards({ view }: { view: MethodologyView }) {
  return (
    <>
      <ul data-slot="weight-cards" className="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
        {weightCards(view).map((c) => (
          <li key={c.key} data-weight={c.key} className={CARD}>
            <p className="text-sm font-medium text-muted-foreground"><ExplainCard term={c.term} value={c.points} source={c.version} asOf={c.asOf !== "—" ? c.asOf : undefined} hidden={c.hidden} rows={[["Input source", c.source]]}>{c.term.title}</ExplainCard></p>
            <p data-slot="weight-points" className="flex items-baseline gap-2">{c.hidden ? <span className="font-medium">{c.points}</span> : <><span className={BIG}>{c.points.split(" ")[0]}</span><span className="text-sm text-muted-foreground">of 100 points</span></>}</p>
            <p className={`max-w-prose ${MUTED}`}>{c.term.plain}</p>
            <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{c.source}{c.asOf !== "—" ? ` · as of ${c.asOf}` : ""}</p>
          </li>
        ))}
      </ul>
      <p data-slot="weights-total" className="text-sm">Total <span className="font-medium tabular-nums">{view.sum}</span> of 100 points as stored, across {view.weights.length === 1 ? "one input" : `${view.weights.length} inputs`}.</p>
    </>
  );
}

const T = ({ id, children }: { id: keyof typeof STAT_TERMS; children: ReactNode }) => <Hint text={STAT_TERMS[id]} className={DOTTED}><span data-stat={id}>{children}</span></Hint>;
/** The plain paragraph with a hint on every statistical word, then the precise form, then the published-value rule in words. */
export function FormulaBlock({ view }: { view: MethodologyView }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p data-slot="plain-method" className="max-w-prose leading-7">
        For each Utah county we turn every input into a <T id="z_score">z-score</T>: how far that county sits from the <T id="average">statewide average</T>, measured in <T id="sd">standard deviations</T>.
        {" "}We multiply each z-score by its <T id="weight">weight</T>, add them up, and <T id="rank">rank</T> counties from the highest score to the lowest.
        {" "}The rank is relative: a high score means higher need than other Utah counties on these inputs, not a fixed level of need.
      </p>
      <pre data-slot="formula" className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-sm">score_c = Σ_i ( w_i × z_i,c ){"\n"}z_i,c = (x_i,c − μ_i) / σ_i</pre>
      <p className={`max-w-prose ${MUTED}`}>
        The spread for each input is measured only over counties whose source published a value.
        {" "}A county missing a required input for this version is <Hint text={whyHidden("not_published")} className={DOTTED}>Not published</Hint> and gets no rank, the same rule as the need map.
      </p>
      {view.singleInput ? <p className={MUTED}>This approved version ({view.version}) uses a placeholder single input for previews. Real multi-input weights are set by FAS policy.</p> : null}
    </div>
  );
}

/** F-210c: z-scores, the cap and the reliability flag in words, which inputs are checked, then each flagged county with its marker. */
export function ReliabilitySection({ view }: { view: MethodologyView }) {
  const words = reliabilityWords(view.params), on = view.params.cv_flag_pct !== undefined;
  return (
    <div data-slot="reliability" className="flex flex-col gap-3 text-sm">
      <p className="max-w-prose leading-7">A <T id="z_score">z-score</T> says how many <T id="sd">standard deviations</T> a county sits from the Utah average on one input. {words.cap}</p>
      <p data-slot="reliability-flag" className="max-w-prose leading-7">{words.flag}</p>
      {on ? (
        <>
          <ul data-slot="reliability-checked" className="flex flex-col gap-1">
            {view.checked.map((c) => <li key={c.key} data-checked={c.checked}>{c.label}: {c.checked ? "checked (the source publishes a margin of error)" : "not checked (no margin of error is stored for this input)"}</li>)}
          </ul>
          {view.flagged.length ? (
            <ul data-slot="reliability-counties" className="flex flex-col gap-2">
              {view.flagged.map((c) => <li key={c.fips} data-fips={c.fips} className="flex flex-wrap items-center gap-2"><span className="font-medium">{c.name}</span>{c.flags.map((f) => <LowReliability key={f.code} flag={f} />)}</li>)}
            </ul>
          ) : <p className={MUTED}>No county is above the threshold in this version.</p>}
        </>
      ) : null}
    </div>
  );
}

export function LimitsSection() {
  const items = LIMITS.map(([title, body], i) => <li key={title} data-testid={`limit-${i + 1}`}><span className="font-medium">{title}</span>{body ? <span className="text-muted-foreground"> {body}</span> : null}</li>);
  return <ol className="flex max-w-prose list-decimal flex-col gap-2 pl-5 text-sm">{items}</ol>;
}
