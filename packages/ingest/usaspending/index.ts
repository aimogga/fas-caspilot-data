import { createHash } from 'node:crypto';
/** USAspending v2 spending_by_award search (docs/DATA_SOURCES.md `usaspending`; no key). UNVERIFIED: the sandbox cannot reach the API, so the
 * request body and FIELDS follow the documented v2 shape as best known; QA confirms with the curl in the PR and trims the keys. Tolerant mapper
 * (first key present wins); fails closed when a result has no recognisable id, recipient or amount. Subawards are not fetched (incomplete upstream). */
export const FIELDS = {
  id: ['generated_internal_id', 'Award ID', 'internal_id'], recipient: ['Recipient Name', 'recipient_name'], amount: ['Award Amount', 'award_amount', 'total_obligation'],
  agency: ['Awarding Agency', 'awarding_agency'], subAgency: ['Awarding Sub Agency', 'awarding_sub_agency'], start: ['Start Date', 'period_of_performance_start_date'],
  state: ['Place of Performance State Code', 'place_of_performance_state_code'], aln: ['CFDA Number', 'cfda_number', 'Assistance Listings'],
  description: ['Description', 'description'], recipientType: ['Recipient Type', 'recipient_type', 'business_categories'],
} as const;
export const REQUEST_FIELDS = ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Awarding Sub Agency', 'Start Date', 'End Date', 'Description',
  'CFDA Number', 'Place of Performance State Code', 'recipient_id', 'generated_internal_id'];
type Raw = Record<string, unknown>;
export type SearchConfig = { assistanceListings: string[]; states: string[]; fiscalYears: number[]; pageSize: number };
export type AwardRow = {
  source: 'usaspending'; external_id: string; funder: string | null; recipient: string; recipient_state: string | null; recipient_type: string | null;
  amount: number; fiscal_year: number | null; assistance_listing: string | null; description: string | null; raw: Raw;
};
export type AwardDetail = { external_id: string; fain: string | null; description: string | null; period_start: string | null; period_end: string | null;
  agency: string | null; sub_agency: string | null; source_url: string };
/** Federal fiscal year (Oct–Sep) of a date; FY2025 = 2024-10-01..2025-09-30. */
export const fiscalYear = (iso: string): number => Number(iso.slice(0, 4)) + (Number(iso.slice(5, 7)) >= 10 ? 1 : 0);
/** The three most recently completed federal fiscal years as of `now` (the running FY is skipped as incomplete). */
export const lastFiscalYears = (now: Date, n = 3): number[] => { const fy = fiscalYear(now.toISOString()) - 1; return Array.from({ length: n }, (_, i) => fy - i); };
/** Default Assistance Listings for FAS (child abuse prevention, safe and stable families, children's mental health, SAMHSA, crime victims). George confirms. */
export const DEFAULT_ALNS = ['93.590', '93.556', '93.669', '93.104', '93.243', '93.958', '16.575'];
export const defaultConfig = (now = new Date()): SearchConfig => ({ assistanceListings: DEFAULT_ALNS, states: ['UT'], fiscalYears: lastFiscalYears(now), pageSize: 100 });
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const num = (v: unknown): number | null => { const n = typeof v === 'string' ? Number(v) : v; return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null; };
/** A string, or the first string / `cfda_number` / `name` of an array (Assistance Listings, business_categories). */
const first = (v: unknown): string | null => { const x = Array.isArray(v) ? v[0] : v; return str(x) ?? (x != null && typeof x === 'object' ? str((x as Raw).cfda_number ?? (x as Raw).name) : null); };
/** Coarse recipient type from the name when the API gives none (summary buckets only; not a legal determination). */
export const recipientType = (name: string, given: string | null): string =>
  given ?? (/universit|college/i.test(name) ? 'higher education' : /\b(county|city|state|department|dept|district|tribe|tribal)\b/i.test(name) ? 'government' : 'organization');
export class UsaSpending {
  static readonly SOURCE_NAME = 'usaspending'; static readonly API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
  static readonly MAX_PAGES = 5; static readonly PER_MINUTE = 30; // self-imposed; USAspending documents no hard limit
  /** One ALN × one fiscal-year window; grants only (02 block, 03 formula, 04 project, 05 cooperative agreement). */
  static searchBody(config: SearchConfig, aln: string, fy: number, page = 1): Raw {
    if (!Number.isInteger(page) || page < 1) throw new Error('page must be >= 1');
    return { subawards: false, fields: REQUEST_FIELDS, page, limit: Math.min(config.pageSize, 100), sort: 'Award Amount', order: 'desc',
      filters: { award_type_codes: ['02', '03', '04', '05'], program_numbers: [aln], time_period: [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` }],
        place_of_performance_locations: config.states.map((state) => ({ country: 'USA', state })) } };
  }
  /** `results` array → rows. Fails closed on an unknown shape or a result without id, recipient or amount. */
  static parse(json: unknown): AwardRow[] {
    const results = json != null && typeof json === 'object' && 'results' in json ? (json as Raw).results : json;
    if (!Array.isArray(results)) throw new Error('USAspending response must have a results array');
    return results.map((item) => {
      const o = (item ?? {}) as Raw, pick = (keys: readonly string[]): unknown => { const k = keys.find((x) => x in o); return k === undefined ? undefined : o[k]; };
      const [external_id, recipient, amount] = [str(pick(FIELDS.id)), str(pick(FIELDS.recipient)), num(pick(FIELDS.amount))];
      if (!external_id || !recipient || amount === null) throw new Error(`USAspending: unknown shape keys ${Object.keys(o).sort().join(',')}`);
      const [agency, sub, start] = [str(pick(FIELDS.agency)), str(pick(FIELDS.subAgency)), date(pick(FIELDS.start))];
      return { source: 'usaspending', external_id, recipient, amount, funder: agency && sub && sub !== agency ? `${agency} / ${sub}` : agency ?? sub,
        recipient_state: str(pick(FIELDS.state))?.toUpperCase() ?? null, recipient_type: recipientType(recipient, first(pick(FIELDS.recipientType))),
        fiscal_year: start ? fiscalYear(start) : null, assistance_listing: first(pick(FIELDS.aln)), description: str(pick(FIELDS.description))?.slice(0, 500) ?? null, raw: o };
    });
  }
  static readonly DETAIL_API = 'https://api.usaspending.gov/api/v2/awards/';
  static detailUrl(generatedId: string): string { return `${UsaSpending.DETAIL_API}${encodeURIComponent(generatedId)}/`; }
  /** F-506c: `GET /api/v2/awards/<generated_unique_award_id>/` → full description, period of performance and the awarding agency (VERIFIED 2026-10-15
   * against two live awards, saved as tests/fixtures/usaspending/award-detail-*.json). Fails closed when the id is missing. */
  static parseDetail(json: unknown): AwardDetail {
    const o = (json ?? {}) as Raw, pop = (o.period_of_performance ?? {}) as Raw, ag = (o.awarding_agency ?? {}) as Raw;
    const [top, sub] = [(ag.toptier_agency ?? {}) as Raw, (ag.subtier_agency ?? {}) as Raw], external_id = str(o.generated_unique_award_id);
    if (!external_id) throw new Error(`USAspending detail: unknown shape keys ${Object.keys(o).sort().join(',')}`);
    return { external_id, fain: str(o.fain), description: str(o.description), period_start: date(pop.start_date), period_end: date(pop.end_date),
      agency: str(top.abbreviation), sub_agency: str(sub.abbreviation), source_url: UsaSpending.detailUrl(external_id) };
  }
  /** First occurrence per external_id wins (an award can match more than one window). */
  static dedupe(rows: AwardRow[]): AwardRow[] { const seen = new Set<string>(); return rows.filter((r) => !seen.has(r.external_id) && seen.add(r.external_id)); }
  /** Stable over the stored columns (not `raw`). */
  static checksum(rows: AwardRow[]): string {
    return createHash('sha256').update(JSON.stringify([...rows].sort((a, b) => a.external_id.localeCompare(b.external_id)).map((r) => ({ ...r, raw: undefined })))).digest('hex');
  }
  /** Every ALN × fiscal year, up to MAX_PAGES pages each, one `take()` per request; stops at a short page or `page_metadata.hasNext === false`. */
  static async search(config: SearchConfig, take: () => Promise<void>, httpFetch: typeof fetch = fetch): Promise<AwardRow[]> {
    const rows: AwardRow[] = [];
    for (const aln of config.assistanceListings) for (const fy of config.fiscalYears) {
      for (let page = 1; page <= UsaSpending.MAX_PAGES; page++) {
        await take(); const body = JSON.stringify(UsaSpending.searchBody(config, aln, fy, page));
        const res = await httpFetch(UsaSpending.API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!res.ok) throw new Error(`USAspending search failed: ${res.status}`);
        const json = (await res.json()) as Raw, got = UsaSpending.parse(json);
        if (rows.push(...got) && ((json.page_metadata as Raw | undefined)?.hasNext === false || got.length < Math.min(config.pageSize, 100))) break;
      }
    }
    return UsaSpending.dedupe(rows);
  }
}
