import { PictureCards } from "@/components/charts/PictureCards";
import { ExplainLayer } from "@/components/trust/explain-layer";
import type { Picture } from "@/lib/board/pictures";
import { asOfNote } from "@/lib/dashboard/cards";
import { PICTURE_SECTION, SECTION_TITLES, type Figure, type Packet, type PacketSection } from "@/lib/packets/model";
import { figureCell, packetTerms, sectionEyebrow, sectionLead } from "@/lib/packets/words";

const EYEBROW = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const TILE = "flex flex-col gap-1 rounded-md border border-border bg-card p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const KEYS = "Each figure explains itself: Tab or arrow keys move through the figures, Enter keeps the explanation open and Escape closes it.";
/** F-403 packet body: cover, the six sections with their figure tiles, and the board's pictures (F-402) inside the FAS results and Outcomes sections.
 * DS-17: every tile is a target of one `ExplainLayer`; each section carries an eyebrow and a serif headline in words. */
export function PacketView({ packet }: { packet: Packet }) {
  const total = packet.sections.length;
  return (
    <article data-slot="packet" className="flex flex-col gap-10">
      <header data-slot="packet-cover" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
        <p data-slot="packet-ribbon" className="text-sm font-semibold uppercase tracking-wide text-warning">{packet.ribbon}</p>
        <p data-slot="packet-title" className="font-serif text-2xl font-semibold">{packet.title}</p>
        <p className="text-sm text-muted-foreground">{packet.prepared} · {packet.asOf}</p>
        {packet.preparedFor ? <p data-slot="packet-for" className="text-sm font-medium break-words">{packet.preparedFor}</p> : null}
        <ol className="list-decimal pl-5 text-sm">{packet.sections.map((s) => <li key={s.id}>{SECTION_TITLES[s.id]}</li>)}</ol>
      </header>
      <p className="sr-only">{KEYS}</p>
      <ExplainLayer terms={packetTerms(packet)} className="flex flex-col gap-10">
        {packet.sections.map((s, i) => <PacketSectionView key={s.id} section={s} eyebrow={sectionEyebrow(i, total, s.title)} pictures={packet.pictures.filter((p) => PICTURE_SECTION[p.id] === s.id)} period={packet.period} />)}
      </ExplainLayer>
      <p data-slot="packet-footer" className="text-xs text-muted-foreground">{packet.footer}</p>
    </article>
  );
}
/** Label → value → source · as of. A short value gets the numeral size; a list or a weight stays at body size; a hidden value wears the one hatch and the card says why. */
function FigureTile({ f }: { f: Figure }) {
  const cell = figureCell(f), hidden = cell["data-hidden"] != null, big = !hidden && f.value.length <= 12;
  return (
    <div data-slot="packet-figure" tabIndex={0} {...cell} className={TILE}>
      <dt className="text-sm text-muted-foreground">{f.label}</dt>
      <dd className={big ? "font-semibold tabular-nums text-3xl leading-none" : "font-medium"}>{hidden ? <span data-slot="suppressed" className="rounded-sm px-1 text-base font-normal">{f.value}</span> : f.value}</dd>
      <dd className="text-xs text-muted-foreground">{f.sourceLabel} · {asOfNote(f.asOf)}</dd>
    </div>
  );
}
function PacketSectionView({ section: s, eyebrow, pictures, period }: { section: PacketSection; eyebrow: string; pictures: Picture[]; period: string }) {
  const { lead, body } = sectionLead(s.paragraphs);
  return (
    <section data-slot="packet-section" id={s.id} aria-labelledby={`${s.id}-lead`} className="flex flex-col gap-4 border-t border-border pt-8">
      <p data-slot="section-eyebrow" className={EYEBROW}>{eyebrow}</p>
      <h2 id={`${s.id}-lead`} className="max-w-prose font-serif text-2xl font-semibold leading-snug">{lead || s.title}</h2>
      {body.map((t, i) => <p key={i} className="max-w-prose leading-7">{t}</p>)}
      {s.figures.length ? <dl data-slot="packet-figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{s.figures.map((f, i) => <FigureTile key={i} f={f} />)}</dl> : null}
      {pictures.length ? <div data-slot="packet-pictures"><PictureCards pictures={pictures} period={period} /></div> : null}
      <p data-slot="source-footer" className="text-xs font-medium tracking-wide text-muted-foreground">{s.source}</p>
    </section>
  );
}
