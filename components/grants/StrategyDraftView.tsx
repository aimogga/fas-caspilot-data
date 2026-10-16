// F-508f: the stored strategy draft. Every figure sits beside a citation chip that opens the stored row; inferences stay in their own section.
import type { ReactNode } from "react";
import { Section } from "@/components/layout";
import { ExplainCard } from "@/components/trust/explain";
import { citationFace } from "@/lib/strategy/view";
import type { StrategyDraft } from "@/lib/strategy/schema";
import type { Fact } from "@/lib/strategy/snapshot";

const CONFIDENCE = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;
const CARD = "rounded-lg border border-border bg-card p-4 shadow-sm lg:p-6", LIST = "flex max-w-prose list-disc flex-col gap-2 pl-5";
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function Chip({ id, facts, builtAt }: { id: string; facts: Map<string, Fact>; builtAt: string }) {
  const fact = facts.get(id);
  if (!fact) return null; // validated drafts only cite snapshot facts; failed drafts never reach this view
  const f = citationFace(fact, builtAt);
  return (
    <ExplainCard term={f.term} value={f.value} source={f.source} asOf={f.asOf} label={`Source: ${fact.label}`}
      className="rounded-full border border-border bg-muted px-2 text-xs font-medium text-muted-foreground no-underline lg:py-0.5">
      <span data-slot="citation-chip">{f.word}</span>
    </ExplainCard>
  );
}

const Block = ({ title, children }: { title: string; children: ReactNode }) => <div className="flex flex-col gap-1"><h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>{children}</div>;

export function StrategyDraftView({ draft, facts, builtAt }: { draft: StrategyDraft; facts: Map<string, Fact>; builtAt: string }) {
  const ask = draft.suggested_ask;
  return (
    <>
      <Section title="How FAS meets each criterion">
        <ol data-slot="criteria-map" className="flex flex-col gap-4">
          {draft.criteria_map.map((c, i) => (
            <li key={i} className={`${CARD} flex flex-col gap-3`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-medium leading-snug break-words">{c.criterion}</h3><span data-slot="confidence" className="text-sm text-muted-foreground">{CONFIDENCE[c.confidence]}</span></div>
              <Block title="FAS position"><p className="max-w-prose">{c.fas_position}</p></Block>
              <Block title="Evidence">
                {c.evidence.length ? <ul data-slot="evidence" className="flex flex-col gap-2">{c.evidence.map((e, j) => <li key={j} className="flex max-w-prose flex-wrap items-center gap-x-2">{e.claim} <Chip id={e.citation_id} facts={facts} builtAt={builtAt} /></li>)}</ul>
                  : <p className="text-muted-foreground">No cited evidence.</p>}
              </Block>
              <Block title="Gaps">{c.gaps.length ? <ul className={LIST}>{c.gaps.map((g, j) => <li key={j}>{g}</li>)}</ul> : <p className="text-muted-foreground">None named.</p>}</Block>
            </li>
          ))}
        </ol>
      </Section>
      <Section title="Suggested ask">
        <div data-slot="suggested-ask" className={`${CARD} flex flex-col gap-2`}>
          {ask ? <><p className="text-3xl font-semibold tabular-nums">{usd(ask.low)}–{usd(ask.high)}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">Based on {ask.basis_citation_ids.map((id) => <Chip key={id} id={id} facts={facts} builtAt={builtAt} />)}</p></> : <p className="text-muted-foreground">No suggested ask: no stored row gives a basis.</p>}
        </div>
      </Section>
      <Section title="Risks"><ul data-slot="risks" className={LIST}>{draft.risks.map((r, i) => <li key={i}>{r}</li>)}</ul></Section>
      <Section title="Narrative outline"><ol data-slot="outline" className="flex max-w-prose list-decimal flex-col gap-2 pl-5">{draft.narrative_outline.map((n, i) => <li key={i}>{n}</li>)}</ol></Section>
      <Section title="Inferences (not facts)">
        <div data-slot="inferences" className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 lg:p-6">
          <p className="text-sm text-muted-foreground">Guesses the draft makes that no stored row states. Check each one before using it.</p>
          {draft.inferences.length ? <ul className={LIST}>{draft.inferences.map((n, i) => <li key={i}>{n}</li>)}</ul> : <p className="text-muted-foreground">None.</p>}
        </div>
      </Section>
    </>
  );
}
