import type { ReactNode } from "react";
import { ResponsiveTable } from "@/components/layout";
import { SuppressedCell } from "@/components/trust";
import { ExplainLayer } from "@/components/trust/explain-layer";
import { M4_COLUMNS } from "@/lib/dashboard/cards";
import { bandLabel, num, pct } from "@/lib/dashboard/format";
import type { M4Result } from "@/lib/dashboard/metrics-query";
import { complementaryCell, DASH_TERMS, m4Cell, type CellData } from "@/lib/dashboard/words";

export const NUM = "text-left tabular-nums md:text-right";
const ROW = "border-t border-border", HEAD = "py-2 pr-3 text-left font-medium";
// DS-15a: cells are reading targets for the one explain card (arrow keys and tap), not Tab stops; the region around the table is the Tab stop.
const CELL = "min-w-0 break-words py-2 pr-3 align-top rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2";
/** Column header for a stacked DS-01c table: numeric columns right-aligned from `md`. */
export function Th({ children, numeric = true }: { children: ReactNode; numeric?: boolean }) {
  return <th scope="col" className={`break-words py-2 pr-3 ${numeric ? NUM : "text-left"}`}>{children}</th>;
}
/** Body cell with its column label shown only when the table is stacked (below `md`); `null` renders `SuppressedCell`. `data` makes it a target of an enclosing `ExplainLayer`. */
export function Td({ label, value, numeric = true, data }: { label: string; value: ReactNode | null; numeric?: boolean; data?: CellData }) {
  return (
    <td {...data} tabIndex={data ? -1 : undefined} className={`${CELL} ${numeric ? NUM : "text-left"}`}>
      <span className="text-xs text-muted-foreground md:hidden">{label}: </span>{value === null ? <SuppressedCell /> : value}
    </td>
  );
}
const HIDDEN = "Hidden · protects another cell";
/** The sr-only instruction every explain region (M4, M6, O1) describes itself with. */
export const KEYS = "Arrow keys move through the numbers and read what each one means; Enter keeps the explanation open and Escape closes it.";
/** M4 body (DS-07c): one row per income band from `compute.m4` (F-306 suppression already applied), total row in the footer.
 * DS-15a: every count and rate cell, the complementary row and the total row explain themselves through one `ExplainLayer`. */
export function M4Table({ data, asOf = "Not available yet" }: { data: M4Result; asOf?: string }) {
  const [band, completed, closed, rate] = M4_COLUMNS, t = data.total;
  const cells = (r: Parameters<typeof m4Cell>[1]) => <>
    <Td label={completed} value={num(r.completed)} data={m4Cell("completed", r, asOf)} /><Td label={closed} value={num(r.closed)} data={m4Cell("closed", r, asOf)} />
    <Td label={rate} value={r.rate == null ? "—" : pct(r.rate)} data={m4Cell("rate", r, asOf)} />
  </>;
  return (
    <ExplainLayer terms={DASH_TERMS}>
    <div role="region" tabIndex={0} aria-label="Completion by income band" aria-describedby="m4-table-keys" data-slot="m4-table" className="rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
      <p id="m4-table-keys" className="sr-only">{KEYS}</p>
      <ResponsiveTable stack>
        <caption className="sr-only">Completion rate by income band: completed and closed episodes with the completion rate.</caption>
        <thead><tr><Th numeric={false}>{band}</Th><Th>{completed}</Th><Th>{closed}</Th><Th>{rate}</Th></tr></thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.band} className={ROW} data-suppressed={r.suppressed || undefined} data-complementary={r.complementary || undefined}>
              <th scope="row" className={HEAD}>{bandLabel(r.band)}</th>
              {r.complementary ? <td colSpan={3} tabIndex={-1} {...complementaryCell(asOf)} className={`${CELL} text-sm text-muted-foreground`}>{HIDDEN}</td> : cells(r)}
            </tr>
          ))}
        </tbody>
        {t ? <tfoot><tr className={`${ROW} font-medium`}><th scope="row" className={HEAD}>{bandLabel(t.band)}</th>{cells(t)}</tr></tfoot> : null}
      </ResponsiveTable>
    </div>
    </ExplainLayer>
  );
}
