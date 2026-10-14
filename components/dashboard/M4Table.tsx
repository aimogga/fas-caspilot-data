import type { ReactNode } from "react";
import { ResponsiveTable } from "@/components/layout";
import { SuppressedCell } from "@/components/trust";
import { M4_COLUMNS } from "@/lib/dashboard/cards";
import { bandLabel, num, pct } from "@/lib/dashboard/format";
import type { M4Result } from "@/lib/dashboard/metrics-query";

export const NUM = "text-left tabular-nums md:text-right";
const ROW = "border-t border-border", HEAD = "py-2 pr-3 text-left font-medium";
/** Column header for a stacked DS-01c table: numeric columns right-aligned from `md`. */
export function Th({ children, numeric = true }: { children: ReactNode; numeric?: boolean }) {
  return <th scope="col" className={`break-words py-2 pr-3 ${numeric ? NUM : "text-left"}`}>{children}</th>;
}
/** Body cell with its column label shown only when the table is stacked (below `md`); `null` renders `SuppressedCell`. */
export function Td({ label, value, numeric = true }: { label: string; value: ReactNode | null; numeric?: boolean }) {
  return (
    <td className={`min-w-0 break-words py-2 pr-3 align-top ${numeric ? NUM : "text-left"}`}>
      <span className="text-xs text-muted-foreground md:hidden">{label}: </span>{value === null ? <SuppressedCell /> : value}
    </td>
  );
}
const HIDDEN = "Hidden · protects another cell";
/** M4 body (DS-07c): one row per income band from `compute.m4` (F-306 suppression already applied), total row in the footer. */
export function M4Table({ data }: { data: M4Result }) {
  const [band, completed, closed, rate] = M4_COLUMNS, t = data.total;
  return (
    <ResponsiveTable stack>
      <caption className="sr-only">Completion rate by income band: completed and closed episodes with the completion rate.</caption>
      <thead><tr><Th numeric={false}>{band}</Th><Th>{completed}</Th><Th>{closed}</Th><Th>{rate}</Th></tr></thead>
      <tbody>
        {data.rows.map((r) => (
          <tr key={r.band} className={ROW} data-suppressed={r.suppressed || undefined} data-complementary={r.complementary || undefined}>
            <th scope="row" className={HEAD}>{bandLabel(r.band)}</th>
            {r.complementary ? <td colSpan={3} className="py-2 pr-3 text-sm text-muted-foreground">{HIDDEN}</td> : <>
              <Td label={completed} value={num(r.completed)} /><Td label={closed} value={num(r.closed)} />
              <Td label={rate} value={r.rate == null ? "—" : pct(r.rate)} />
            </>}
          </tr>
        ))}
      </tbody>
      {t ? <tfoot><tr className={`${ROW} font-medium`}><th scope="row" className={HEAD}>{bandLabel(t.band)}</th>
        <Td label={completed} value={num(t.completed)} /><Td label={closed} value={num(t.closed)} /><Td label={rate} value={t.rate == null ? "—" : pct(t.rate)} /></tr></tfoot> : null}
    </ResponsiveTable>
  );
}
