import { FreshnessChip } from "@/components/trust";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FreshnessRow, FreshnessView } from "@/lib/dashboard/freshness";

function StatusChip({ status }: { status: FreshnessRow["status"] }) {
  if (status === "not_published") return <Badge variant="muted" className="border-dashed border-border" prefix={<span aria-hidden>○</span>}>Not published</Badge>;
  return <FreshnessChip status={status} />;
}

export function FreshnessWidget({ view }: { view: FreshnessView }) {
  return (
    <section aria-labelledby="freshness-title" data-slot="freshness-widget">
      <Card className="h-full">
        <CardHeader><CardTitle><h2 id="freshness-title" className="text-base font-semibold">Public data freshness</h2></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {view.rows.length === 0 ? <p className="text-sm text-muted-foreground">No sources registered yet</p> : null}
          <ul className="divide-y">
            {view.rows.map((r) => (
              <li key={r.name} data-status={r.status} className="flex min-h-11 flex-wrap items-center gap-2 py-2 text-sm lg:min-h-0">
                <StatusChip status={r.status} />{" "}
                <span>{r.name}{r.status === "failed" ? <span className="text-muted-foreground"> · Last run failed</span> : null}</span>
                {" "}
                <span className="ml-auto text-right tabular-nums text-muted-foreground">Latest {r.latestVintage}</span>
              </li>
            ))}
          </ul>
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">Source registry · as of {view.asOf}</p>
        </CardContent>
      </Card>
    </section>
  );
}
