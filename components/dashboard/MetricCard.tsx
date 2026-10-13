import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOT_AVAILABLE, notAvailableNote, type DashboardCard } from "@/lib/dashboard/cards";

export function MetricCard({ card }: { card: DashboardCard }) {
  const headingId = `card-${card.id}-title`;
  return (
    <section aria-labelledby={headingId} data-slot="metric-card" data-state="not-available">
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            <h2 id={headingId} className="text-base font-semibold">{card.title}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{NOT_AVAILABLE}</p>
          <p className="text-sm text-muted-foreground">{notAvailableNote(card.metricName)}</p>
        </CardContent>
      </Card>
    </section>
  );
}
