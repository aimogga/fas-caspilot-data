import Link from "next/link";
import type { GrantAsk } from "@/lib/packets/asks";

/** F-403c: staff-only note above a grant packet prepared for one grant; hidden in print and absent from the downloads. */
export function GrantAsks({ asks }: { asks: GrantAsk[] }) {
  return (
    <section data-slot="packet-asks" aria-labelledby="packet-asks-title" className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-4 text-sm">
      <h2 id="packet-asks-title" className="font-medium">What this grant asks for</h2>
      <p className="text-muted-foreground">For FAS staff only, read from the grant listing. It is not part of the packet or its downloads.</p>
      {asks.length === 0 ? <p>The listing names no outcome, cost or wait-time evidence.</p> : (
        <ul className="flex flex-col gap-1">
          {asks.map((a) => (
            <li key={a.kind} data-kind={a.kind} data-loaded={a.loaded} className="flex min-h-11 flex-wrap items-center gap-x-2 lg:min-h-0">
              <span className="font-medium">{a.label}</span>
              <span>· in {a.section} ({a.figure})</span>
              {a.loaded ? <span>· FAS has at least 11 records from the last 12 months</span> : (
                <span>· Not enough FAS records yet. <Link href="/staff/entry" className="underline underline-offset-4">Add them on Enter data</Link></span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
