import { Grid, PageHeader, Stack } from "@/components/layout";
import { M4Table } from "@/components/dashboard/M4Table";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { METRIC_CARDS } from "@/lib/dashboard/cards";

export default function DashboardPage() {
  const [m1, ...rest] = METRIC_CARDS;
  return (
    <Stack gap={6}>
      <PageHeader eyebrow="WORKSPACE" title="Team dashboard" />
      <MetricCard card={m1} />
      <Grid cols={3}>
        {rest.slice(0, 3).map((card) => <MetricCard key={card.id} card={card} />)}
      </Grid>
      <Grid cols={2}>
        <M4Table />
        {rest.slice(3).map((card) => <MetricCard key={card.id} card={card} />)}
      </Grid>
    </Stack>
  );
}
