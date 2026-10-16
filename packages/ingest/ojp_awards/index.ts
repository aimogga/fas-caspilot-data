/** DOJ Office of Justice Programs award pages (F-506c; docs/DATA_SOURCES.md `ojp_awards`). Pure: URL from the FAIN, abstract from saved HTML.
 * UNVERIFIED: as of 2026-10-15 the pages answer anonymous clients with a 307 to /user/login, so the parser follows the Drupal field__label /
 * field__item layout the pages used when public (hand-built fixtures in tests/fixtures/ojp_awards). QA confirms with the curl in the PR.
 * A page whose layout it does not recognise throws, so a redesign fails a test instead of storing junk. */
export type OjpParse = { status: 'published'; award_number: string; text: string; word_count: number } | { status: 'not_published'; award_number: string | null; reason: string };
/** Office subdomain by the 6-letter FAIN prefix (15POVC = OVC); older numbers (2016-VA-GX-0052) have no office prefix and use www. */
const OFFICE: Record<string, string> = { '15POVC': 'ovc', '15PBJA': 'bja', '15PJDP': 'ojjdp', '15PNIJ': 'nij', '15PBJS': 'bjs', '15PSMA': 'smart' };
const ENTITY: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITY[e.toLowerCase()] ?? m);
/** Tags out (block ends become spaces), entities decoded, whitespace collapsed. */
export const plainText = (html: string): string => decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const wordCount = (text: string): number => (text.match(/\S+/g) ?? []).length;
export class OjpAwards {
  static readonly SOURCE_NAME = 'ojp_awards';
  /** USAspending detail says DOJ / OJP (the only DOJ component these pages cover). */
  static isOjp(agency: string | null, subAgency: string | null): boolean { return agency === 'DOJ' && subAgency === 'OJP'; }
  /** 15POVC22GG00810ASSI → https://ovc.ojp.gov/funding/awards/15povc-22-gg-00810-assi; 2016VAGX0052 → www.ojp.gov/…/2016-va-gx-0052; else null. */
  static pageUrl(fain: string | null): string | null {
    const f = (fain ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''), m = /^(15P[A-Z]{3})(\d{2})([A-Z]{2})(\d{5})([A-Z]{4})$/.exec(f), old = /^(\d{4})([A-Z0-9]{2})([A-Z]{2})([A-Z0-9]{4})$/.exec(f);
    if (m && OFFICE[m[1]]) return `https://${OFFICE[m[1]]}.ojp.gov/funding/awards/${m.slice(1).join('-').toLowerCase()}`;
    return old ? `https://www.ojp.gov/funding/awards/${old.slice(1).join('-').toLowerCase()}` : null;
  }
  /** Labelled detail fields (`Award #`, `Awardee`, …) in page order. */
  static fields(html: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of html.matchAll(/<div class="field__label">([^<]+)<\/div>\s*<div class="field__item">([\s\S]*?)<\/div>/g)) out[plainText(m[1])] = plainText(m[2]);
    return out;
  }
  static parse(html: string): OjpParse {
    if (/<title>\s*Log in\b/i.test(html)) return { status: 'not_published', award_number: null, reason: 'OJP award page requires sign-in; no public abstract' };
    const award_number = OjpAwards.fields(html)['Award #'];
    if (!award_number) throw new Error('OJP award page: layout not recognised (no "Award #" field)');
    const sec = /<h2 class="field__label">\s*Description of original award[^<]*<\/h2>\s*<div class="field__item">([\s\S]*?)<\/div>\s*<\/div>/.exec(html);
    const text = sec ? plainText(sec[1]) : '';
    if (!text) return { status: 'not_published', award_number, reason: 'OJP award page has no published abstract' };
    return { status: 'published', award_number, text, word_count: wordCount(text) };
  }
}
