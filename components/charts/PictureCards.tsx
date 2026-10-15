import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Grid } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import type { Picture } from "@/lib/board/pictures";
import { quarterLabel } from "@/lib/dashboard/filters";

export type PictureCard = Omit<Picture, "id"> & { id: string };
/** One card per picture (line or bar) with the FAS records footer for the period; the board, the team dashboard and the evidence packet all draw pictures this way. */
export function PictureCards({ pictures, period, cols = 2 }: { pictures: PictureCard[]; period: string; cols?: 2 | 3 }) {
  return (
    <Grid cols={cols}>
      {pictures.map(({ id, kind, n, asOf, ...p }) => {
        const footer = { source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf };
        return (
          <Card key={id} data-picture={id} className="h-full">
            <CardContent>{kind === "line" ? <LineChart {...p} footer={footer} periodHead="Quarter" /> : <BarChart {...p} footer={footer} />}</CardContent>
          </Card>
        );
      })}
    </Grid>
  );
}
