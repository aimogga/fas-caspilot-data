/** Thrown when the UTC-day budget is spent; callers stop instead of burning the key's quota. */
export class RateLimitExceeded extends Error {
  constructor(limit: number) { super(`rate limit exceeded: ${limit} requests per UTC day`); this.name = 'RateLimitExceeded'; }
}
export type RateLimiterOpts = { perMinute?: number; perDay?: number; now?: () => number; sleep?: (ms: number) => Promise<void> };

/** Rolling 60s window plus a UTC-day counter (Simpler.Grants.gov: 60/min, 10,000/day). Pure; clock and sleep are injectable. */
export class RateLimiter {
  readonly perMinute: number;
  readonly perDay: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private recent: number[] = [];
  private day = '';
  private used = 0;
  constructor(opts: RateLimiterOpts = {}) {
    [this.perMinute, this.perDay, this.now] = [opts.perMinute ?? 60, opts.perDay ?? 10_000, opts.now ?? Date.now];
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }
  /** Resolves when a request may be sent (sleeping out the minute window); throws when the day budget is gone. */
  async take(): Promise<void> {
    for (;;) {
      const t = this.now();
      const day = new Date(t).toISOString().slice(0, 10);
      if (day !== this.day) [this.day, this.used] = [day, 0];
      if (this.used >= this.perDay) throw new RateLimitExceeded(this.perDay);
      this.recent = this.recent.filter((x) => x > t - 60_000);
      if (this.recent.length < this.perMinute) { this.recent.push(t); this.used++; return; }
      await this.sleep(this.recent[0] + 60_000 - t);
    }
  }
}
