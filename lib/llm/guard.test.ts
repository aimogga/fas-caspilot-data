import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { cooldownMs, DEFAULT_DAILY_LIMIT, DEFAULT_RPM_LIMIT, limitsFromEnv, MemoryQuotaStore, OpenRouterGuard } from './guard';
import { generateJson, LlmError } from './index';
import { callOpenRouter } from './providers';

// Mocked fetch and an injected clock only: no real network, no real keys, no real time.
const schema = z.object({ summary: z.string() });
const input = { system: 'Cite stored rows only.', prompt: 'Synthetic public rows', schema };
const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"ok"}' } }] }), { status: 200 });
const fail = (status: number, headers: Record<string, string> = {}) => new Response('{}', { status, headers });

const fetchMock = vi.fn<typeof fetch>();
let now = Date.parse('2026-10-15T12:00:00Z');
const clock = () => now;
const guardWith = (rpm = DEFAULT_RPM_LIMIT, daily = DEFAULT_DAILY_LIMIT) => new OpenRouterGuard(new MemoryQuotaStore({ rpm, daily }), clock);
const statuses = (err: unknown) => (err as LlmError).attempts.map((a) => a.status);

beforeEach(() => {
  now = Date.parse('2026-10-15T12:00:00Z');
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEMINI_API_KEY', ''); // OpenRouter is the only provider in these tests
  vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
  vi.stubEnv('OPENROUTER_MODEL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('OpenRouter free-tier guard (F-508a1)', () => {
  it.each(['openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct', 'x/model:free-ish'])('refuses paid model %s without a fetch', async (model) => {
    vi.stubEnv('OPENROUTER_MODEL', model);
    const err = await generateJson(input, { guard: guardWith() }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(statuses(err)).toEqual(['missing_key', 'paid_model_refused']);
    await expect(callOpenRouter('k', { system: '', prompt: '', jsonSchema: {}, signal: new AbortController().signal })).rejects.toThrow(
      'paid_model_refused',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stops at the per-minute cap and resets on the next minute', async () => {
    fetchMock.mockImplementation(async () => ok());
    const guard = guardWith(2, 100);
    await generateJson(input, { guard });
    await generateJson(input, { guard });
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toContain('openrouter_quota_exhausted');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now += 60_000;
    expect((await generateJson(input, { guard })).meta.provider).toBe('openrouter');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('stops at the daily cap and resets on the next UTC day', async () => {
    fetchMock.mockImplementation(async () => ok());
    now = Date.parse('2026-10-15T23:57:00Z');
    const guard = guardWith(100, 2);
    await generateJson(input, { guard });
    now += 60_000;
    await generateJson(input, { guard });
    now += 60_000; // 23:59, same UTC day, new minute
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toContain('openrouter_quota_exhausted');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now += 60_000; // 00:00 next UTC day
    await generateJson(input, { guard });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('makes one attempt on a 429 and skips OpenRouter until Retry-After passes', async () => {
    const guard = guardWith();
    fetchMock.mockResolvedValueOnce(fail(429, { 'retry-after': '30' }));
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toEqual(['missing_key', 429]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 29_000;
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toEqual(['missing_key', 'openrouter_cooldown']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now += 1_000;
    fetchMock.mockResolvedValueOnce(ok());
    expect((await generateJson(input, { guard })).meta.provider).toBe('openrouter');
  });

  it('uses X-RateLimit-Reset when Retry-After is absent', async () => {
    const guard = guardWith();
    fetchMock.mockResolvedValueOnce(fail(429, { 'x-ratelimit-reset': String(now + 120_000) }));
    await generateJson(input, { guard }).catch(() => {});
    now += 119_000;
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toContain('openrouter_cooldown');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('works out cooldowns from either header, defaulting to 60 s', () => {
    const t = Date.parse('2026-10-15T12:00:00Z');
    expect(cooldownMs({ retryAfter: '5', rateLimitReset: null }, t)).toBe(5_000);
    expect(cooldownMs({ retryAfter: 'Thu, 15 Oct 2026 12:00:10 GMT', rateLimitReset: null }, t)).toBe(10_000);
    expect(cooldownMs({ retryAfter: null, rateLimitReset: String(t / 1000 + 20) }, t)).toBe(20_000);
    expect(cooldownMs(undefined, t)).toBe(60_000);
    expect(cooldownMs({ retryAfter: 'soon', rateLimitReset: 'later' }, t)).toBe(60_000);
  });

  it('turns OpenRouter off for the rest of the UTC day after a 402', async () => {
    now = Date.parse('2026-10-15T08:00:00Z');
    const guard = guardWith();
    fetchMock.mockResolvedValueOnce(fail(402));
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toEqual(['missing_key', 402]);
    now = Date.parse('2026-10-15T23:59:59Z');
    expect(statuses(await generateJson(input, { guard }).catch((e: unknown) => e))).toEqual(['missing_key', 'openrouter_disabled_today']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now = Date.parse('2026-10-16T00:00:00Z');
    fetchMock.mockResolvedValueOnce(ok());
    expect((await generateJson(input, { guard })).meta.provider).toBe('openrouter');
  });

  it('defaults the caps to 18/min and 45/day and reads env overrides', () => {
    expect(limitsFromEnv()).toEqual({ rpm: 18, daily: 45 });
    vi.stubEnv('OPENROUTER_RPM_LIMIT', '5');
    vi.stubEnv('OPENROUTER_DAILY_LIMIT', '10');
    expect(limitsFromEnv()).toEqual({ rpm: 5, daily: 10 });
    vi.stubEnv('OPENROUTER_RPM_LIMIT', 'lots');
    expect(limitsFromEnv().rpm).toBe(18);
  });
});
