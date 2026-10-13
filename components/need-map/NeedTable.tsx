import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { ResponsiveTable } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";

const NUM = "text-left tabular-nums md:text-right!";
const STICKY = "bg-background md:sticky md:left-0 md:z-10";

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return <td className={`min-w-0 break-words py-2 pr-3 align-top ${NUM}`}><span className="text-xs text-muted-foreground md:hidden">{label}: </span>{children}</td>;
}

export function NeedTable({ data }: { data: NeedTableData }) {
  return (
    <div role="region" tabIndex={0} aria-label="County need table" data-slot="need-table" className="w-full max-w-full overflow-x-auto">
      <ResponsiveTable stack>
        <caption className="sr-only">Utah counties by need rank, with public indicators</caption>
        <thead>
          <tr>
            <th scope="col" className={STICKY}>County</th>
            <th scope="col" aria-sort="ascending" className={NUM}>Rank</th>
            <th scope="col" className={NUM}>Need score</th>
            <th scope="col" className={NUM}>Bin (placeholder)</th>
            {data.columns.map((c) => (
              <th key={c.code} scope="col" className={`${NUM} align-bottom`}>{c.label}<span className="block text-xs font-normal text-muted-foreground">{c.note}</span></th>
            ))}
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.fips} data-fips={row.fips} aria-label={NeedMapQuery.rowLabel(row)} className="border-t border-border">
              <th scope="row" className={`py-2 pr-3 text-left font-medium ${STICKY}`}>
                {row.name}{row.fas ? <Badge variant="info" className="ml-2 align-middle" prefix={<MapPin aria-hidden />}>FAS county</Badge> : null}
              </th>
              <Cell label="Rank">{row.rank}</Cell>
              <Cell label="Need score">{row.score}</Cell>
              <Cell label="Bin (placeholder)">{row.bin}</Cell>
              {data.columns.map((c) => <Cell key={c.code} label={`${c.label} (${c.note})`}>{row.cells[c.code]}</Cell>)}
              <td className="py-2 pr-3 align-top"><span className="text-xs text-muted-foreground md:hidden">Status: </span>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </ResponsiveTable>
    </div>
  );
}
