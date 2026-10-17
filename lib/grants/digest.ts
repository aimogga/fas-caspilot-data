// F-505 weekly grant digest (pure). Picks the new matches at or above the digest threshold and renders them as plain text and simple HTML.
// Nothing here is FAS client data: opportunity titles, funders, close dates and fit scores only. n8n sends the email; the app never does.
// F-504d: the picked rows are grouped by fit band (Strong fit, then Worth a look); which rows are picked is unchanged.
import { BAND_LABEL, type BandKey, digestThreshold, fitBand } from './band';

export { digestThreshold };

export type DigestRow = { id: string; title: string; funder: string | null; closeDate: string | null; postedDate: string | null; computedAt: string; score: number; eligibility: string };
export type DigestGroup = { band: BandKey; label: string; rows: DigestRow[] };
export type Digest = { subject: string; text: string; html: string; count: number; threshold: number; since: string; rows: DigestRow[]; groups: DigestGroup[] };
export const DEFAULT_DIGEST_DAYS = 7;
const DAY_MS = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

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

/** Best band first; empty bands are left out. Rows keep their score order inside a band. */
export function groupByBand(rows: DigestRow[], params: unknown): DigestGroup[] {
  return (['strong', 'look', 'pass'] as const).map((band) => ({ band, label: BAND_LABEL[band], rows: rows.filter((r) => fitBand(r.score, params).key === band) })).filter((g) => g.rows.length);
}

export function buildDigest(rows: DigestRow[], now: Date, params: unknown, days = DEFAULT_DIGEST_DAYS): Digest {
  const threshold = digestThreshold(params), since = sinceDate(now, days), picked = selectNew(rows, now, threshold, days), groups = groupByBand(picked, params);
  const subject = `FAS Evidence · ${picked.length} new grant match${picked.length === 1 ? '' : 'es'} this week`;
  const line = (r: DigestRow) => `${r.title} · ${r.funder ?? 'Funder not recorded'} · closes ${r.closeDate ? fmt(r.closeDate) : 'no close date'} · fit ${Math.round(r.score)} · ${r.eligibility}`;
  const intro = `New grant matches scoring ${threshold} or higher since ${fmt(since)}.`;
  const none = 'No new matches above the threshold this week.';
  const text = [subject, '', intro, '', ...(picked.length ? groups.flatMap((g, i) => [...(i ? [''] : []), `${g.label} (${g.rows.length})`, ...g.rows.map((r) => `- ${line(r)}`)]) : [none]), '', 'Open the Grant matches page for the reasons behind each score. FAS Evidence · synthetic or public data only.'].join('\n');
  const items = groups.map((g) => `<h3>${esc(g.label)} (${g.rows.length})</h3><ul>${g.rows.map((r) => `<li>${esc(line(r))}</li>`).join('')}</ul>`).join('');
  const html = `<h2>${esc(subject)}</h2><p>${esc(intro)}</p>${picked.length ? items : `<p>${none}</p>`}<p>Open the Grant matches page for the reasons behind each score.</p>`;
  return { subject, text, html, count: picked.length, threshold, since, rows: picked, groups };
}
