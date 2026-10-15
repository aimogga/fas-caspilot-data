import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Hint, Provenance, type ProvenanceDetail, type SourceFooterProps } from "@/components/trust/explain";
import { asOfNote } from "@/lib/dashboard/cards";
import { GLOSSARY, HIDDEN_SMALL } from "@/lib/trust/glossary";

export type { SourceFooterProps };

/** The visible text is unchanged (e2e footers match on it); the text itself opens the Provenance card (DS-09). */
export function SourceFooter({ detail, ...p }: SourceFooterProps & { detail?: ProvenanceDetail }) {
  return <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground"><Provenance {...p} detail={detail}>{p.source} · {p.period} · n {p.n} · {asOfNote(p.asOf)}</Provenance></p>;
}

export function SuppressedCell({ count }: { count?: number }) {
  void count;
  return (
    <Hint text={HIDDEN_SMALL}>
      <span data-slot="suppressed">
        <span aria-hidden>— n&lt;11</span>
        <span className="sr-only">Suppressed because the count is under 11, to protect privacy.</span>
      </span>
    </Hint>
  );
}

const FRESHNESS = {
  current: { word: "Current", variant: "success", glyph: "●", term: GLOSSARY.fresh_current },
  stale: { word: "Stale", variant: "warning", glyph: "◐", term: GLOSSARY.fresh_stale },
  failed: { word: "Failed", variant: "destructive", glyph: "✕", term: GLOSSARY.fresh_failed },
} as const;

export function FreshnessChip({ status }: { status: keyof typeof FRESHNESS }) {
  const { word, variant, glyph, term } = FRESHNESS[status];
  return <span data-slot="freshness"><Hint text={term.plain} className="rounded-full"><Badge variant={variant} prefix={<span aria-hidden>{glyph}</span>}>{word}</Badge></Hint></span>;
}

export function NotPublished({ reason }: { reason?: string }) {
  return <p data-slot="not-published" className="text-sm text-muted-foreground"><Hint text={GLOSSARY.not_published.plain} className="underline decoration-dotted underline-offset-4">Not published{reason ? ` — ${reason}` : ""}</Hint></p>;
}

export function DraftBanner() {
  return (
    <Alert variant="info" data-slot="draft-banner">
      <Info />
      <AlertTitle>DRAFT — needs review</AlertTitle>
      <AlertDescription>Figures cite stored rows only.</AlertDescription>
    </Alert>
  );
}

/** F-303: every view of an aggregate submission carries this label (PRD §C2, DS-07 footer rule). */
export function AggregateBadge() {
  return <Badge variant="info" aria-label="Aggregate submission" prefix={<span aria-hidden>Σ</span>}>Aggregate</Badge>;
}
