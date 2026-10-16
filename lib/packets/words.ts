/** Plain words for the evidence packet page (DS-17, D-040): the term behind each figure tile, the data attributes one `ExplainLayer` reads off a tile, the section
 * eyebrow and headline in words, and one sentence per control and per download. Pure. */
import { METRIC_CARDS, NOT_AVAILABLE } from '../dashboard/cards';
import { NEED_TERMS } from '../need-map/terms';
import { term, whyHidden, type Term } from '../trust/glossary';
import type { Figure, Packet } from './model';

export type CellData = { 'data-term': string; 'data-value'?: string; 'data-source'?: string; 'data-asof'?: string; 'data-hidden'?: string };
const FEWER = 'fewer than 11', HIDDEN = 'hidden';
const INDICATOR_PLAIN = 'A public measure for this county from the source named on the tile, in the release shown.';

/** Packet-only terms; the metrics and the hidden reasons stay in the shared glossary, the indicators in the need-map terms. */
export const PACKET_TERMS: Record<string, Term> = {
  o1_change: { id: 'o1_change', title: 'Outcome change', plain: "How much families' survey scores moved on average between the start and end of therapy, on this instrument. A negative change on a distress scale means they felt better." },
  o1_improved: { id: 'o1_improved', title: 'Families who improved', plain: 'The share of families whose score on this instrument moved in the better direction between the start and end of therapy.' },
  rate_per_hour: { id: 'rate_per_hour', title: 'Average rate per hour', plain: 'What FAS paid per hour of therapy, on average, to this group of providers this quarter.' },
  weight: { id: 'weight', title: 'Weight in the need score', plain: 'How much this public measure counts toward the county need score. Shown as a fraction of 1 and as a share of the whole.' },
  service_counties: { id: 'service_counties', title: 'Service counties', plain: 'The Utah counties where FAS currently funds therapy, from FAS settings.' },
};
const metricId = (label: string) => METRIC_CARDS.find((c) => c.title === label)?.id;
const indicatorId = (label: string) => Object.values(NEED_TERMS).find((t) => t.id.startsWith('ind:') && t.title === label)?.id;

/** The term id for one figure: a metric by its title, an outcome row by its suffix, a weight by its value, an indicator by its need-map title, else a per-label fallback. */
export function figureTermId(f: Figure): string {
  if (f.label === 'Share of dollars to affiliated providers') return 'm6';
  if (f.label === 'Service counties') return 'service_counties';
  if (f.label.endsWith(' mean change')) return 'o1_change';
  if (f.label.endsWith(' share improved')) return 'o1_improved';
  if (f.label.endsWith(' average rate per hour')) return 'rate_per_hour';
  if (f.value.startsWith('weight ')) return 'weight';
  return metricId(f.label) ?? indicatorId(f.label) ?? `fig:${f.label}`;
}
/** The record one `ExplainLayer` reads: packet terms, the need-map indicators, and a fallback titled with the label for any figure nothing else names. */
export function packetTerms(p: Packet): Record<string, Term> {
  const out: Record<string, Term> = { ...PACKET_TERMS, ...NEED_TERMS };
  for (const f of p.sections.flatMap((s) => s.figures)) {
    const id = figureTermId(f);
    if (!out[id] && id.startsWith('fig:')) out[id] = { id, title: f.label, plain: INDICATOR_PLAIN };
  }
  return out;
}
/** Why a figure's value is hidden, or undefined when it is shown. */
export const figureHidden = (value: string): string | undefined =>
  value === FEWER ? whyHidden('suppressed') : value === HIDDEN ? whyHidden('complementary') : value === NOT_AVAILABLE ? whyHidden('not_available') : undefined;
/** The attributes for one figure tile: the value only when shown, the tile's own source and as-of, and the sentence when it is hidden. */
export function figureCell(f: Figure): CellData {
  const hidden = figureHidden(f.value);
  return { 'data-term': figureTermId(f), 'data-value': hidden ? undefined : f.value, 'data-source': f.sourceLabel, 'data-asof': f.asOf, 'data-hidden': hidden };
}
/** The term for a figure outside the layer (tests, future table views). */
export const figureTerm = (f: Figure): Term => PACKET_TERMS[figureTermId(f)] ?? NEED_TERMS[figureTermId(f)] ?? (figureTermId(f).startsWith('fig:') ? { id: figureTermId(f), title: f.label, plain: INDICATOR_PLAIN } : term(figureTermId(f)));

/** `Section 2 of 6 · FAS results`. */
export const sectionEyebrow = (index: number, total: number, title: string): string => `Section ${index + 1} of ${total} · ${title}`;
/** The section's first sentence as its headline in words; the rest of that paragraph and the other paragraphs follow as body. */
export function sectionLead(paragraphs: string[]): { lead: string; body: string[] } {
  const [first = '', ...others] = paragraphs, [lead = '', ...rest] = first.split(/(?<=\.)\s+(?=[A-Z])/);
  const tail = rest.join(' ');
  return { lead, body: [...(tail ? [tail] : []), ...others] };
}

/** One sentence beside each control label. */
export const CONTROL_HINTS: Record<string, string> = {
  variant: 'Grant attachment is for a funder and can be statewide or one county. Board packet is for the board and is always statewide.',
  county: 'Limits the grant attachment to one Utah county. Counts under 11 families stay hidden.',
};
/** One sentence beside each download: what the file holds and that dates are month or quarter only. */
export const DOWNLOAD_HINTS: Record<'docx' | 'csv', string> = {
  docx: 'A Word file of this packet: cover, six sections, figures and pictures. Dates are by month or quarter only and counts under 11 stay hidden.',
  csv: 'A spreadsheet of the figures only: one row each with label, value, source, as-of month and status, no paragraphs. Dates are by month or quarter only.',
};
