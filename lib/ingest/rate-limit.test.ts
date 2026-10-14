import { describe, expect, it } from 'vitest';
import { RateLimiter, RateLimitExceeded } from './rate-limit';

/** Fake clock: `sleep` advances time instead of waiting. */
const clock = (t = Date.UTC(2026, 9, 12, 13, 0, 0)) => {
  const c = { t, slept: [] as number[] }; return Object.assign(c, { now: () => c.t, sleep: async (ms: number) => { c.slept.push(ms); c.t += ms; } }); };
describe('integration: Grants.gov rate-limit handling (60/min, 10,000/day) with a fake clock', () => {
  it('the 61st call within a minute waits until the oldest call leaves the rolling window', async () => {
    const k = clock();
    const l = new RateLimiter({ now: k.now, sleep: k.sleep });
    for (let i = 0; i < 60; i++) { await l.take(); k.t += 500; }
    await l.take();
    expect([k.slept, k.t]).toEqual([[30_000], Date.UTC(2026, 9, 12, 13, 1, 0)]);
    await l.take();
    expect(k.slept).toEqual([30_000, 500]);
  });
  it('the 10,001st call in a UTC day throws RateLimitExceeded; a new UTC day resets the budget', async () => {
    const k = clock(Date.UTC(2026, 9, 12, 23, 59, 0));
    const l = new RateLimiter({ perMinute: 1_000_000, now: k.now, sleep: k.sleep });
    for (let i = 0; i < 10_000; i++) await l.take();
    await expect(l.take()).rejects.toThrow(RateLimitExceeded); await expect(l.take()).rejects.toThrow('10000 requests per UTC day');
    k.t += 60_000;
    await expect(l.take()).resolves.toBeUndefined();
  });
  it('a quiet minute clears the rolling window; defaults are 60 and 10,000', async () => {
    const k = clock();
    const l = new RateLimiter({ perMinute: 2, now: k.now, sleep: k.sleep });
    await l.take(); await l.take(); k.t += 61_000; await l.take();
    expect([k.slept, new RateLimiter().perMinute, new RateLimiter().perDay]).toEqual([[], 60, 10_000]);
  });
});
