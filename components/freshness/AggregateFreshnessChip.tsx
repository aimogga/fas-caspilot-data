import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FreshnessStatus, TopBarChip } from "@/lib/freshness/status";

/** Glyph + badge variant per status; mirrors `FreshnessChip` (DS-01c) so the chip is never colour alone. */
/** Exported for the data-freshness table (DS-16a) so a status is never redrawn by colour alone. */
export const CHROME: Readonly<Record<FreshnessStatus, { glyph: string; variant: "success" | "warning" | "destructive" | "muted" }>> = {
  current: { glyph: "●", variant: "success" },
  stale: { glyph: "◐", variant: "warning" },
  failed: { glyph: "✕", variant: "destructive" },
  not_published: { glyph: "○", variant: "muted" },
};
const CHIP = "inline-flex min-h-11 items-center rounded-full lg:min-h-0";

/** DS-05 top-bar aggregate chip (F-209). The shell loads `chip` server-side: auth cookies are httpOnly, so a browser client
 * has no session and RLS returns nothing. Hidden with no sources or on error; board gets the same chrome without a link so it never lands on a 403. */
export function AggregateFreshnessChip({ role, chip }: { role: string; chip: TopBarChip | null }) {
  if (!chip) return null;
  const { glyph, variant } = CHROME[chip.status];
  const badge = <Badge variant={variant} className={chip.status === "not_published" ? "border-dashed border-border" : undefined} prefix={<span aria-hidden>{glyph}</span>}>{chip.label}</Badge>;
  const navigates = role === "admin" || role === "staff";
  return (
    <div data-slot="freshness-slot">
      {navigates
        ? <Link href="/data-freshness" data-slot="freshness-chip" data-status={chip.status} className={CHIP} aria-label={`Data freshness: ${chip.label}`}>{badge}</Link>
        : <span data-slot="freshness-chip" data-status={chip.status} className={CHIP}>{badge}</span>}
    </div>
  );
}
