import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { M4_COLUMNS, NOT_AVAILABLE, notAvailableNote } from "@/lib/dashboard/cards";

const NUMERIC = new Set<string>(["Completed", "Closed", "Rate"]);

export function M4Table() {
  return (
    <section aria-labelledby="card-m4-title" data-slot="metric-card" data-state="not-available">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            <h2 id="card-m4-title" className="text-base font-semibold">Completion rate by income band</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full table-fixed border-collapse text-sm tabular-nums">
            <caption className="sr-only">Completion rate by income band. {NOT_AVAILABLE}.</caption>
            <thead>
              <tr>
                {M4_COLUMNS.map((column) => (
                  <th key={column} scope="col" className={NUMERIC.has(column) ? "break-words p-2 text-right" : "break-words p-2 text-left"}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={M4_COLUMNS.length} className="p-2">
                  <p className="font-medium">{NOT_AVAILABLE}</p>
                  <p className="text-muted-foreground">{notAvailableNote("M4")}</p>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
