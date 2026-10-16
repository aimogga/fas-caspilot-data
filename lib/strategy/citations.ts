import type { StrategyDraft } from './schema';
import type { Fact, Snapshot } from './snapshot';

/** Checks one cited fact against its kind's rules. Pure: the snapshot already holds the rows read from the database. */
export type Resolver = (ref: string, fact: Fact) => boolean;
export type ClaimCheck = { path: string; text: string; citation_ids: string[]; numbers: number[]; problems: string[] };
export type CitationReport = { ok: boolean; claims: ClaimCheck[]; copied: { path: string; citation_id: string; words: string }[]; error?: unknown; rounds?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid: Resolver = (ref) => UUID.test(ref);
/** Registry of citation kinds for tables on this branch. Registration points, when those modules land:
 * `registerResolver('org_knowledge', …)` (#225), `registerResolver('recipient_profile', …)` (#228), `registerResolver('award_abstract', …)` (#229). */
export const RESOLVERS = new Map<string, Resolver>([
  ['opportunity', uuid],
  ['opportunity_criteria', uuid],
  ['public_indicator', (ref, f) => uuid(ref, f) && !!f.source?.source_id && !!f.source?.vintage],
  ['award_history', uuid],
  ['award_history_summary', uuid], // ref is the opportunity id the summary was computed for
  ['metric', (ref, f) => /^(m[1-6]|o1):\d{4}-Q[1-4]$/.test(ref) && Object.values(f.values).some((v) => v !== null)],
]);
export function registerResolver(kind: string, resolver: Resolver): void {
  RESOLVERS.set(kind, resolver);
}

/** Every number written in a text: `$1,200`, `12.5%`, `1.2 million`. Bare years (1900–2099) and digits glued to letters (FY2024, Q3, M1) are not claims. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/(?<![\w.])(\$)?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)(?:\s*(million|thousand|billion|k)\b)?/gi)) {
    const [, dollar, digits, scale] = m, n = Number((digits as string).replace(/,/g, ''));
    if (!dollar && !scale && /^(19|20)\d\d$/.test(digits as string)) continue;
    out.push(n * ({ thousand: 1e3, k: 1e3, million: 1e6, billion: 1e9 }[(scale ?? '').toLowerCase()] ?? 1));
  }
  return out;
}

/** A written number matches a stored value at its own rounding (or 0.5%); fractions (rates, |v| ≤ 1) also match as percents. */
export const matches = (n: number, facts: Fact[]) => facts.some((f) => Object.values(f.values).some((v) => v !== null &&
  (Math.abs(v) <= 1 ? [v, v * 100] : [v]).some((c) => Math.abs(n - c) <= Math.max(0.005 * Math.abs(c), 0.5 * (Number.isInteger(n) ? 1 : 0.1)))));

/** 12+ consecutive words shared with a stored award description or abstract. */
export function copyHits(texts: { path: string; text: string }[], abstracts: Snapshot['abstracts'], n = 12): CitationReport['copied'] {
  const words = (t: string) => t.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const grams = new Map<string, string>();
  for (const a of abstracts) { const w = words(a.text); for (let i = 0; i + n <= w.length; i++) grams.set(w.slice(i, i + n).join(' '), a.citation_id); }
  const hits: CitationReport['copied'] = [];
  for (const { path, text } of texts) {
    const w = words(text);
    for (let i = 0; i + n <= w.length; i++) {
      const g = w.slice(i, i + n).join(' '), id = grams.get(g);
      if (id) { hits.push({ path, citation_id: id, words: g }); break; }
    }
  }
  return hits;
}

/** The cited fact, or why it does not count: not in the snapshot, no registered resolver for its kind, or the resolver refuses it. */
export function resolveFact(byId: Map<string, Fact>, id: string): Fact | string {
  const f = byId.get(id), [kind = '', ...rest] = id.split(':'), r = RESOLVERS.get(kind);
  if (!f) return `${id} is not in the snapshot`;
  if (!r) return `no resolver for ${kind}`;
  return r(rest.join(':'), f) ? f : `${id} does not resolve`;
}

/** Pure citation validator: every number in fas_position, evidence claims and suggested_ask must match a value of a cited fact that is in the snapshot and resolves. */
export function validateDraft(d: StrategyDraft, s: Snapshot): CitationReport {
  const byId = new Map(s.facts.map((f) => [f.citation_id, f])), resolve = (id: string) => resolveFact(byId, id);
  const check = (path: string, text: string, ids: string[], numbers = numbersIn(text)): ClaimCheck => {
    const got = ids.map(resolve), facts = got.filter((g): g is Fact => typeof g !== 'string');
    const problems = [...got.filter((g): g is string => typeof g === 'string'), ...numbers.filter((n) => !matches(n, facts)).map((n) => `${n} has no matching cited value`)];
    return { path, text, citation_ids: ids, numbers, problems };
  };
  const claims = d.criteria_map.flatMap((c, i) => [
    check(`criteria_map[${i}].fas_position`, c.fas_position, c.evidence.map((e) => e.citation_id)),
    ...c.evidence.map((e, j) => check(`criteria_map[${i}].evidence[${j}].claim`, e.claim, [e.citation_id])),
  ]);
  if (d.suggested_ask) claims.push(check('suggested_ask', `${d.suggested_ask.low} to ${d.suggested_ask.high}`, d.suggested_ask.basis_citation_ids, [d.suggested_ask.low, d.suggested_ask.high]));
  if (d.opportunity_id !== s.opportunity_id) claims.push({ path: 'opportunity_id', text: d.opportunity_id, citation_ids: [], numbers: [], problems: ['opportunity_id is not the snapshot opportunity'] });
  const strings: { path: string; text: string }[] = [];
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'string') strings.push({ path, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
  };
  walk(d, '');
  const copied = copyHits(strings, s.abstracts);
  return { ok: claims.every((c) => c.problems.length === 0) && copied.length === 0, claims, copied };
}
