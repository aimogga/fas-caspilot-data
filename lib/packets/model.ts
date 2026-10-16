/** F-403 part 1: evidence packet content model (pure). Every number is a `Figure` with a source label and an as-of month; dates are month/quarter
 * strings only; values hidden by F-306 read `fewer than 11` (n under 11) or `hidden` (complementary suppression). Rendering and assertions sit on top. */
import { boardPictures, type Picture } from '../board/pictures';
import { sentences } from '../board/summary';
import { asOfLabel, asOfNote, GROUP_LABELS, METRIC_CARDS, NOT_AVAILABLE } from '../dashboard/cards';
import { quarterLabel } from '../dashboard/filters';
import { days, money, pct, signed } from '../dashboard/format';
import type { DashboardMetrics, Loaded, Wired } from '../dashboard/metrics-query';
import type { MethodologyView } from '../methodology/query';
import type { NeedTableData } from '../need-map/query';
import { NeedMapQuery } from '../need-map/query';
import { COUNTIES } from '../synthetic/generate';

export type PacketVariant = 'grant' | 'board';
export type PacketScope = { county?: string };
export type SectionId = 'need-profile' | 'fas-results' | 'outcomes' | 'methodology-sources' | 'suppression-note' | 'related-party';
export type Figure = { label: string; value: string; kind: 'count' | 'value'; sourceLabel: string; asOf: string };
export type PacketSection = { id: SectionId; title: string; paragraphs: string[]; figures: Figure[]; source: string };
export type Packet = {
  variant: PacketVariant; scope: PacketScope; title: string; scopeLabel: string; prepared: string; asOf: string; period: string; ribbon: string; footer: string; sections: PacketSection[];
  /** Running page header on every DOCX page (F-508h application export); packets leave it unset. */ header?: string;
  /** The board's pictures (F-402), drawn inside the section each one belongs to on the page and in the DOCX (SVG + caption); empty when no metric loaded. The CSV carries figures only. */ pictures: Picture[];
};
/** Which section each picture sits in. */
export const PICTURE_SECTION: Record<Picture['id'], SectionId> = { wait: 'fas-results', completion: 'fas-results', dollars: 'fas-results', outcomes: 'outcomes' };
export type PacketInput = {
  variant: PacketVariant; scope: PacketScope; now: Date; period: string; asOf: string;
  metrics: DashboardMetrics | null; need: NeedTableData | null; method: MethodologyView | null; serviceCounties: string[];
};
export const VARIANT_LABEL: Record<PacketVariant, string> = { grant: 'Grant attachment', board: 'Board packet' }, RIBBON = 'DRAFT · for review';
export const SECTION_TITLES: Record<SectionId, string> = {
  'need-profile': 'County need profile', 'fas-results': 'FAS results', outcomes: 'Outcomes', 'methodology-sources': 'Methodology and sources', 'suppression-note': 'Suppression note', 'related-party': 'Related-party disclosure' };
export const SUPPRESSION_COPY = [
  'Counts under 11 are hidden, with complementary suppression so a hidden value cannot be recovered from totals or other cells. Rates, medians and changes built on a hidden count are hidden too.',
  'Geography is county-level only. Dates are shown by month or quarter, never exact dates. This packet contains no case-level records, clinical notes, diagnoses, substance-use details or court documents.',
];
export const RELATED_PARTY_COPY = 'FAS pays its sister practice, Connections Counseling Services, for some of the therapy it funds. The share of therapy dollars going to affiliated providers is always shown with the average hourly rate for affiliated and other providers.';
const FEWER = 'fewer than 11', HIDDEN = 'hidden';
export const countyName = (fips: string | undefined): string | null => { const c = COUNTIES.find((x) => x.fips === fips); return c ? `${c.name} County` : null; };
/** Effective scope: the board packet is always statewide; a grant packet is statewide unless a known county is given. */
export function scopeLabel(variant: PacketVariant, scope: PacketScope): string { return (variant === 'grant' && countyName(scope.county)) || 'Statewide'; }
const ok = <T extends Wired>(m: Loaded<T> | undefined): m is T & Wired => !!m && !('error' in m);
/** A hidden value reads `fewer than 11` when the section's n is under 11 and `hidden` when complementary suppression removed it. */
const shown = (v: string | null, n: number): string => v ?? (n < 11 ? FEWER : HIDDEN);
const fig = (label: string, value: string, asOf: string, src: string, kind: Figure['kind'] = 'value'): Figure => ({ label, value, kind, sourceLabel: src, asOf });
const title = (id: string) => METRIC_CARDS.find((c) => c.id === id)?.title ?? id;
/** Need indicators from the need-map column note `Census SAHIE 2023 · as of Oct 2026`. */
const splitNote = (note: string): [string, string] => { const [src, asOf] = note.split(' · as of '); return [src ?? note, asOf ?? NOT_AVAILABLE]; };
export function needProfile(x: PacketInput): PacketSection {
  const fas = `FAS records · ${asOfNote(x.asOf)}`, rows = x.need?.rows ?? [], src = x.need?.footer ?? NOT_AVAILABLE, county = x.variant === 'grant' ? countyName(x.scope.county) : null;
  // `rank` is `14 of 26`: the denominator is the number of counties with a score for this version, not Utah's 29 counties, so say so.
  const scored = rows.filter((r) => r.status === 'Ranked').length, total = x.need?.counties.length ?? COUNTIES.length, coverage = `${scored} of ${total} counties scored`;
  const row = county ? rows.find((r) => r.name === county) : undefined;
  if (county && row) {
    // DS-06b keeps the as-of month in `sources` (the column note is `<source> <vintage>`); older notes with ` · as of ` still parse.
    const figures = (x.need?.columns ?? []).map((c) => { const [s, a] = splitNote(c.note); return fig(c.label, row.cells[c.code] ?? NOT_AVAILABLE, x.need?.sources?.find((q) => q.code === c.code)?.asOf ?? a, s); });
    const rank = row.status === 'Ranked' ? `ranks ${row.rank} Utah counties with a need score (version ${x.need?.version}, score ${row.score}; ${coverage})` : `has no published need score (${row.status})`;
    return { id: 'need-profile', title: SECTION_TITLES['need-profile'], paragraphs: [`${county} ${rank}. Public indicators for the county are listed below with their source and vintage.`], figures, source: src };
  }
  const top = rows.filter((r) => r.status === 'Ranked').slice(0, 5).map((r) => `${r.name} (rank ${r.rank})`);
  const paragraphs = [top.length ? `Highest-need Utah counties on the FAS need score (version ${x.need?.version}; ${coverage}): ${top.join(', ')}.` : 'The county need score is not available yet.'];
  if (x.variant === 'board') paragraphs.push(x.serviceCounties.length ? `FAS service counties: ${x.serviceCounties.join(', ')}.` : 'FAS service counties are not available yet.');
  return { id: 'need-profile', title: SECTION_TITLES['need-profile'], paragraphs, figures: x.variant === 'board' ? [fig('Service counties', x.serviceCounties.join(', ') || NOT_AVAILABLE, x.asOf, 'FAS records')] : [], source: top.length ? src : fas };
}
export function fasResults(x: PacketInput): PacketSection {
  const m = x.metrics, src = `FAS records · ${quarterLabel(x.period)}`, f: Figure[] = [];
  const w = <T extends Wired>(id: string, l: Loaded<T> | undefined, v: (t: T) => string | null) => { if (ok(l)) f.push(fig(title(id), shown(v(l), l.n), l.asOf, src)); };
  w('m1', m?.m1, (v) => days(v.median)); w('m2', m?.m2, (v) => days(v.median)); w('m3', m?.m3, (v) => pct(v.share)); w('m5', m?.m5, (v) => money(v.costPerCompleted));
  w('m4', m?.m4, (v) => pct(v.total?.rate)); w('m6', m?.m6, (v) => pct(v.affiliatedShare));
  const paragraphs = [sentences.m1(m?.m1), sentences.m2(m?.m2), sentences.m3(m?.m3), sentences.m5(m?.m5), sentences.m4(m?.m4), sentences.m6(m?.m6)].filter((s): s is string => !!s);
  return { id: 'fas-results', title: SECTION_TITLES['fas-results'], paragraphs: paragraphs.length ? paragraphs : ['This quarter’s numbers are not available yet.'], figures: f, source: `${src} · ${asOfNote(x.asOf)}` };
}
export function outcomes(x: PacketInput): PacketSection {
  const o = x.metrics?.o1, src = `FAS records · ${quarterLabel(x.period)}`;
  const figures = ok(o) ? o.measures.filter((m) => m.n > 0).flatMap((m) => [fig(`${m.code} mean change`, shown(signed(m.meanChange), m.n), o.asOf, src), fig(`${m.code} share improved`, shown(pct(m.shareImproved), m.n), o.asOf, src)]) : [];
  return { id: 'outcomes', title: SECTION_TITLES.outcomes, paragraphs: [sentences.o1(o) ?? 'Outcome measures are not available yet.', 'Lower scores are better on every active instrument; change is follow-up minus baseline.'], figures, source: `${src} · ${asOfNote(x.asOf)}` };
}
export function methodologySources(x: PacketInput): PacketSection {
  const v = x.method, period = quarterLabel(x.period);
  const figures = v ? v.weights.map((w) => { const i = v.inputs.find((r) => r.key === w.key); return fig(w.label, `weight ${w.weight} (${w.share})`, i?.asOf ?? NOT_AVAILABLE, `${i?.source ?? NOT_AVAILABLE} ${i?.vintage ?? ''}`.trim()); }) : [];
  const paragraphs = [v ? `Need score version ${v.version}, approved ${v.approvedLabel}: a weighted score of the public inputs below (weights sum to ${v.sum}).${v.synthetic ? ' Synthetic placeholder weights are in use.' : ''}` : 'Need score methodology is not available yet.',
    `FAS results cover ${period} and compare to the quarter before. Metric definitions follow the FAS Evidence methodology (M1–M6, O1); suppression follows the rule in the suppression note.`,
    `Sources: ${v ? v.inputs.map((i) => `${i.source} (${i.vintage}, ${asOfNote(i.asOf)})`).join('; ') : NOT_AVAILABLE}; FAS records (${asOfNote(x.asOf)}).`];
  return { id: 'methodology-sources', title: SECTION_TITLES['methodology-sources'], paragraphs, figures, source: v?.footer ?? `FAS records · ${asOfNote(x.asOf)}` };
}
export function relatedParty(x: PacketInput): PacketSection {
  const m = x.metrics?.m6, src = `FAS records · ${quarterLabel(x.period)}`, rate = (g: string) => (ok(m) ? m.groups.find((r) => r.group === g)?.avgRatePerUnit : null);
  const figures = ok(m) ? [fig('Share of dollars to affiliated providers', shown(pct(m.affiliatedShare), m.n), m.asOf, src),
    ...(['affiliated', 'other'] as const).map((g) => fig(`${GROUP_LABELS[g]} average rate per hour`, shown(money(rate(g)), m.n), m.asOf, src))] : [];
  return { id: 'related-party', title: SECTION_TITLES['related-party'], paragraphs: [RELATED_PARTY_COPY, sentences.m6(m) ?? 'The split of therapy dollars is not available yet.'], figures, source: `${src} · ${asOfNote(x.asOf)}` };
}
export function buildPacket(x: PacketInput): Packet {
  const prepared = NeedMapQuery.monthYear(x.now.toISOString()), scope = scopeLabel(x.variant, x.scope);
  const suppression: PacketSection = { id: 'suppression-note', title: SECTION_TITLES['suppression-note'], paragraphs: SUPPRESSION_COPY, figures: [], source: 'FAS Evidence privacy rules' };
  return {
    variant: x.variant, scope: x.scope, title: `FAS Evidence packet · ${VARIANT_LABEL[x.variant]} · ${scope}`, scopeLabel: scope, prepared: `Prepared ${prepared}`, asOf: asOfLabel(x.asOf),
    period: x.period, ribbon: RIBBON, footer: `FAS Evidence · Counts under 11 are hidden · ${prepared}`,
    sections: [needProfile(x), fasResults(x), outcomes(x), methodologySources(x), suppression, relatedParty(x)], pictures: boardPictures(x.metrics),
  };
}
