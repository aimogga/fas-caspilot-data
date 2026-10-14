import { createHash } from 'node:crypto';
/** ProPublica Nonprofit Explorer API v2 (docs/DATA_SOURCES.md `propublica_990`; free, no key; ProPublica Data Terms of Use: attribution, no SEO/ad-driven
 * republishing). UNVERIFIED: the sandbox cannot reach the API, so FIELDS follow the documented v2 shapes as best known; QA confirms with the curl in the PR.
 * Tolerant mapper (first key present wins); fails closed on an unknown shape. The API exposes FILING TOTALS only, never grantee lists: grantee-level
 * 990-PF "grants paid" is the Phase 5b IRS bulk-XML item (`irs_990pf_grants`, Verify first) and is NOT ingested here. */
export const FIELDS = {
  ein: ['ein', 'strein'], name: ['name', 'sort_name'], city: ['city'], state: ['state'], ntee: ['ntee_code', 'raw_ntee_code'], subsection: ['subseccd', 'subsection_code'],
  score: ['score'], taxPrd: ['tax_prd'], taxYear: ['tax_prd_yr'], formType: ['formtype'], revenue: ['totrevenue'], expenses: ['totfuncexpns'], assets: ['totassetsend'], pdf: ['pdf_url'],
} as const;
type Raw = Record<string, unknown>; export type CapacityBand = 'small' | 'medium' | 'large' | 'unknown';
export type FunderCandidate = { ein: string; name: string; city: string | null; state: string | null; ntee_code: string | null; subsection: number | null; score: number | null };
export type Filing = { tax_year: number; tax_prd: string; form_type: '990' | '990EZ' | '990PF'; total_revenue: number | null; total_expenses: number | null; total_assets: number | null; pdf_url: string | null; raw: Raw };
export type FunderProfile = Omit<FunderCandidate, 'score'> & { filings: Filing[]; data_years: number[]; grantmaking_capacity_band: CapacityBand; gaps: string[] };
export type FoundationRow = { source: 'irs_990pf'; external_id: string; funder: string; recipient: null; recipient_state: string | null; amount: null; fiscal_year: number; assistance_listing: null; description: string; raw: Raw };
/** By latest total expenses: small < $1M, medium $1M–$10M, large >= $10M. Thresholds are a first guess for George. */
export const BANDS: [number, CapacityBand][] = [[10_000_000, 'large'], [1_000_000, 'medium'], [0, 'small']];
export const GAP_NO_GRANTEES = 'Grantee-level grants paid are not in this source: ProPublica exposes 990-PF filing totals only (Phase 5b IRS bulk XML).';
const FORM: Record<number, Filing['form_type']> = { 0: '990', 1: '990EZ', 2: '990PF' }; // ProPublica formtype codes
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const num = (v: unknown): number | null => { const n = typeof v === 'string' && v.trim() ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) ? n : null; };
const pick = (o: Raw, keys: readonly string[]): unknown => { const k = keys.find((x) => x in o && o[x] != null); return k === undefined ? undefined : o[k]; };
const obj = (v: unknown): Raw => (v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});
/** 9 digits, zero-padded (the API returns EINs as numbers, dropping a leading zero); accepts `00-0000000`. */
export const normalizeEin = (v: unknown): string | null => { const d = str(v)?.replace(/\D/g, ''); return d && d.length >= 8 && d.length <= 9 ? d.padStart(9, '0') : null; };
export const isEin = (q: string): boolean => /^\d{2}-?\d{7}$/.test(q.trim()); // 00-0000000 or 000000000
const tokens = (s: string) => new Set(s.toLowerCase().replace(/\b(the|inc|foundation|fund|trust|charitable|family)\b/g, ' ').match(/[a-z0-9]+/g) ?? []);
/** Jaccard over name tokens minus legal boilerplate; 1 = same name. */ export const nameScore = (a: string, b: string): number => { const [x, y] = [tokens(a), tokens(b)], hit = [...x].filter((t) => y.has(t)).length; return x.size + y.size - hit ? hit / (x.size + y.size - hit) : 0; };
export const capacityBand = (expenses: number | null): CapacityBand => (expenses === null ? 'unknown' : BANDS.find(([min]) => expenses >= min)?.[1] ?? 'small');
export class ProPublica {
  static readonly SOURCE_NAME = 'propublica_990'; static readonly API = 'https://projects.propublica.org/nonprofits/api/v2';
  static readonly PER_MINUTE = 30; static readonly MIN_SCORE = 0.5; static readonly KEEP_FILINGS = 3; // self-imposed limiter; ProPublica documents none
  static searchUrl(query: string, state: string | null = 'UT', page = 0): string {
    if (!Number.isInteger(page) || page < 0) throw new Error('page must be >= 0');
    return `${ProPublica.API}/search.json?q=${encodeURIComponent(query)}${state ? `&state%5Bid%5D=${encodeURIComponent(state)}` : ''}&page=${page}`;
  }
  static orgUrl(ein: string): string { const e = normalizeEin(ein); if (!e) throw new Error('invalid EIN'); return `${ProPublica.API}/organizations/${e}.json`; }
  /** `organizations` → 501(c)(3) candidates only (the grant makers; the search gives no form type). Fails closed when an item has no ein or name. */
  static parseSearch(json: unknown): FunderCandidate[] {
    const list = obj(json).organizations;
    if (!Array.isArray(list)) throw new Error('ProPublica search response must have an organizations array');
    return list.map((item) => {
      const o = obj(item), ein = normalizeEin(pick(o, FIELDS.ein)), name = str(pick(o, FIELDS.name));
      if (!ein || !name) throw new Error(`ProPublica: unknown shape keys ${Object.keys(o).sort().join(',')}`);
      return { ein, name, city: str(pick(o, FIELDS.city)), state: str(pick(o, FIELDS.state))?.toUpperCase() ?? null, ntee_code: str(pick(o, FIELDS.ntee)), subsection: num(pick(o, FIELDS.subsection)), score: num(pick(o, FIELDS.score)) };
    }).filter((c) => c.subsection === 3);
  }
  /** Best candidate for a query: exact EIN, else highest name score (ties by API score) at or above MIN_SCORE. */ static bestMatch(query: string, cands: FunderCandidate[]): FunderCandidate | null {
    if (isEin(query)) return cands.find((c) => c.ein === normalizeEin(query)) ?? null;
    const ranked = cands.map((c) => ({ c, s: nameScore(query, c.name) })).filter((x) => x.s >= ProPublica.MIN_SCORE).sort((a, b) => b.s - a.s || (b.c.score ?? 0) - (a.c.score ?? 0));
    return ranked[0]?.c ?? null;
  }
  /** `organization` + `filings_with_data` → profile with the last KEEP_FILINGS filings, data years and plain-language gaps. Fails closed without ein or name. */
  static parseOrganization(json: unknown): FunderProfile {
    const root = obj(json), o = obj(root.organization), ein = normalizeEin(pick(o, FIELDS.ein)), name = str(pick(o, FIELDS.name));
    if (!ein || !name) throw new Error(`ProPublica: unknown organization shape keys ${Object.keys(o).sort().join(',')}`);
    const filings = (Array.isArray(root.filings_with_data) ? root.filings_with_data : []).map((f): Filing | null => {
      const r = obj(f), tax_year = num(pick(r, FIELDS.taxYear)), form_type = FORM[num(pick(r, FIELDS.formType)) ?? -1];
      return tax_year && form_type ? { tax_year, tax_prd: str(pick(r, FIELDS.taxPrd)) ?? String(tax_year), form_type, total_revenue: num(pick(r, FIELDS.revenue)), total_expenses: num(pick(r, FIELDS.expenses)),
        total_assets: num(pick(r, FIELDS.assets)), pdf_url: str(pick(r, FIELDS.pdf)), raw: r } : null;
    }).filter((f): f is Filing => f !== null).sort((a, b) => b.tax_year - a.tax_year).slice(0, ProPublica.KEEP_FILINGS);
    const pf = filings.filter((f) => f.form_type === '990PF'), data_years = pf.map((f) => f.tax_year), latest = filings[0];
    const gaps = [GAP_NO_GRANTEES, pf.length ? `Latest 990-PF data year on ProPublica is ${data_years[0]}; later years are not yet extracted.` : 'No 990-PF filings with extracted data: not a private foundation, or ProPublica has PDFs only.'];
    return { ein, name, city: str(pick(o, FIELDS.city)), state: str(pick(o, FIELDS.state))?.toUpperCase() ?? null, ntee_code: str(pick(o, FIELDS.ntee)), subsection: num(pick(o, FIELDS.subsection)),
      filings, data_years, grantmaking_capacity_band: capacityBand(latest?.total_expenses ?? null), gaps };
  }
  /** One award_history row per 990-PF filing year; `recipient`/`amount` are null: the API gives no grant-level detail (GAP_NO_GRANTEES). */ static toAwardHistoryRows(p: FunderProfile): FoundationRow[] {
    return p.filings.filter((f) => f.form_type === '990PF').map((f) => ({ source: 'irs_990pf', external_id: `propublica:${p.ein}:${f.tax_prd}`, funder: p.name, recipient: null, recipient_state: p.state,
      amount: null, fiscal_year: f.tax_year, assistance_listing: null, description: `990-PF filing totals, tax year ${f.tax_year} (ProPublica Nonprofit Explorer). ${GAP_NO_GRANTEES}`, raw: { ...f.raw, ein: p.ein } }));
  }
  /** Stable over the stored columns (not `raw`). */ static checksum(rows: FoundationRow[]): string {
    return createHash('sha256').update(JSON.stringify([...rows].sort((a, b) => a.external_id.localeCompare(b.external_id)).map((r) => ({ ...r, raw: undefined })))).digest('hex');
  }
  /** Name or EIN → profile: EINs go straight to the organization; names search Utah first, then national. Null when nothing matches; throws on non-2xx or a bad shape. */
  static async lookup(query: string, take: () => Promise<void>, httpFetch: typeof fetch = fetch): Promise<FunderProfile | null> {
    const get = async (url: string): Promise<unknown> => { await take(); const res = await httpFetch(url); if (!res.ok) throw new Error(`ProPublica request failed: ${res.status}`); return res.json(); };
    let ein = isEin(query) ? normalizeEin(query) : null;
    for (const state of ['UT', null] as const) ein ??= ProPublica.bestMatch(query, ProPublica.parseSearch(await get(ProPublica.searchUrl(query, state))))?.ein ?? null;
    return ein ? ProPublica.parseOrganization(await get(ProPublica.orgUrl(ein))) : null;
  }
}
