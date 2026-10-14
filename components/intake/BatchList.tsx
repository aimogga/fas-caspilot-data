"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResponsiveTable, Stack } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, shortId } from "@/lib/intake/commit";

/** F-301 part 3: the caller's newest batches, read under RLS by the server page. Operational screen for staff: no client data here. */
export type BatchRow = { id: string; created_at: string; entity: string | null; rows_ok: number | null; status: string };
const STATUS: Record<string, [string, "success" | "muted"]> = { committed: ["Committed", "success"], rolled_back: ["Rolled back", "muted"] };
const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function BatchList({ batches }: { batches: BatchRow[] }) {
  const router = useRouter(), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function rollBack(id: string) {
    if (!window.confirm(`Roll back batch ${shortId(id)}? Its rows will be removed.`)) return;
    setBusy(id); setError((await postJson("/api/intake/rollback", { batchId: id })).error); setBusy(null); router.refresh();
  }
  return (
    <Stack gap={3}>
      <h2 className="font-serif text-xl font-semibold">Recent uploads</h2>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {batches.length === 0 ? <p className="text-sm text-muted-foreground">No uploads yet. Saved uploads appear here with a Roll back action.</p> : (
        <ResponsiveTable>
          <thead><tr>{["When", "Type", "Batch", "Rows", "Status"].map((t) => <th key={t} scope="col" className={t === "Rows" ? "text-right" : undefined}>{t}</th>)}<th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} data-batch={shortId(b.id)}>
                <td>{when.format(new Date(b.created_at))}</td><td>{b.entity ?? "—"}</td><td className="font-mono">{shortId(b.id)}</td><td className="text-right tabular-nums">{b.rows_ok ?? 0}</td>
                <td><Badge variant={STATUS[b.status]?.[1] ?? "muted"} prefix={<span aria-hidden>•</span>}>{STATUS[b.status]?.[0] ?? b.status}</Badge></td>
                <td>{b.status === "committed" ? <Button type="button" size="sm" variant="outline" disabled={busy === b.id} onClick={() => rollBack(b.id)}>Roll back<span className="sr-only"> batch {shortId(b.id)}</span></Button> : null}</td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      )}
    </Stack>
  );
}
