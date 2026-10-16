// F-508d: why past winners fit the published criteria, as labeled inference. Criteria extraction and the overlap score are pure code;
// one generateJson call words patterns from stored facts only, and the output is rejected unless every statement cites resolving rows.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z, ZodError } from 'zod';
import { AwardHistoryQuery, keywords, type SimilarAward } from '../grants/award-history';
import { generateJson, LlmError, type LlmMeta } from '../llm';
import { copyHits, matches, numbersIn, registerResolver, resolveFact, type CitationReport, type ClaimCheck, type Resolver } from './citations';
import { assertPrivate, indicatorFacts, loadServiceIndicators, must, type Fact, type IndicatorRow, type Snapshot } from './snapshot';

/** Column subsets of recipient_profile (#228), award_abstract (#229) and org_knowledge (#225), named as on those branches. */
export type ProfileRow = { id: string; award_history_id: string | null; recipient: string; ntee_code: string | null; ruling_year: number | null; latest_tax_year: number | null;
  total_revenue: number | null; total_expenses: number | null; program_service_expenses: number | null; contributions_share: number | null; match_confidence: 'high' | 'medium' | 'low' | 'none' };
export type AbstractRow = { id: string; award_history_id: string; source: string; status: 'published' | 'not_published' | 'fetch_failed'; text: string | null; word_count: number | null; reason: string | null };
export type KnowledgeRow = { id: string; category: string; title: string; body: string; source: string | null; as_of: string | null; version: number };

export type Criterion = { key: string; heading: string; points: number; word_limit: number | null; page_limit: number | null; text: string; location: { ref: string; line: number } };
export type Extraction = { criteria: Criterion[]; note: string | null };
/** A heading line ends in its points: "Need for the Project (20 points)", "Approach — 30 pts", "Statement of Need (Maximum 25 points)". */
const POINTS = /\s*[([–—:-]\s*(?:(?:maximum|max\.?|up to)\s+(?:of\s+)?)?(\d{1,3})\s*(?:points?|pts?)\.?\s*[)\]]?\s*$/i;
const NUMBERING = /^\s*(?:(?:evaluation\s+)?(?:criterion|criteria|section|part|factor)\s+[\w.]+\s*[:.–—-]\s*|[A-Z0-9]{1,3}[.)]\s+)/i;
const LIMIT = /(?:limit(?:ed)?(?: to)?|maximum(?: of)?|max\.?|not (?:to )?exceed|up to|no more than)[:\s]*(\d[\d,]*)\s*(words?|pages?)\b|(\d[\d,]*)[\s-]*(words?|pages?)\s*(?:limit|max)/i;

/** Pure: evaluation criteria (heading, points, word or page limit, the line it sits on) from stored NOFO text. Says so when it finds none. */
export function extractCriteria(text: string | null, ref: string): Extraction {
  const criteria: Criterion[] = [];
  let open = false;
  (text ?? '').split(/\r?\n/).forEach((raw, i) => {
    const m = POINTS.exec(raw), heading = m ? raw.slice(0, m.index).replace(NUMBERING, '').replace(/[\s:–—-]+$/, '').trim() : '';
    if (m && /^total\b/i.test(heading)) open = false;
    else if (m && heading && heading.split(/\s+/).length <= 12) {
      criteria.push({ key: `C${criteria.length + 1}`, heading, points: Number(m[1]), word_limit: null, page_limit: null, text: '', location: { ref: `${ref}#L${i + 1}`, line: i + 1 } });
      open = true;
    } else if (open) {
      const c = criteria.at(-1) as Criterion, l = LIMIT.exec(raw);
      c.text = `${c.text} ${raw.trim()}`.trim().slice(0, 1200);
      if (l) c[/^w/i.test(l[2] ?? l[4] ?? '') ? 'word_limit' : 'page_limit'] ??= Number((l[1] ?? l[3] ?? '').replace(/,/g, ''));
    }
  });
  return { criteria, note: criteria.length ? null : 'No evaluation criteria with points were found in the stored NOFO text, so winners are not compared criterion by criterion.' };
}

/** NTEE major groups in plain terms, so a Form 990 profile adds words a criterion may use. */
const NTEE: Record<string, string> = { B: 'education', E: 'health', F: 'mental health counseling', I: 'crime legal courts justice', O: 'youth', P: 'human services family families' };
export type Overlap = { award_history_id: string; criterion: string; score: number; shared: string[] };
/** Deterministic: share of a criterion's terms found in the winner's published abstracts and profile (NTEE) terms, to 3 decimals. */
export function overlapScores(winners: SimilarAward[], criteria: Criterion[], profiles: ProfileRow[], abstracts: AbstractRow[]): Overlap[] {
  return winners.flatMap((w) => {
    const ntee = profiles.find((p) => p.award_history_id === w.id && p.match_confidence !== 'none')?.ntee_code?.[0]?.toUpperCase();
    const terms = keywords(...abstracts.filter((a) => a.award_history_id === w.id && a.status === 'published').map((a) => a.text), ntee ? NTEE[ntee] : null);
    return criteria.map((c) => {
      const want = keywords(c.heading, c.text), shared = [...want].filter((t) => terms.has(t)).sort();
      return { award_history_id: w.id, criterion: c.key, score: want.size ? Math.round((shared.length / want.size) * 1000) / 1000 : 0, shared: shared.slice(0, 8) };
    });
  });
}

export type WinnerInput = { opportunity: { id: string; description: string | null }; winners: SimilarAward[]; profiles: ProfileRow[]; abstracts: AbstractRow[];
  knowledge: KnowledgeRow[]; indicators: IndicatorRow[]; now: Date };
/** Pure: only whitelisted fields become facts. Abstract text and award descriptions stay out (copy guard only); their overlap and shared terms go in. */
export function winnerFacts(x: WinnerInput, overlap: Overlap[]): Fact[] {
  return [
    ...x.winners.map((w) => {
      const o = overlap.filter((v) => v.award_history_id === w.id);
      return { citation_id: w.source_ref, label: `${w.recipient} (${w.recipient_state ?? 'state unknown'}), FY${w.fiscal_year ?? '?'}`,
        values: { amount: w.amount, fiscal_year: w.fiscal_year, ...Object.fromEntries(o.map((v) => [`overlap_${v.criterion}`, v.score])) },
        text: o.map((v) => `${v.criterion} shared terms: ${v.shared.join(', ') || 'none'}`).join('; ') || undefined };
    }),
    ...x.profiles.map((p) => ({ citation_id: `recipient_profile:${p.id}`, label: `Form 990 profile of ${p.recipient} (${p.match_confidence} confidence match)`,
      values: { total_revenue: p.total_revenue, total_expenses: p.total_expenses, program_service_expenses: p.program_service_expenses,
        contributions_share: p.contributions_share, ruling_year: p.ruling_year, latest_tax_year: p.latest_tax_year }, text: p.ntee_code ? `NTEE ${p.ntee_code}` : undefined })),
    ...x.abstracts.map((a) => ({ citation_id: `award_abstract:${a.id}`, label: `Abstract (${a.source}) for award_history:${a.award_history_id}`,
      values: { word_count: a.word_count }, text: a.status === 'published' ? 'published' : `${a.status}: ${a.reason ?? 'no reason stored'}` })),
    ...x.knowledge.map((k) => ({ citation_id: `org_knowledge:${k.id}@v${k.version}`, label: `FAS: ${k.title}`, text: k.body, source: { source: k.source, as_of: k.as_of },
      values: Object.fromEntries(numbersIn(k.body).map((n, i) => [`n${i + 1}`, n])) })),
    ...indicatorFacts(x.indicators),
  ];
}

const Statement = z.object({ label: z.literal('INFERENCE'), statement: z.string().min(1), citation_ids: z.array(z.string()).min(1) });
export const WinnerAnalysisSchema = z.object({ opportunity_id: z.string(), patterns: z.array(Statement), fas_comparison: z.array(Statement), unknowns: z.array(z.string()) });
export type WinnerAnalysis = z.infer<typeof WinnerAnalysisSchema>;
export const ALLOWED = ['award_history', 'recipient_profile', 'award_abstract', 'org_knowledge', 'public_indicator'];
export const APPLICATIONS_NOT_PUBLIC = 'The applications themselves are not public: nobody outside the funder knows what any past winner wrote. Everything above is inferred from public award records, abstracts and Form 990 facts.';

export const WINNER_SYSTEM = [
  'You explain, for Family Advocacy Services (FAS), what past winners of similar grants had in common and how that lines up with the published scoring criteria. Answer with JSON matching the schema.',
  'Everything you write is inference from public records: label every pattern and comparison "INFERENCE" and never claim to know what any winner wrote in its application.',
  'Use only FACTS. Every statement cites one or more citation_ids from FACTS. Every number in a statement must be a value of a fact it cites. Never invent statistics.',
  'Overlap values (overlap_C1, …) and shared terms were computed in code from abstracts and Form 990 profiles: describe them, do not recompute them. Name criteria by heading; do not write their points or limits.',
  'fas_comparison compares FAS (org_knowledge and public_indicator facts) with those patterns. Put what the facts cannot tell you in unknowns, without numbers.',
  'opportunity_id is the FACTS opportunity_id. Never copy text from award abstracts.',
].join('\n');
export const buildWinnerPrompt = (s: Snapshot, e: Extraction): string =>
  `CRITERIA\n${JSON.stringify(e.criteria.map(({ key, heading }) => ({ key, heading })))}\n\nFACTS\n${JSON.stringify({ opportunity_id: s.opportunity_id, facts: s.facts })}`;

/** Pure: every statement cites only allowed kinds that are in the facts and resolve; its numbers match a cited value; unknowns carry no numbers; no 12-word copy. */
export function validateAnalysis(a: WinnerAnalysis, s: Snapshot): CitationReport {
  const byId = new Map(s.facts.map((f) => [f.citation_id, f]));
  const check = (path: string, text: string, ids: string[]): ClaimCheck => {
    const got = ids.map((id) => (ALLOWED.includes(id.split(':')[0] as string) ? resolveFact(byId, id) : `${id} is not an allowed citation kind`));
    const facts = got.filter((g): g is Fact => typeof g !== 'string'), numbers = numbersIn(text.replace(/\bForm\s+990(?:-PF)?\b/gi, 'Form')); // a form name, not a claim
    return { path, text, citation_ids: ids, numbers, problems: [...got.filter((g): g is string => typeof g === 'string'), ...numbers.filter((n) => !matches(n, facts)).map((n) => `${n} has no matching cited value`)] };
  };
  const claims = [
    ...a.patterns.map((p, i) => check(`patterns[${i}]`, p.statement, p.citation_ids)), ...a.fas_comparison.map((p, i) => check(`fas_comparison[${i}]`, p.statement, p.citation_ids)),
    ...a.unknowns.map((u, i) => check(`unknowns[${i}]`, u, [])),
  ];
  if (a.opportunity_id !== s.opportunity_id) claims.push({ path: 'opportunity_id', text: a.opportunity_id, citation_ids: [], numbers: [], problems: ['opportunity_id is not the analysed opportunity'] });
  const copied = copyHits(claims.map(({ path, text }) => ({ path, text })), s.abstracts);
  return { ok: claims.every((c) => c.problems.length === 0) && copied.length === 0, claims, copied };
}

export type WinnerResult = { status: 'INFERENCE' | 'rejected'; output: WinnerAnalysis | null; criteria: Extraction; overlap: Overlap[]; snapshot: Snapshot; report: CitationReport; model_meta: LlmMeta[] };
/** One generateJson call per analysis. Unknowns always open with APPLICATIONS_NOT_PUBLIC (and the missing-criteria note); a failed check is `rejected`, never retried. */
export async function analyzeWinners(x: WinnerInput, generate: typeof generateJson = generateJson): Promise<WinnerResult> {
  const criteria = extractCriteria(x.opportunity.description, `opportunity:${x.opportunity.id}.description`), overlap = overlapScores(x.winners, criteria.criteria, x.profiles, x.abstracts);
  const snapshot = assertPrivate({ opportunity_id: x.opportunity.id, built_at: x.now.toISOString(), facts: winnerFacts(x, overlap), abstracts: [
    ...x.winners.filter((w) => w.description).map((w) => ({ citation_id: w.source_ref, text: w.description as string })),
    ...x.abstracts.filter((a) => a.text).map((a) => ({ citation_id: `award_abstract:${a.id}`, text: a.text as string })),
  ] });
  const base = { criteria, overlap, snapshot }, fixed = [APPLICATIONS_NOT_PUBLIC, ...(criteria.note ? [criteria.note] : [])];
  try {
    const res = await generate({ system: WINNER_SYSTEM, prompt: buildWinnerPrompt(snapshot, criteria), schema: WinnerAnalysisSchema });
    const data = WinnerAnalysisSchema.parse(res.data), output = { ...data, unknowns: [...fixed, ...data.unknowns.filter((u) => !fixed.includes(u))] };
    const report = validateAnalysis(output, snapshot);
    return { ...base, status: report.ok ? 'INFERENCE' : 'rejected', output, report, model_meta: [res.meta] };
  } catch (e) {
    if (!(e instanceof LlmError || e instanceof ZodError)) throw e;
    return { ...base, status: 'rejected', output: null, report: { ok: false, claims: [], copied: [], error: e instanceof LlmError ? e.attempts : 'invalid_schema' }, model_meta: [] };
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// recipient_profile (#228) and award_abstract (#229) resolve through the base RESOLVERS in citations.ts.
/** Kinds whose table may not exist yet. org_knowledge cites the immutable version a citation quotes. */
export const WINNER_RESOLVERS: Record<string, [table: string, Resolver]> = {
  org_knowledge: ['org_knowledge_version', (ref) => new RegExp(`^${UUID}@v[1-9]\\d*$`, 'i').test(ref)],
};
/** Registers each pending kind only once its table exists. TODO(#225): register org_knowledge unconditionally after it merges. */
export async function registerWinnerResolvers(tableExists: (table: string) => Promise<boolean>): Promise<string[]> {
  const done: string[] = [];
  for (const [kind, [table, r]] of Object.entries(WINNER_RESOLVERS)) if (await tableExists(table)) { registerResolver(kind, r); done.push(kind); }
  return done;
}
/** PostgREST answers PGRST205 (or Postgres 42P01) for a table that is not in the schema; anything else, an RLS refusal included, means it exists. */
export const tableExists = (client: SupabaseClient) => async (table: string): Promise<boolean> => {
  const { error } = await client.from(table).select('*', { head: true, count: 'exact' }).limit(1);
  return !(error && ['PGRST205', '42P01'].includes(error.code));
};

export type WinnerLoaders = { profiles(awardIds: string[]): Promise<ProfileRow[]>; abstracts(awardIds: string[]): Promise<AbstractRow[]>; knowledge(): Promise<KnowledgeRow[]> };
/** Reads under the caller's RLS (admin/staff SELECT) for the given awards. TODO(#225): knowledge via lib/knowledge/store listApproved(); nothing until then. */
export const dbLoaders = (client: SupabaseClient): WinnerLoaders => ({
  profiles: async (ids) => (ids.length ? must(await client.from('recipient_profile').select(PROFILE_COLS).in('award_history_id', ids)) as ProfileRow[] : []),
  abstracts: async (ids) => (ids.length ? must(await client.from('award_abstract').select(ABSTRACT_COLS).in('award_history_id', ids)) as AbstractRow[] : []),
  knowledge: async () => [],
});
const PROFILE_COLS = 'id,award_history_id,recipient,ntee_code,ruling_year,latest_tax_year,total_revenue,total_expenses,program_service_expenses,contributions_share,match_confidence';
const ABSTRACT_COLS = 'id,award_history_id,source,status,text,word_count,reason';

/** Reads under the caller's RLS: the opportunity's NOFO text, its top 5 similar awards, FAS-county indicators, then recipient_profile and award_abstract rows for those awards (loaders injectable). */
export async function loadWinnerInput(client: SupabaseClient, opportunityId: string, loaders: WinnerLoaders = dbLoaders(client), now = new Date()): Promise<WinnerInput> {
  const opportunity = must(await client.from('opportunity').select('id,description').eq('id', opportunityId).single()) as WinnerInput['opportunity'];
  const [{ similar }, indicators] = await Promise.all([AwardHistoryQuery.forOpportunity(client, opportunityId, 5), loadServiceIndicators(client)]);
  const ids = similar.map((w) => w.id), [profiles, abstracts, knowledge] = await Promise.all([loaders.profiles(ids), loaders.abstracts(ids), loaders.knowledge()]);
  return { opportunity, winners: similar, profiles, abstracts, knowledge, indicators, now };
}
