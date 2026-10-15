import { createHash } from 'node:crypto';

/** Simpler.Grants.gov v1 opportunity search (docs/DATA_SOURCES.md `grants_gov`). UNVERIFIED: the sandbox cannot reach the API, so
 * the request body and FIELDS follow the public v1 schema as best known; QA confirms with one search (see PR) and trims the keys.
 * Tolerant mapper (first key present wins, top-level then `summary`); fails closed when an item has no recognisable id/title. */
export const FIELDS = {
  id: ['opportunity_id', 'legacy_opportunity_id', 'id'], title: ['opportunity_title', 'title'], funder: ['agency_name', 'agency', 'agency_code'],
  posted: ['post_date', 'posted_date'], close: ['close_date', 'archive_date'], floor: ['award_floor'], ceiling: ['award_ceiling'], applicants: ['applicant_types'],
  eligibility: ['applicant_eligibility_description', 'eligibility_description'], categories: ['funding_categories', 'funding_category'], description: ['summary_description', 'description'],
} as const;
type Raw = Record<string, unknown>;
/** Sweeps: one search per `themes` entry (keyword), one over `assistance_listings` (program numbers), one over `funding_categories`
 * scoped to `agencies` (agency codes). `closes_after_days` / `posted_within_days` add relative date windows (API `*_relative` days).
 * Every sweep keeps the applicant-type and status filters. */
export type SearchConfig = {
  themes: string[]; applicant_types: string[]; opportunity_status: string[]; page_size: number;
  assistance_listings?: string[]; funding_categories?: string[]; agencies?: string[]; closes_after_days?: number; posted_within_days?: number;
};
export type Sweep = { kind: 'theme' | 'listing' | 'category'; label: string; query?: string; filters: Raw };
export type Eligibility = { applicant_types: string[]; applicant_eligibility_description: string | null; funding_categories: string[] };
export type OpportunityRow = {
  source: 'grants_gov'; external_id: string; title: string; funder: string | null; assistance_listing: string | null;
  posted_date: string | null; close_date: string | null; award_floor: number | null; award_ceiling: number | null;
  eligibility: Eligibility; description: string | null; raw: Raw;
};

/** Default themes and filters for FAS (George confirmed the sweeps on 2026-10-15). Assistance Listings: 93.104 children's mental health,
 * 93.243 SAMHSA behavioral health, 93.556 Promoting Safe and Stable Families, 93.590 community-based child abuse prevention,
 * 93.670 child abuse and neglect discretionary, 16.540 juvenile justice (OJJDP), 16.575 crime victim assistance. Agency codes are the
 * API's top-level codes (UNVERIFIED like the rest of this module; an unknown code returns no rows, never a different program). */
export const DEFAULT_CONFIG: SearchConfig = { themes: ['family therapy', 'behavioral health', 'court-involved youth', 'child welfare mental health'],
  applicant_types: ['nonprofits_non_higher_education_with_501c3'], opportunity_status: ['posted', 'forecasted'], page_size: 50,
  assistance_listings: ['93.104', '93.243', '93.556', '93.590', '93.670', '16.540', '16.575'],
  funding_categories: ['health', 'income_security_and_social_services', 'law_justice_and_legal_services'], agencies: ['HHS', 'USDOJ'],
  closes_after_days: 0 };
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);

export class GrantsGov {
  static readonly SOURCE_NAME = 'grants_gov';
  static readonly API = 'https://api.simpler.grants.gov/v1';
  static readonly MAX_PAGES = 4;
  /** Filters shared by every sweep: applicant type, status, and the optional relative date windows (days from today). */
  static baseFilters(config: SearchConfig): Raw {
    const f: Raw = { opportunity_status: { one_of: config.opportunity_status }, applicant_type: { one_of: config.applicant_types } };
    if (config.closes_after_days !== undefined) f.close_date = { start_date_relative: config.closes_after_days };
    if (config.posted_within_days !== undefined) f.post_date = { start_date_relative: -Math.abs(config.posted_within_days) };
    return f;
  }
  /** The sweeps a config asks for, in run order; empty lists add no sweep. */
  static sweeps(config: SearchConfig): Sweep[] {
    const base = GrantsGov.baseFilters(config), out: Sweep[] = config.themes.map((t) => ({ kind: 'theme', label: `theme:${t}`, query: t, filters: base }));
    if (config.assistance_listings?.length) out.push({ kind: 'listing', label: `listing:${config.assistance_listings.join(',')}`, filters: { ...base, assistance_listing_number: { one_of: config.assistance_listings } } });
    if (config.funding_categories?.length) {
      const filters: Raw = { ...base, funding_category: { one_of: config.funding_categories } };
      if (config.agencies?.length) filters.agency = { one_of: config.agencies };
      out.push({ kind: 'category', label: `category:${config.funding_categories.join(',')}${config.agencies?.length ? `@${config.agencies.join(',')}` : ''}`, filters });
    }
    return out;
  }
  static searchBody(config: SearchConfig, sweep: Sweep | string, page = 1): Raw {
    if (!Number.isInteger(page) || page < 1) throw new Error('page must be >= 1');
    const s: Sweep = typeof sweep === 'string' ? { kind: 'theme', label: `theme:${sweep}`, query: sweep, filters: GrantsGov.baseFilters(config) } : sweep;
    const sort = s.query ? [{ order_by: 'relevancy', sort_direction: 'descending' }] : [{ order_by: 'post_date', sort_direction: 'descending' }];
    return { ...(s.query ? { query: s.query } : {}), filters: s.filters,
      pagination: { page_offset: page, page_size: Math.min(config.page_size, 50), sort_order: sort } };
  }
  /** One POST /opportunities/search. The key travels only in headers, never in errors: `X-API-Key` is the documented header
   * (wiki.simpler.grants.gov/product/api, OpenAPI `ApiUserKeyAuth`); `X-Auth` is kept for the older environments. */
  static async fetchPage(body: Raw, apiKey: string, httpFetch: typeof fetch = fetch): Promise<unknown> {
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey, 'X-Auth': apiKey }, body: JSON.stringify(body) };
    const res = await httpFetch(`${GrantsGov.API}/opportunities/search`, init);
    if (!res.ok) throw new Error(`Grants.gov search failed: ${res.status}`);
    return res.json();
  }
  /** `data` array of opportunity objects → rows. Fails closed on an unknown shape or an item without id or title. */
  static parse(json: unknown): OpportunityRow[] {
    const data = json != null && typeof json === 'object' && 'data' in json ? (json as Raw).data : json;
    if (!Array.isArray(data)) throw new Error('Grants.gov response must have a data array');
    return data.map((item) => {
      const o = (item ?? {}) as Raw, s = (o.summary != null && typeof o.summary === 'object' ? o.summary : {}) as Raw;
      const pick = (keys: readonly string[]): unknown => { const k = keys.find((x) => x in o) ?? keys.find((x) => x in s); return k === undefined ? undefined : k in o ? o[k] : s[k]; };
      const [external_id, title] = [str(pick(FIELDS.id)), str(pick(FIELDS.title))];
      if (!external_id || !title) throw new Error(`Grants.gov: unknown shape keys ${Object.keys(o).sort().join(',')}`);
      const aln = Array.isArray(o.opportunity_assistance_listings) ? (o.opportunity_assistance_listings[0] as Raw | undefined) : undefined;
      return {
        source: 'grants_gov', external_id, title, funder: str(pick(FIELDS.funder)),
        assistance_listing: str(aln?.assistance_listing_number ?? aln?.program_number),
        posted_date: date(pick(FIELDS.posted)), close_date: date(pick(FIELDS.close)),
        award_floor: num(pick(FIELDS.floor)), award_ceiling: num(pick(FIELDS.ceiling)),
        eligibility: { applicant_types: list(pick(FIELDS.applicants)), applicant_eligibility_description: str(pick(FIELDS.eligibility)), funding_categories: list(pick(FIELDS.categories)) },
        description: str(pick(FIELDS.description)), raw: o };
    });
  }
  /** First occurrence per external_id wins (sweeps overlap); `raw.fas_sweeps` lists every sweep label that found the row. */
  static dedupe(rows: OpportunityRow[]): OpportunityRow[] {
    const byId = new Map<string, OpportunityRow>();
    for (const r of rows) {
      const found = list(r.raw.fas_sweeps), kept = byId.get(r.external_id);
      if (!kept) byId.set(r.external_id, { ...r, raw: { ...r.raw, fas_sweeps: found } });
      else kept.raw.fas_sweeps = [...new Set([...list(kept.raw.fas_sweeps), ...found])];
    }
    return [...byId.values()];
  }
  /** Stable over the stored columns (not `raw`, which carries volatile API metadata). */
  static checksum(rows: OpportunityRow[]): string {
    const sorted = [...rows].sort((a, b) => a.external_id.localeCompare(b.external_id)).map((r) => ({ ...r, raw: undefined }));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
  /** Every sweep, up to MAX_PAGES pages each, one `take()` per request; a sweep stops at a short page. */
  static async search(config: SearchConfig, apiKey: string, take: () => Promise<void>, httpFetch: typeof fetch = fetch): Promise<OpportunityRow[]> {
    const rows: OpportunityRow[] = [];
    for (const sweep of GrantsGov.sweeps(config)) {
      for (let page = 1; page <= GrantsGov.MAX_PAGES; page++) {
        await take();
        const got = GrantsGov.parse(await GrantsGov.fetchPage(GrantsGov.searchBody(config, sweep, page), apiKey, httpFetch));
        rows.push(...got.map((r) => ({ ...r, raw: { ...r.raw, fas_sweeps: [sweep.label] } })));
        if (got.length < Math.min(config.page_size, 50)) break;
      }
    }
    return GrantsGov.dedupe(rows);
  }
}
