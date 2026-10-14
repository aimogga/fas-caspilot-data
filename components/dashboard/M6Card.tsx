import { ResponsiveTable } from "@/components/layout";
import { Td, Th } from "@/components/dashboard/M4Table";
import { SuppressedCell } from "@/components/trust";
import { GROUP_LABELS, M6_COLUMNS } from "@/lib/dashboard/cards";
import { money, num, pct } from "@/lib/dashboard/format";
import type { M6Result } from "@/lib/dashboard/metrics-query";

const SEG = ["bg-[var(--chart-1)]", "bg-[var(--chart-2)]"], HEAD = "py-2 pr-3 text-left font-medium";
/** M6 body (DS-07c): share of dollars by provider group, labeled in text (never colour alone), then the rate table with both groups always listed. */
export function M6Card({ data }: { data: M6Result }) {
  const [group, rate, dollars, episodes] = M6_COLUMNS, share = data.affiliatedShare;
  const shares = [share, share == null ? null : 1 - share];
  return (
    <div className="flex flex-col gap-3">
      <p data-slot="m6-share" className="text-sm font-medium">
        {data.groups.map((g, i) => <span key={g.group}>{i ? " · " : ""}{GROUP_LABELS[g.group]} {shares[i] == null ? <SuppressedCell /> : pct(shares[i])}</span>)}
      </p>
      {share == null ? null : (
        <div aria-hidden className="flex h-3 w-full overflow-hidden rounded-sm bg-muted">
          {shares.map((s, i) => <span key={i} className={SEG[i]} style={{ width: `${Math.round((s ?? 0) * 100)}%` }} />)}
        </div>
      )}
      <ResponsiveTable stack>
        <caption className="sr-only">Therapy dollars by provider group: average rate per hour, dollars paid and episodes.</caption>
        <thead><tr><Th numeric={false}>{group}</Th><Th>{rate}</Th><Th>{dollars}</Th><Th>{episodes}</Th></tr></thead>
        <tbody>
          {data.groups.map((g) => (
            <tr key={g.group} className="border-t border-border" data-group={g.group}>
              <th scope="row" className={HEAD}>{GROUP_LABELS[g.group]}</th>
              <Td label={rate} value={money(g.avgRatePerUnit)} /><Td label={dollars} value={money(g.dollars)} /><Td label={episodes} value={num(g.episodes)} />
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
    </div>
  );
}
