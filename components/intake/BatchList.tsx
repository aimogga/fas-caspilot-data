"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResponsiveTable, Stack } from "@/components/layout";
import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, shortId } from "@/lib/intake/commit";

/** F-301 part 3: the caller's newest batches, read under RLS by the server page. Operational screen for staff: no client data here. */
export type BatchRow = { id: string; created_at: string; entity: string | null; rows_ok: number | null; status: string };
type Chrome = { word: string; variant: "success" | "muted"; hint: string };
/** DS-18a: the status word matches the button the user pressed (`Save`), and each word carries one plain sentence in a `Hint`. */
const STATUS: Record<string, Chrome> = {
  committed: { word: "Saved", variant: "success", hint: "These rows are in the database and count in every view. Roll back removes them." },
  rolled_back: { word: "Rolled back", variant: "muted", hint: "These rows were removed after saving and no longer count anywhere." },
};
const chrome = (status: string): Chrome => STATUS[status] ?? { word: status, variant: "muted", hint: `Recorded as "${status}".` };
const typeWords = (entity: string | null) => (entity ? `${entity[0].toUpperCase()}${entity.slice(1)} records` : "Not recorded");
const REFERENCE = "The first 8 characters of this upload's id. Quote it when you ask about an upload.";
const HEADERS = ["When", "Type", "Reference", "Rows saved", "Status"] as const;
const when = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function BatchList({ batches }: { batches: BatchRow[] }) {
  const router = useRouter(), [busy, setBusy] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function rollBack(id: string) {
    if (!window.confirm(`Roll back upload ${shortId(id)}? Its rows will be removed.`)) return;
    setBusy(id); setError((await postJson("/api/intake/rollback", { batchId: id })).error); setBusy(null); router.refresh();
  }
  return (
    <Stack gap={3}>
      <h2 className="font-serif text-xl font-semibold">Recent uploads</h2>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {batches.length === 0 ? <p className="text-sm text-muted-foreground">No uploads yet. Saved uploads appear here, each with a Roll back action.</p> : (
        <ResponsiveTable>
          <thead><tr>{HEADERS.map((t) => <th key={t} scope="col" className={t === "Rows saved" ? "text-right" : undefined}>{t}</th>)}<th scope="col"><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {batches.map((b) => {
              const c = chrome(b.status);
              return (
                <tr key={b.id} data-slot="batch-row" data-batch={shortId(b.id)}>
                  <td>{when.format(new Date(b.created_at))}</td>
                  <td>{typeWords(b.entity)}</td>
                  <td><Hint text={REFERENCE} className="font-mono underline decoration-dotted underline-offset-4">{shortId(b.id)}</Hint></td>
                  <td className="text-right tabular-nums">{b.rows_ok ?? 0}</td>
                  <td data-slot="batch-status"><Hint text={c.hint}><Badge variant={c.variant} prefix={<span aria-hidden>•</span>}>{c.word}</Badge></Hint></td>
                  <td>{b.status === "committed" ? <Button type="button" size="sm" variant="outline" disabled={busy === b.id} onClick={() => rollBack(b.id)}>Roll back<span className="sr-only"> upload {shortId(b.id)}</span></Button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </ResponsiveTable>
      )}
    </Stack>
  );
}
