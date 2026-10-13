import type { ReactNode } from "react";
import { ResponsiveTable } from "@/components/layout";
import { NeedMapQuery, type NeedTableData } from "@/lib/need-map/query";

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return <td className="min-w-0 break-words py-2 pr-3 align-top"><span className="text-xs text-muted-foreground md:hidden">{label}: </span>{children}</td>;
}

export function NeedTable({ data }: { data: NeedTableData }) {
  return (
    <ResponsiveTable stack>
      <caption className="sr-only">Utah counties by need rank, with public indicators</caption>
      <thead>
        <tr>
          <th scope="col">County</th>
          <th scope="col" aria-sort="ascending">Rank</th>
          <th scope="col">Need score</th>
          <th scope="col">Bin</th>
          {data.codes.map((code) => <th key={code} scope="col">{NeedMapQuery.label(code)}</th>)}
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row) => (
          <tr key={row.fips} data-fips={row.fips} className="border-t border-border">
            <th scope="row" className="py-2 pr-3 text-left font-medium">{row.name}</th>
            <Cell label="Rank">{row.rank}</Cell>
            <Cell label="Need score">{row.score}</Cell>
            <Cell label="Bin">{row.bin}</Cell>
            {data.codes.map((code) => <Cell key={code} label={NeedMapQuery.label(code)}>{row.cells[code]}</Cell>)}
            <Cell label="Status">{row.status}</Cell>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  );
}
