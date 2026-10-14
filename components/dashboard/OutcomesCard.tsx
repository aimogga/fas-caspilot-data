import { ResponsiveTable } from "@/components/layout";
import { Td, Th } from "@/components/dashboard/M4Table";
import { O1_COLUMNS } from "@/lib/dashboard/cards";
import { num, pct, signed } from "@/lib/dashboard/format";
import type { O1Result } from "@/lib/dashboard/metrics-query";
import { Instrument } from "@/lib/metrics/instruments";

/** O1 body (DS-07c, F-305): one row per active instrument with its direction note; rates and n hide together under 11 pairs. */
export function OutcomesCard({ data }: { data: O1Result }) {
  const [measure, mean, improved, n] = O1_COLUMNS;
  return (
    <ResponsiveTable stack>
      <caption className="sr-only">Outcome change per measure: mean change from baseline to follow-up, share improved and number of scored pairs.</caption>
      <thead><tr><Th numeric={false}>{measure}</Th><Th>{mean}</Th><Th>{improved}</Th><Th>{n}</Th></tr></thead>
      <tbody>
        {data.measures.map((m) => (
          <tr key={m.code} className="border-t border-border" data-measure={m.code} data-suppressed={m.suppressed || undefined}>
            <th scope="row" className="py-2 pr-3 text-left font-medium">{m.label}<span className="block text-xs font-normal text-muted-foreground">{Instrument.directionNote(m.code)}</span></th>
            <Td label={mean} value={signed(m.meanChange)} /><Td label={improved} value={pct(m.shareImproved)} /><Td label={n} value={m.suppressed ? null : num(m.n)} />
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}
