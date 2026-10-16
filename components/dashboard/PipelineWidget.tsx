import { Hint } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PipelineView } from "@/lib/dashboard/query";
import { MANUAL_HINT, stageHint } from "@/lib/dashboard/words";

/** DS-15a: each stage name is a hint with one sentence and the count in words; the manual badge says where the row came from. */
export function PipelineWidget({ view }: { view: PipelineView }) {
  return (
    <section aria-labelledby="pipeline-title" data-slot="pipeline-widget">
      <Card className="h-full">
        <CardHeader><CardTitle><h2 id="pipeline-title" className="text-base font-semibold">Grant pipeline</h2></CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {view.empty ? <p className="text-sm text-muted-foreground">No opportunities in the pipeline yet.</p> : null}
          <ol className="divide-y">
            {view.stages.map((s) => (
              <li key={s.name} data-stage={s.name} className="flex min-h-11 items-center justify-between gap-2 py-2 text-sm lg:min-h-0">
                <span className="flex items-center gap-2"><Hint text={stageHint(s.name, s.count)}>{s.name}</Hint>{s.manual ? <Hint text={MANUAL_HINT}><Badge prefix={<span aria-hidden>✎</span>}>Manual entry</Badge></Hint> : null}</span>
                <span className="text-right tabular-nums">{s.count}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm">{view.deadline}</p>
          <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{view.footer}</p>
        </CardContent>
      </Card>
    </section>
  );
}
