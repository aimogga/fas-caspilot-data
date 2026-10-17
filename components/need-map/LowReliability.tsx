import { TriangleAlert } from "lucide-react";
import { ExplainCard } from "@/components/trust/explain";
import { Badge } from "@/components/ui/badge";
import { flagRows, LOW_RELIABILITY, type ShownFlag } from "@/lib/need-score/reliability";

/** F-210c (D-040): the marker says "Low reliability" in words, names the input and CV, and opens a card with the source row. Never colour alone. */
export function LowReliability({ flag }: { flag: ShownFlag }) {
  return (
    <ExplainCard term={LOW_RELIABILITY} rows={flagRows(flag)} className="rounded-full no-underline">
      <Badge variant="warning" data-slot="low-reliability" data-code={flag.code} prefix={<TriangleAlert aria-hidden />}>Low reliability · {flag.label}, CV {flag.cv.toFixed(1)}%</Badge>
    </ExplainCard>
  );
}
