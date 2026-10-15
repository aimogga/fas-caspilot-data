// F-505 weekly grant digest (pure). Picks the new matches at or above the digest threshold and renders them as plain text and simple HTML.
// Nothing here is FAS client data: opportunity titles, funders, close dates and fit scores only. n8n sends the email; the app never does.
import { DEFAULT_EVAL_THRESHOLD } from './eval';

export type DigestRow = { id: string; title: string; funder: string | null; closeDate: string | null; postedDate: string | null; computedAt: string; score: number; eligibility: string };
export type Digest = { subject: string; text: string; html: string; count: number; threshold: number; since: string; rows: DigestRow[] };
export const DEFAULT_DIGEST_DAYS = 7;
const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** `params.digest_threshold`, else the eval threshold, else 60 (docs/GRANT_MATCHING.md: the digest threshold). */
export function digestThreshold(params: unknown): number {
  const p = (params ?? {}) as { digest_threshold?: unknown; eval_threshold?: unknown };
  for (const v of [p.digest_threshold, p.eval_threshold]) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return DEFAULT_EVAL_THRESHOLD;
}

/** Start of the window: `days` back from `now`, as a date. */
export const sinceDate = (now: Date, days = DEFAULT_DIGEST_DAYS): string => day(new Date(now.getTime() - days * DAY_MS));

/** New = posted inside the window, or (no posted date) first scored inside the window. Open (close date null or ≥ today), score ≥ threshold. */
export function selectNew(rows: DigestRow[], now: Date, threshold: number, days = DEFAULT_DIGEST_DAYS): DigestRow[] {
  const since = sinceDate(now, days), today = day(now);
  return rows
    .filter((r) => r.score >= threshold && (r.closeDate === null || r.closeDate >= today))
    .filter((r) => (r.postedDate !== null ? r.postedDate >= since && r.postedDate <= today : r.computedAt.slice(0, 10) >= since))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function buildDigest(rows: DigestRow[], now: Date, params: unknown, days = DEFAULT_DIGEST_DAYS): Digest {
  const threshold = digestThreshold(params), since = sinceDate(now, days), picked = selectNew(rows, now, threshold, days);
  const subject = `FAS Evidence · ${picked.length} new grant match${picked.length === 1 ? '' : 'es'} this week`;
  const line = (r: DigestRow) => `${r.title} · ${r.funder ?? 'Funder not recorded'} · closes ${r.closeDate ? fmt(r.closeDate) : 'no close date'} · fit ${Math.round(r.score)} · ${r.eligibility}`;
  const intro = `New grant matches scoring ${threshold} or higher since ${fmt(since)}.`;
  const none = 'No new matches above the threshold this week.';
  const text = [subject, '', intro, '', ...(picked.length ? picked.map((r) => `- ${line(r)}`) : [none]), '', 'Open the Grant matches page for the reasons behind each score. FAS Evidence · synthetic or public data only.'].join('\n');
  const items = picked.map((r) => `<li>${esc(line(r))}</li>`).join('');
  const html = `<h2>${esc(subject)}</h2><p>${esc(intro)}</p>${picked.length ? `<ul>${items}</ul>` : `<p>${none}</p>`}<p>Open the Grant matches page for the reasons behind each score.</p>`;
  return { subject, text, html, count: picked.length, threshold, since, rows: picked };
}
