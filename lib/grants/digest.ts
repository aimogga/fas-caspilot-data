// F-505 weekly grant digest (pure). Picks the new matches at or above the digest threshold and renders them as plain text and simple HTML.
// Nothing here is FAS client data: opportunity titles, funders, close dates and fit scores only. n8n sends the email; the app never does.
// F-504d: the picked rows are grouped by fit band (Strong fit, then Worth a look); which rows are picked is unchanged.
// F-505b: given the app's URL, each match links to the grant evidence packet prepared for it (F-403b) and the footer to the Grant matches page.
import { BAND_LABEL, type BandKey, digestThreshold, fitBand } from './band';

export { digestThreshold };

export type DigestRow = { id: string; opportunityId?: string; title: string; funder: string | null; closeDate: string | null; postedDate: string | null; computedAt: string; score: number; eligibility: string };
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

/** The packet for one grant and the matches page, under `appUrl` (no trailing slash). */
export const packetUrl = (appUrl: string, opportunityId: string) => `${appUrl}/staff/packets?variant=grant&opportunity=${encodeURIComponent(opportunityId)}`;
export const matchesUrl = (appUrl: string) => `${appUrl}/staff/grants/matches`;

export function buildDigest(rows: DigestRow[], now: Date, params: unknown, days = DEFAULT_DIGEST_DAYS, appUrl?: string): Digest {
  const threshold = digestThreshold(params), since = sinceDate(now, days), picked = selectNew(rows, now, threshold, days), groups = groupByBand(picked, params);
  const subject = `FAS Evidence · ${picked.length} new grant match${picked.length === 1 ? '' : 'es'} this week`;
  const line = (r: DigestRow) => `${r.title} · ${r.funder ?? 'Funder not recorded'} · closes ${r.closeDate ? fmt(r.closeDate) : 'no close date'} · fit ${Math.round(r.score)} · ${r.eligibility}`;
  const intro = `New grant matches scoring ${threshold} or higher since ${fmt(since)}.`;
  const none = 'No new matches above the threshold this week.';
  const packet = (r: DigestRow) => (appUrl && r.opportunityId ? packetUrl(appUrl, r.opportunityId) : null);
  const body = picked.length ? groups.flatMap((g, i) => [...(i ? [''] : []), `${g.label} (${g.rows.length})`, ...g.rows.flatMap((r) => [`- ${line(r)}`, ...(packet(r) ? [`  Evidence packet: ${packet(r)}`] : [])])]) : [none];
  const open = 'Open the Grant matches page for the reasons behind each score.', openText = appUrl ? `Open the Grant matches page (${matchesUrl(appUrl)}) for the reasons behind each score.` : open;
  const text = [subject, '', intro, '', ...body, '', `${openText} FAS Evidence · synthetic or public data only.`].join('\n');
  const li = (r: DigestRow) => `<li>${esc(line(r))}${packet(r) ? ` · <a href="${esc(packet(r) as string)}">Evidence packet</a>` : ''}</li>`;
  const items = groups.map((g) => `<h3>${esc(g.label)} (${g.rows.length})</h3><ul>${g.rows.map(li).join('')}</ul>`).join('');
  const footer = appUrl ? `<p>Open the <a href="${esc(matchesUrl(appUrl))}">Grant matches page</a> for the reasons behind each score.</p>` : `<p>${open}</p>`;
  const html = `<h2>${esc(subject)}</h2><p>${esc(intro)}</p>${picked.length ? items : `<p>${none}</p>`}${footer}`;
  return { subject, text, html, count: picked.length, threshold, since, rows: picked, groups };
}
