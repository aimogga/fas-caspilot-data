import type { LlmMeta } from '../llm';
import type { Term } from '../trust/glossary';
import type { CitationReport } from './citations';
import { StrategyDraftSchema, type StrategyDraft } from './schema';
import type { Fact, Snapshot } from './snapshot';

/** F-508f: pure helpers for the strategy draft screen. Everything shown comes from the stored `strategy_draft` row. */
export type DraftRow = {
  id: string; opportunity_id: string; status: 'DRAFT' | 'approved' | 'rejected' | 'failed'; output: unknown; snapshot: unknown; citation_report: unknown;
  model_meta: unknown; created_by: string | null; created_at: string; approved_by: string | null; approved_at: string | null;
};
export type DraftView = { kind: 'failed'; lines: string[] } | { kind: 'usable'; draft: StrategyDraft; facts: Map<string, Fact> } | { kind: 'unreadable' };

const KIND: Record<string, [word: string, plain: string, source: string]> = {
  opportunity: ['Opportunity', "The funder's own published opportunity record.", 'Grants.gov opportunity record'],
  opportunity_criteria: ['Criterion', 'A scoring criterion the funder published for this opportunity.', 'Opportunity criteria'],
  public_indicator: ['County data', 'A public county figure for a county FAS serves, from the newest release we hold.', 'Public data'],
  award_history_summary: ['Past awards', 'Count, median and range of similar past awards, worked out from stored award records.', 'USAspending and 990-PF award history'],
  award_history: ['Past award', 'One similar past award from the stored award records.', 'USAspending and 990-PF award history'],
  metric: ['FAS figure', 'A quarterly FAS figure from the team dashboard; counts under 11 are hidden.', 'FAS dashboard'],
  recipient_profile: ['Past winner', "Public Form 990 facts about an organization that won a similar award.", 'ProPublica Nonprofit Explorer (Form 990)'],
  award_abstract: ['Award summary', "The published summary of a similar past award. The draft may describe it but never copies its wording.", 'Award abstract'],
  org_knowledge: ['FAS fact', 'A fact about FAS that an admin approved for use in drafts.', 'FAS knowledge'],
};
const kindOf = (id: string) => KIND[id.split(':')[0] ?? ''] ?? ['Source', 'A stored row the draft was given.', 'Stored row'];
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`, MONEY = /award|amount|median|min|max|floor|ceiling/;
const month = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function factValue(f: Fact): string {
  return Object.entries(f.values).flatMap(([k, v]) => {
    if (v === null) return [];
    const words = k.replace(/_/g, ' ');
    if (/share|rate/.test(k) && v <= 1) return [`${words} ${Math.round(v * 1000) / 10}%`];
    return [`${words} ${MONEY.test(k) ? usd(v) : k === 'fiscal_year' ? v : v.toLocaleString('en-US')}`];
  }).join(' · ') || 'Hidden: fewer than 11 families or not published';
}

/** What a citation chip shows: the chip word and the explain card's term, value, source and as-of, all from the stored snapshot. */
export function citationFace(f: Fact, builtAt: string): { word: string; term: Term; value: string; source: string; asOf: string } {
  const [word, plain, source] = kindOf(f.citation_id);
  return { word, term: { id: `cite_${f.citation_id}`, title: f.label, plain }, value: factValue(f), source: f.source?.source_id ?? source, asOf: f.source?.vintage ?? month(builtAt) };
}

const where = (path: string) => path === 'suggested_ask' ? 'Suggested ask' : path === 'opportunity_id' ? 'Opportunity'
  : path.replace(/^criteria_map\[(\d+)\]/, (_, i) => `Criterion ${Number(i) + 1}`).replace(/\.evidence\[(\d+)\]\.claim/, (_, i) => `, evidence ${Number(i) + 1}`)
    .replace('.fas_position', ', FAS position').replace(/^(\w+)\[(\d+)\]$/, (_, k: string, i) => `${k.replace(/_/g, ' ')} ${Number(i) + 1}`);
function problemWords(p: string): string {
  const num = p.match(/^(\S+) has no matching cited value$/), missing = p.match(/^(\S+) is not in the snapshot$/), dead = p.match(/^(\S+) does not resolve$/);
  if (num) return `the number ${num[1]} does not match any source it cites`;
  if (missing) return `it cites ${missing[1]}, which was not in the data the draft was given`;
  if (dead) return `it cites ${dead[1]}, which could not be traced to a stored row`;
  return p.startsWith('no resolver for') ? 'it cites a kind of source we cannot check yet' : p;
}

/** The citation report in plain words for a failed draft. */
export function reportLines(r: CitationReport): string[] {
  const lines = [...r.claims.flatMap((c) => c.problems.map((p) => `${where(c.path)}: ${problemWords(p)}.`)),
    ...r.copied.map((c) => `${where(c.path)}: copies 12 or more words in a row from another organization's award description.`)];
  if (r.error === 'invalid_schema') lines.push('The answer was not in the expected format.');
  else if (Array.isArray(r.error)) lines.push(`The drafting service did not answer (${(r.error as { provider: string; status: unknown }[]).map((a) => `${a.provider}: ${a.status}`).join(', ')}).`);
  if (r.rounds) lines.push(`Tried ${r.rounds} ${r.rounds === 1 ? 'time' : 'times'}.`);
  return lines.length ? lines : ['The draft did not pass the citation check.'];
}

/** A failed row never renders as usable; a usable row must parse against the schema and carry its snapshot. */
export function toView(row: Pick<DraftRow, 'status' | 'output' | 'snapshot' | 'citation_report'>): DraftView {
  if (row.status === 'failed') return { kind: 'failed', lines: reportLines((row.citation_report ?? { ok: false, claims: [], copied: [] }) as CitationReport) };
  const parsed = StrategyDraftSchema.safeParse(row.output), s = row.snapshot as Snapshot | null;
  if (!parsed.success || !Array.isArray(s?.facts)) return { kind: 'unreadable' };
  return { kind: 'usable', draft: parsed.data, facts: new Map(s.facts.map((f) => [f.citation_id, f])) };
}

/** Footer words: model, generated at, review state. `you` when the viewer is the approver; the user table holds no names yet. */
export function footerWords(row: Pick<DraftRow, 'model_meta' | 'created_at' | 'status' | 'approved_by' | 'approved_at'>, viewer: string | null) {
  const meta = (Array.isArray(row.model_meta) ? row.model_meta : []) as LlmMeta[], last = meta.at(-1);
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Denver' });
  const who = row.approved_by && row.approved_by === viewer ? 'you' : 'an admin';
  return { model: last ? `${last.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'} · ${last.model}` : 'Model not recorded',
    generated: `Generated ${day(row.created_at)}`,
    review: row.status === 'approved' && row.approved_at ? `Approved by ${who} on ${day(row.approved_at)}` : row.status === 'rejected' ? 'Rejected by an admin' : row.status === 'failed' ? 'Failed drafts cannot be reviewed' : 'Not reviewed yet: an admin approves or rejects' };
}
