/** F-508h Word export (D-004): an approved application draft as a `Packet`, rendered by the existing lib/packets/docx.ts builder. */
import type { Packet, SectionId } from '../packets/model';
import { ApplicationError } from './generate';
import type { LoadedApplication } from './query';
import { factWords } from './review';

export const HEADER = 'DRAFT, prepared with AI assistance; review before submission';
export const NOT_APPROVED_EXPORT = 'Only an approved application draft can be downloaded.';
const month = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Not available yet');

/** Sections under the funder's headings, then a Sources appendix (every cited row: label, id, source with its vintage, and the month the snapshot was read) and an Assumptions appendix. */
export function applicationPacket({ draft, snapshot, title }: LoadedApplication, now: Date): Packet {
  if (draft.status !== 'approved') throw new ApplicationError(NOT_APPROVED_EXPORT);
  const facts = new Map(snapshot.facts.map((f) => [f.citation_id, f])), cited = [...new Set(draft.sections.flatMap((s) => s.citation_ids))];
  const sources = cited.map((id) => [id, facts.get(id)] as const).map(([id, f]) => ({ label: f?.label ?? 'Not in the stored snapshot', value: `id ${id}`, kind: 'value' as const, sourceLabel: f ? factWords(f).source : 'missing', asOf: month(snapshot.built_at) }));
  const assumptions = draft.sections.flatMap((s) => s.assumptions.map((a) => `${s.heading}: ${a}`));
  const section = (id: string, t: string, paragraphs: string[], source: string, figures: Packet['sections'][number]['figures'] = []) => ({ id: id as SectionId, title: t, paragraphs, figures, source });
  return {
    variant: 'grant', scope: {}, scopeLabel: 'Application', period: '', pictures: [], title, header: HEADER, ribbon: HEADER,
    prepared: `Prepared ${month(now.toISOString())}`, asOf: `Approved ${month(draft.approved_at)}`, footer: 'FAS Evidence · FAS submits through the funder’s own portal',
    sections: [
      ...draft.sections.map((s) => section(s.key, s.heading, s.body.split(/\n{2,}/).filter(Boolean), `Funder criterion: ${s.criterion}`)),
      section('sources', 'Sources', cited.length ? [] : ['No stored rows are cited.'], 'Every row is stored in FAS Evidence with its source and date.', sources),
      section('assumptions', 'Assumptions', assumptions.length ? assumptions : ['No assumptions were recorded.'], 'Assumptions are not facts; confirm each before submission.'),
    ],
  };
}

export const applicationFilename = (p: Packet, now: Date) => `fas-application-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}-${now.toISOString().slice(0, 7)}.docx`;
