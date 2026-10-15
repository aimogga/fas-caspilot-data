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
export type SearchConfig = { themes: string[]; applicant_types: string[]; opportunity_status: string[]; page_size: number };
export type Eligibility = { applicant_types: string[]; applicant_eligibility_description: string | null; funding_categories: string[] };
export type OpportunityRow = {
  source: 'grants_gov'; external_id: string; title: string; funder: string | null; assistance_listing: string | null;
  posted_date: string | null; close_date: string | null; award_floor: number | null; award_ceiling: number | null;
  eligibility: Eligibility; description: string | null; raw: Raw;
};

/** Default themes and filters for FAS (George confirms; see progress.md Decisions). */
export const DEFAULT_CONFIG: SearchConfig = { themes: ['family therapy', 'behavioral health', 'court-involved youth', 'child welfare mental health'],
  applicant_types: ['nonprofits_non_higher_education_with_501c3'], opportunity_status: ['posted', 'forecasted'], page_size: 50 };
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);

export class GrantsGov {
  static readonly SOURCE_NAME = 'grants_gov';
  static readonly API = 'https://api.simpler.grants.gov/v1';
  static readonly MAX_PAGES = 4;
  static searchBody(config: SearchConfig, theme: string, page = 1): Raw {
    if (!Number.isInteger(page) || page < 1) throw new Error('page must be >= 1');
    return { query: theme,
      filters: { opportunity_status: { one_of: config.opportunity_status }, applicant_type: { one_of: config.applicant_types } },
      pagination: { page_offset: page, page_size: Math.min(config.page_size, 50), sort_order: [{ order_by: 'relevancy', sort_direction: 'descending' }] },
    };
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
  /** First occurrence per external_id wins (themes overlap). */
  static dedupe(rows: OpportunityRow[]): OpportunityRow[] {
    const seen = new Set<string>();
    return rows.filter((r) => !seen.has(r.external_id) && seen.add(r.external_id));
  }
  /** Stable over the stored columns (not `raw`, which carries volatile API metadata). */
  static checksum(rows: OpportunityRow[]): string {
    const sorted = [...rows].sort((a, b) => a.external_id.localeCompare(b.external_id)).map((r) => ({ ...r, raw: undefined }));
    return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
  }
  /** Every theme, up to MAX_PAGES pages each, one `take()` per request; a theme stops at a short page. */
  static async search(config: SearchConfig, apiKey: string, take: () => Promise<void>, httpFetch: typeof fetch = fetch): Promise<OpportunityRow[]> {
    const rows: OpportunityRow[] = [];
    for (const theme of config.themes) {
      for (let page = 1; page <= GrantsGov.MAX_PAGES; page++) {
        await take();
        const got = GrantsGov.parse(await GrantsGov.fetchPage(GrantsGov.searchBody(config, theme, page), apiKey, httpFetch));
        if (rows.push(...got) && got.length < Math.min(config.page_size, 50)) break;
      }
    }
    return GrantsGov.dedupe(rows);
  }
}
