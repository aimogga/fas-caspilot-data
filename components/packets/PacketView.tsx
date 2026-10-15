import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Grid } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import type { Picture } from "@/lib/board/pictures";
import { quarterLabel } from "@/lib/dashboard/filters";
import { PICTURE_SECTION, SECTION_TITLES, type Packet, type PacketSection } from "@/lib/packets/model";
/** F-403 packet body: cover, the six sections with their figure tiles, and the board's pictures (F-402) inside the FAS results and Outcomes sections. */
export function PacketView({ packet }: { packet: Packet }) {
  return (
    <article data-slot="packet" className="flex flex-col gap-10">
      <header data-slot="packet-cover" className="flex flex-col gap-3 rounded-lg border p-6">
        <p data-slot="packet-ribbon" className="text-sm font-semibold uppercase tracking-wide text-warning">{packet.ribbon}</p>
        <p data-slot="packet-title" className="font-serif text-2xl font-semibold">{packet.title}</p>
        <p className="text-sm text-muted-foreground">{packet.prepared} · {packet.asOf}</p>
        <ol className="list-decimal pl-5 text-sm">{packet.sections.map((s) => <li key={s.id}>{SECTION_TITLES[s.id]}</li>)}</ol>
      </header>
      {packet.sections.map((s) => <PacketSectionView key={s.id} section={s} pictures={packet.pictures.filter((p) => PICTURE_SECTION[p.id] === s.id)} period={packet.period} />)}
      <p data-slot="packet-footer" className="text-xs text-muted-foreground">{packet.footer}</p>
    </article>
  );
}
function PacketSectionView({ section: s, pictures, period }: { section: PacketSection; pictures: Picture[]; period: string }) {
  return (
    <section data-slot="packet-section" id={s.id} className="flex flex-col gap-4">
      <h2 className="font-serif text-xl font-semibold">{s.title}</h2>
      {s.paragraphs.map((t, i) => <p key={i} className="max-w-prose leading-7">{t}</p>)}
      {s.figures.length ? <dl data-slot="packet-figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {s.figures.map((f, i) => <div key={i} className="rounded-md border p-3"><dt className="text-sm text-muted-foreground">{f.label}</dt><dd className="text-lg font-semibold tabular-nums">{f.value}</dd><dd className="text-xs text-muted-foreground">{f.sourceLabel} · as of {f.asOf}</dd></div>)}
      </dl> : null}
      {pictures.length ? <div data-slot="packet-pictures"><Grid cols={2}>
          {pictures.map(({ id, kind, n, asOf, ...p }) => (
            <Card key={id} data-picture={id} className="h-full">
              <CardContent>{kind === "line" ? <LineChart {...p} footer={{ source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf }} periodHead="Quarter" /> : <BarChart {...p} footer={{ source: "FAS records", period: quarterLabel(period), n: `= ${n}`, asOf }} />}</CardContent>
            </Card>
          ))}
      </Grid></div> : null}
      <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{s.source}</p>
    </section>
  );
}
