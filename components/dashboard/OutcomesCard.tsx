import { ResponsiveTable } from "@/components/layout";
import { KEYS, Td, Th } from "@/components/dashboard/M4Table";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { O1_COLUMNS } from "@/lib/dashboard/cards";
import { num, pct, signed } from "@/lib/dashboard/format";
import type { O1Result } from "@/lib/dashboard/metrics-query";
import { DASH_TERMS, o1Cell } from "@/lib/dashboard/words";
import { Instrument } from "@/lib/metrics/instruments";

/** O1 body (DS-07c, F-305): one row per active instrument with its direction note; rates and n hide together under 11 pairs.
 * DS-15b: every mean, share and n cell explains itself through one `ExplainLayer` inside a keyboard region, as the M4 table does. */
export function OutcomesCard({ data, asOf = "Not available yet" }: { data: O1Result; asOf?: string }) {
  const [measure, mean, improved, n] = O1_COLUMNS;
  return (
    <ExplainLayer terms={DASH_TERMS}>
    <div role="region" tabIndex={0} aria-label="Outcome change by measure" aria-describedby="o1-keys" data-slot="o1-table" className="rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
      <p id="o1-keys" className="sr-only">{KEYS}</p>
      <ResponsiveTable stack>
        <caption className="sr-only">Outcome change per measure: mean change from baseline to follow-up, share improved and number of scored pairs.</caption>
        <thead><tr><Th numeric={false}>{measure}</Th><Th>{mean}</Th><Th>{improved}</Th><Th>{n}</Th></tr></thead>
        <tbody>
          {data.measures.map((m) => (
            <tr key={m.code} className="border-t border-border" data-measure={m.code} data-suppressed={m.suppressed || undefined}>
              <th scope="row" className="py-2 pr-3 text-left font-medium">{m.label}<span className="block text-xs font-normal text-muted-foreground">{Instrument.directionNote(m.code)}</span></th>
              <Td label={mean} value={signed(m.meanChange)} data={o1Cell("mean", m, asOf)} /><Td label={improved} value={pct(m.shareImproved)} data={o1Cell("improved", m, asOf)} />
              <Td label={n} value={m.suppressed ? null : num(m.n)} data={o1Cell("n", m, asOf)} />
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
    </div>
    </ExplainLayer>
  );
}
