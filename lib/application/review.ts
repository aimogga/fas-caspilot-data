/** F-508h: pure review of a stored application draft. The editor, approval and the server actions all read these, so the page and the gate agree. */
import { claimChecker, numbersIn } from '../strategy/citations';
import type { Fact, Snapshot } from '../strategy/snapshot';
import { checkSection, type Section } from './generate';
import { limitProblems, wordCount, type SectionPlan } from './sections';

export const UNCITED = 'This number has no source. Add a source or remove it before approval.', NO_LIMIT = 'No limit stated';
export const PORTAL_NOTE = 'FAS submits through the funder’s own portal. This page never submits, emails or sends anything.';
export type SectionReview = { words: string; over: string[]; uncited: number[]; blocked: boolean };

const plan = (s: Section): SectionPlan => ({ key: s.key, heading: s.heading, criterion: s.criterion, points: s.points, limit: s.limit, citation_id: null });

/** "312 of 500 words" against the stated limit, or "312 words · No limit stated". */
export function wordsLabel(s: Section): string {
  const w = wordCount(s.body), l = s.limit;
  if (l.kind === 'none_stated') return `${w} words · ${NO_LIMIT}`;
  if (l.kind === 'characters') return `${s.body.length} of ${l.value} characters`;
  return `${w} of ${l.max_words} words${l.kind === 'pages' ? ` (${l.value} ${l.value === 1 ? 'page' : 'pages'})` : ''}`;
}

/** Numbers in the body that match no value of a fact the section cites (the edit warning; non-blocking to save, blocking to approve). */
export function uncitedNumbers(s: Section, snapshot: Snapshot): number[] {
  const bad = new Set(claimChecker(snapshot)(s.key, s.body, s.citation_ids).problems.filter((p) => p.endsWith('has no matching cited value')).map((p) => Number(p.split(' ')[0])));
  return numbersIn(s.body).filter((n) => bad.has(n));
}

export function reviewSection(s: Section, snapshot: Snapshot): SectionReview {
  const over = limitProblems(plan(s), s.body), uncited = uncitedNumbers(s, snapshot);
  return { words: wordsLabel(s), over, uncited, blocked: s.status === 'needs_edit' || over.length > 0 || uncited.length > 0 };
}

/** Why approval is blocked, one line per section; empty means an admin may approve. */
export function approvalBlockers(sections: Section[], snapshot: Snapshot): string[] {
  if (!sections.length) return ['There are no sections to approve.'];
  return sections.flatMap((s) => (reviewSection(s, snapshot).blocked ? [`${s.heading} still needs an edit.`] : []));
}

/** A staff edit: new body, then the same checks the writer ran (citations, limit, 12-word copy). Returns the full new sections list. */
export function applyEdit(sections: Section[], key: string, body: string, snapshot: Snapshot): Section[] {
  return sections.map((s) => {
    if (s.key !== key) return s;
    const next = { ...s, body }, reasons = checkSection(plan(s), next, snapshot);
    return { ...next, status: reasons.length ? 'needs_edit' : 'ok', reasons };
  });
}

/** Plain words for a citation chip: the stored fact's label, values, source and vintage or as-of. */
export function factWords(f: Fact): { kind: string; value: string; source: string; asOf?: string } {
  const kind = f.citation_id.split(':')[0] ?? '', value = Object.entries(f.values).filter(([, v]) => v !== null).map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`).join(' · ');
  const source = f.source?.source_id ? `${f.source.source_id}${f.source.vintage ? ` ${f.source.vintage}` : ''}` : KIND[kind] ?? kind;
  return { kind: KIND[kind] ?? kind, value, source, asOf: f.source?.vintage ?? undefined };
}
const KIND: Record<string, string> = { opportunity: 'Funding opportunity', opportunity_criteria: 'Funder criterion', public_indicator: 'Public data', award_history: 'Past award', award_history_summary: 'Past awards summary', metric: 'FAS records' };
