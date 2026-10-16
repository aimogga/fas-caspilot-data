import 'server-only';
import type { Provider } from './providers';

/** Keeps the OpenRouter fallback inside OpenRouter's free tier (F-508a1, #227).
 * Published free limits: 20 requests/min on `:free` models, 50/day under 10 purchased credits.
 * The local caps sit below them. The key's $0 credit limit is a second guard outside the code. */

export const DEFAULT_RPM_LIMIT = 18;
export const DEFAULT_DAILY_LIMIT = 45;
export const DEFAULT_COOLDOWN_MS = 60_000;

export type GuardSkip =
  | 'paid_model_refused'
  | 'openrouter_quota_exhausted'
  | 'openrouter_quota_unavailable'
  | 'openrouter_cooldown'
  | 'openrouter_disabled_today';

export const isFreeModel = (model: string) => model.endsWith(':free');
export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Counters behind the caps: in memory per server instance here, or durable in Postgres (`SupabaseQuotaStore`, #224). */
export interface QuotaStore {
  /** Takes one slot for `provider` at `now` if the minute and the UTC day both have one left. */
  reserve(provider: Provider, now: number): boolean | Promise<boolean>;
}

export type QuotaLimits = { rpm: number; daily: number };

function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function limitsFromEnv(): QuotaLimits {
  return { rpm: envLimit('OPENROUTER_RPM_LIMIT', DEFAULT_RPM_LIMIT), daily: envLimit('OPENROUTER_DAILY_LIMIT', DEFAULT_DAILY_LIMIT) };
}

type Window = { key: string; count: number };

export class MemoryQuotaStore implements QuotaStore {
  private readonly windows = new Map<string, { minute: Window; day: Window }>();
  constructor(private readonly limits: QuotaLimits = limitsFromEnv()) {}

  reserve(provider: Provider, now: number): boolean {
    const minuteKey = String(Math.floor(now / 60_000));
    const dayKey = utcDay(now);
    const w = this.windows.get(provider) ?? { minute: { key: minuteKey, count: 0 }, day: { key: dayKey, count: 0 } };
    if (w.minute.key !== minuteKey) w.minute = { key: minuteKey, count: 0 };
    if (w.day.key !== dayKey) w.day = { key: dayKey, count: 0 };
    this.windows.set(provider, w);
    if (w.minute.count >= this.limits.rpm || w.day.count >= this.limits.daily) return false;
    w.minute.count += 1;
    w.day.count += 1;
    return true;
  }
}

/** Rate-limit headers from an OpenRouter 429. Header values only: never a body or a key. */
export type RetryHeaders = { retryAfter: string | null; rateLimitReset: string | null };

/** Retry-After is seconds or an HTTP date; X-RateLimit-Reset is an epoch time (ms or s). Falls back to 60 s. */
export function cooldownMs(h: RetryHeaders | undefined, now: number): number {
  const retryAfter = h?.retryAfter?.trim();
  if (retryAfter) {
    const secs = Number(retryAfter);
    const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(retryAfter) - now;
    if (ms > 0) return ms;
  }
  const reset = Number(h?.rateLimitReset);
  if (Number.isFinite(reset) && reset > 0) {
    const ms = (reset > 1e12 ? reset : reset * 1000) - now;
    if (ms > 0) return ms;
  }
  return DEFAULT_COOLDOWN_MS;
}

export class OpenRouterGuard {
  private cooldownUntil = 0;
  private disabledDay: string | null = null;

  constructor(
    private readonly store: QuotaStore = new MemoryQuotaStore(),
    private readonly now: () => number = Date.now,
  ) {}

  /** null: a slot is reserved and one call may go out. Otherwise the reason nothing is sent. */
  async admit(model: string): Promise<GuardSkip | null> {
    if (!isFreeModel(model)) return 'paid_model_refused';
    const t = this.now();
    if (this.disabledDay === utcDay(t)) return 'openrouter_disabled_today';
    if (t < this.cooldownUntil) return 'openrouter_cooldown';
    let reserved: boolean;
    try {
      reserved = await this.store.reserve('openrouter', t);
    } catch {
      return 'openrouter_quota_unavailable'; // fail closed: an uncounted call could pass the free-tier cap
    }
    return reserved ? null : 'openrouter_quota_exhausted';
  }

  /** 429 starts a cooldown; 402 (negative balance) turns OpenRouter off until the next UTC day. */
  recordFailure(status: number | string, headers?: RetryHeaders): void {
    const t = this.now();
    if (status === 429) this.cooldownUntil = t + cooldownMs(headers, t);
    if (status === 402) this.disabledDay = utcDay(t);
  }
}
