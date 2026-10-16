import { ResponsiveTable } from "@/components/layout";
import { KEYS, Td, Th } from "@/components/dashboard/M4Table";
import { SuppressedCell } from "@/components/trust";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { GROUP_LABELS, M6_COLUMNS } from "@/lib/dashboard/cards";
import { money, num, pct } from "@/lib/dashboard/format";
import type { M6Result } from "@/lib/dashboard/metrics-query";
import { DASH_TERMS, m6Cell, m6Segment } from "@/lib/dashboard/words";

const SEG = ["bg-[var(--chart-1)]", "bg-[var(--chart-2)]"], HEAD = "py-2 pr-3 text-left font-medium";
// DS-15b: the share words and the bar segments are reading targets of the one explain card (pointer, arrow keys, tap), not Tab stops; the region is the Tab stop.
const TARGET = "rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";
/** M6 body (DS-07c): share of dollars by provider group, labeled in text (never colour alone), then the rate table with both groups always listed.
 * DS-15b: each share, bar segment and table cell explains itself through one `ExplainLayer`; Left and Right walk the segments and the cells. */
export function M6Card({ data, asOf = "Not available yet" }: { data: M6Result; asOf?: string }) {
  const [group, rate, dollars, episodes] = M6_COLUMNS, share = data.affiliatedShare;
  const shares = [share, share == null ? null : 1 - share];
  const segment = (i: number) => m6Segment(data.groups[i]?.group ?? "", shares[i] ?? null, data.groups[i]?.dollars ?? null, asOf);
  return (
    <ExplainLayer terms={DASH_TERMS}>
    <div role="region" tabIndex={0} aria-label="Where therapy dollars went" aria-describedby="m6-keys" data-slot="m6-card" className="flex flex-col gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
      <p id="m6-keys" className="sr-only">{KEYS}</p>
      <p data-slot="m6-share" className="text-sm font-medium">
        {data.groups.map((g, i) => <span key={g.group}>{i ? " · " : ""}<span {...segment(i)} tabIndex={-1} className={TARGET}>{GROUP_LABELS[g.group]} {shares[i] == null ? <SuppressedCell /> : pct(shares[i])}</span></span>)}
      </p>
      {share == null ? null : (
        <div data-slot="m6-bar" className="flex h-4 w-full overflow-hidden rounded-sm bg-muted">
          {shares.map((s, i) => <span key={i} role="img" aria-label={segment(i)["data-value"]} {...segment(i)} tabIndex={-1} className={`${SEG[i]} ${TARGET}`} style={{ width: `${Math.round((s ?? 0) * 100)}%` }} />)}
        </div>
      )}
      <ResponsiveTable stack>
        <caption className="sr-only">Therapy dollars by provider group: average rate per hour, dollars paid and episodes.</caption>
        <thead><tr><Th numeric={false}>{group}</Th><Th>{rate}</Th><Th>{dollars}</Th><Th>{episodes}</Th></tr></thead>
        <tbody>
          {data.groups.map((g) => (
            <tr key={g.group} className="border-t border-border" data-group={g.group}>
              <th scope="row" className={HEAD}>{GROUP_LABELS[g.group]}</th>
              <Td label={rate} value={money(g.avgRatePerUnit)} data={m6Cell("rate", g, asOf)} /><Td label={dollars} value={money(g.dollars)} data={m6Cell("dollars", g, asOf)} />
              <Td label={episodes} value={num(g.episodes)} data={m6Cell("episodes", g, asOf)} />
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
    </div>
    </ExplainLayer>
  );
}
