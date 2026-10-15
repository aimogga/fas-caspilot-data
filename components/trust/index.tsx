import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { asOfNote } from "@/lib/dashboard/cards";

export type SourceFooterProps = { source: string; period: string; n: string | number; asOf: string };

export function SourceFooter({ source, period, n, asOf }: SourceFooterProps) {
  return <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{source} · {period} · n {n} · {asOfNote(asOf)}</p>;
}

export function SuppressedCell({ count }: { count?: number }) {
  void count;
  return (
    <span data-slot="suppressed" title="Suppressed (n < 11) to protect privacy.">
      <span aria-hidden>— n&lt;11</span>
      <span className="sr-only">Suppressed because the count is under 11, to protect privacy.</span>
    </span>
  );
}

const FRESHNESS = {
  current: { word: "Current", variant: "success", glyph: "●" },
  stale: { word: "Stale", variant: "warning", glyph: "◐" },
  failed: { word: "Failed", variant: "destructive", glyph: "✕" },
} as const;

export function FreshnessChip({ status }: { status: keyof typeof FRESHNESS }) {
  const { word, variant, glyph } = FRESHNESS[status];
  return <span data-slot="freshness"><Badge variant={variant} prefix={<span aria-hidden>{glyph}</span>}>{word}</Badge></span>;
}

export function NotPublished({ reason }: { reason?: string }) {
  return <p data-slot="not-published" className="text-sm text-muted-foreground">Not published{reason ? ` — ${reason}` : ""}</p>;
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
