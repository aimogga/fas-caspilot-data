/** F-506c: one request per second per host, a descriptive User-Agent, robots.txt respected. Clock, sleep and fetch are injectable. */
export const USER_AGENT = 'FAS-Evidence/1.0 (+https://fas-caspilot-data.vercel.app; Family Advocacy Services public-data research)';
/** Longest matching Allow/Disallow rule wins (Allow on a tie) in the `User-agent: *` or `FAS-Evidence` groups; `*` and `$` are honoured. */
export function robotsAllows(robots: string, path: string): boolean {
  const rules: { allow: boolean; pat: string }[] = [];
  let mine = false, inAgents = false;
  for (const raw of robots.split('\n')) {
    const [k, ...rest] = raw.replace(/#.*/, '').split(':'), key = k.trim().toLowerCase(), val = rest.join(':').trim();
    if (key === 'user-agent') { mine = (inAgents ? mine : false) || val === '*' || /^fas-evidence/i.test(val); inAgents = true; continue; }
    inAgents = false;
    if (mine && (key === 'allow' || key === 'disallow') && val) rules.push({ allow: key === 'allow', pat: val });
  }
  const hit = (pat: string) => new RegExp(`^${pat.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}`).test(path);
  const best = rules.filter((r) => hit(r.pat)).sort((a, b) => b.pat.length - a.pat.length || Number(b.allow) - Number(a.allow))[0];
  return best?.allow ?? true;
}
export class RobotsDisallowed extends Error { constructor(url: string) { super(`robots.txt disallows ${url}`); this.name = 'RobotsDisallowed'; } }
export type PoliteOpts = { httpFetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void>; gapMs?: number };
export class PoliteFetcher {
  private readonly last = new Map<string, number>();
  private readonly robots = new Map<string, Promise<string>>();
  private readonly f: typeof fetch; private readonly now: () => number; private readonly sleep: (ms: number) => Promise<void>; private readonly gap: number;
  constructor(o: PoliteOpts = {}) {
    [this.f, this.now, this.gap] = [o.httpFetch ?? fetch, o.now ?? Date.now, o.gapMs ?? 1000];
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  /** Waits until `gap` ms have passed since the last request to this host. */
  private async turn(host: string) {
    const wait = (this.last.get(host) ?? -Infinity) + this.gap - this.now();
    if (wait > 0) await this.sleep(wait);
    this.last.set(host, this.now());
  }
  private raw(url: string, init: RequestInit = {}) {
    return this.turn(new URL(url).host).then(() => this.f(url, { redirect: 'manual', ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } }));
  }
  /** robots.txt once per host (a missing file allows all; a 401/403 or network error disallows all), then the request itself. */
  async get(url: string, init: RequestInit = {}): Promise<Response> {
    const u = new URL(url);
    if (!this.robots.has(u.host)) this.robots.set(u.host, this.raw(`${u.origin}/robots.txt`).then(async (r) => (r.ok ? r.text() : r.status === 401 || r.status === 403 ? 'User-agent: *\nDisallow: /' : ''), () => 'User-agent: *\nDisallow: /'));
    if (!robotsAllows(await this.robots.get(u.host)!, u.pathname + u.search)) throw new RobotsDisallowed(url);
    return this.raw(url, init);
  }
}
