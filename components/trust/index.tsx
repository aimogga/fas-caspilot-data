import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export type SourceFooterProps = { source: string; period: string; n: string | number; asOf: string };

export function SourceFooter({ source, period, n, asOf }: SourceFooterProps) {
  return <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{source} · {period} · n {n} · as of {asOf}</p>;
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
