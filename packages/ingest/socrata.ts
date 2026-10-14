/** Shared Socrata (SODA 2.x) helper for data.cdc.gov-style sources (PLACES now, VetPop later). */
export class Socrata {
  /** `https://<host>/resource/<dataset>.json?$where=…`; `$$app_token` is appended from env only when set (never logged). */
  static url(host: string, dataset: string, params: Record<string, string>, env: Record<string, string | undefined> = process.env): URL {
    const url = new URL(`/resource/${dataset}.json`, host);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (env.SOCRATA_APP_TOKEN) url.searchParams.set('$$app_token', env.SOCRATA_APP_TOKEN);
    return url;
  }

  /** GET and fail closed on non-2xx or non-array. Messages carry the label only, never the URL (it may hold the token). */
  static async fetchJson(url: URL, label: string, httpFetch: typeof fetch = fetch): Promise<unknown[]> {
    const res = await httpFetch(url);
    if (!res.ok) throw new Error(`${label} fetch failed: ${res.status}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json)) throw new Error(`${label} response is not a JSON array`);
    return json;
  }
}
