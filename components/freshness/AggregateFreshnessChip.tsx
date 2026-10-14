"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { FreshnessPage } from "@/lib/freshness/query";
import type { FreshnessStatus, TopBarChip } from "@/lib/freshness/status";
import { createClient } from "@/lib/supabase/client";

/** Glyph + badge variant per status; mirrors `FreshnessChip` (DS-01c) so the chip is never colour alone. */
const CHROME: Readonly<Record<FreshnessStatus, { glyph: string; variant: "success" | "warning" | "destructive" | "muted" }>> = {
  current: { glyph: "●", variant: "success" },
  stale: { glyph: "◐", variant: "warning" },
  failed: { glyph: "✕", variant: "destructive" },
  not_published: { glyph: "○", variant: "muted" },
};
const CHIP = "inline-flex min-h-11 items-center rounded-full lg:min-h-0";

/** DS-05 top-bar aggregate chip (F-209). Hidden while loading, on error, or with no sources; board gets the same chrome without a link so it never lands on a 403. */
export function AggregateFreshnessChip({ role }: { role: string }) {
  const [chip, setChip] = useState<TopBarChip | null>(null);
  useEffect(() => {
    const client = createClient();
    if (!client) return;
    let cancelled = false;
    FreshnessPage.load(client, new Date(), role)
      .then((view) => { if (!cancelled) setChip(view.chip); })
      .catch(() => { if (!cancelled) setChip(null); });
    return () => { cancelled = true; };
  }, [role]);
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
