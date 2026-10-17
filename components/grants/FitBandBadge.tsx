"use client";

// F-504d: the fit band as a word badge beside the score (colour is never the only signal). The hint says what the band means; a capped Pass names its cap and stored reason.
import { CircleCheckBig, CircleMinus, Eye } from "lucide-react";
import type { ReactNode } from "react";
import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import type { BandKey, FitBand } from "@/lib/grants/band";
import { BAND } from "@/lib/grants/terms";

const FACE: Record<BandKey, [ReactNode, "success" | "info" | "muted"]> = {
  strong: [<CircleCheckBig key="s" aria-hidden />, "success"], look: [<Eye key="l" aria-hidden />, "info"], pass: [<CircleMinus key="p" aria-hidden />, "muted"],
};

export function FitBandBadge({ band }: { band: FitBand }) {
  const [glyph, variant] = FACE[band.key];
  const text = band.reason ? `${BAND[band.key].plain} ${band.reason.replace(/\.$/, "")}.` : BAND[band.key].plain;
  return (
    <Hint text={text}>
      <Badge data-slot="fit-band" data-band={band.key} variant={variant} prefix={glyph}>{band.label}{band.cap ? `: ${band.cap}` : ""}</Badge>
    </Hint>
  );
}
