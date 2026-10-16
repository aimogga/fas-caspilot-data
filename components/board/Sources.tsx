import { Provenance } from "@/components/trust/explain";
/** DS-13b: the sources paragraph at the foot of the board page and the print sheet; the FAS records clause is a `Provenance` trigger so it explains itself like every footer. */
export function Sources({ text, period, n, asOf, footer }: { text: string; period: string; n: number; asOf: string; footer: string }) {
  const [fas, ...rest] = text.split(/(?<=\.) /);
  return (
    <footer data-slot="board-sources" className="flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
      <p className="max-w-prose"><span className="font-medium text-foreground">Sources. </span><Provenance source="FAS records" period={period} n={`= ${n}`} asOf={asOf}>{fas}</Provenance> {rest.join(" ")}</p>
      <p data-slot="board-page-footer" className="hidden print:block">{footer}</p>
    </footer>
  );
}
