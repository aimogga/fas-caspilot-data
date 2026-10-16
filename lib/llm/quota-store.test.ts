import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MemoryQuotaStore, OpenRouterGuard, type QuotaStore } from './guard';
import { generateJson, LlmError } from './index';
import { defaultQuotaStore, SupabaseQuotaStore } from './quota-store';

// A stubbed rpc and a mocked fetch only: no database, no network, no real keys.
const input = { system: 'Cite stored rows only.', prompt: 'Synthetic public rows', schema: z.object({ summary: z.string() }) };
const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: '{"summary":"ok"}' } }] }), { status: 200 });
const fetchMock = vi.fn<typeof fetch>();
const rpcClient = (result: { data: unknown; error: { code?: string; message: string } | null } | Error) => {
  const rpc = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { rpc, db: { rpc } as unknown as SupabaseClient };
};
const statuses = (err: unknown) => (err as LlmError).attempts.map((a) => a.status);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEMINI_API_KEY', '');
  vi.stubEnv('OPENROUTER_API_KEY', 'not-a-secret');
  vi.stubEnv('OPENROUTER_MODEL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('SupabaseQuotaStore (F-508a2)', () => {
  it('calls llm_reserve with the provider and both caps and returns its answer', async () => {
    const { rpc, db } = rpcClient({ data: true, error: null });
    const store = new SupabaseQuotaStore(db, { rpm: 18, daily: 45 });
    expect(await store.reserve('openrouter')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('llm_reserve', { p_provider: 'openrouter', p_rpm_limit: 18, p_daily_limit: 45 });
    const full = new SupabaseQuotaStore(rpcClient({ data: false, error: null }).db, { rpm: 18, daily: 45 });
    expect(await full.reserve('openrouter')).toBe(false);
  });

  it('throws on a database error, naming the code only', async () => {
    const store = new SupabaseQuotaStore(rpcClient({ data: null, error: { code: '42501', message: 'permission denied' } }).db);
    await expect(store.reserve('openrouter')).rejects.toThrow('llm_reserve failed: 42501');
  });

  it.each([
    ['an rpc error', rpcClient({ data: null, error: { code: 'PGRST202', message: 'not found' } }).db],
    ['a network failure', rpcClient(new TypeError('fetch failed')).db],
  ])('fails closed on %s: OpenRouter is skipped, never called uncounted', async (_, db) => {
    const guard = new OpenRouterGuard(new SupabaseQuotaStore(db));
    const err = await generateJson(input, { guard }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(statuses(err)).toEqual(['missing_key', 'openrouter_quota_unavailable']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a store that throws synchronously also fails closed', async () => {
    const broken: QuotaStore = {
      reserve: () => {
        throw new Error('boom');
      },
    };
    expect(await new OpenRouterGuard(broken).admit('meta-llama/llama-3.3-70b-instruct:free')).toBe('openrouter_quota_unavailable');
  });

  it('sends the call once the durable store reserves a slot', async () => {
    fetchMock.mockResolvedValueOnce(ok());
    const guard = new OpenRouterGuard(new SupabaseQuotaStore(rpcClient({ data: true, error: null }).db));
    expect((await generateJson(input, { guard })).meta.provider).toBe('openrouter');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('defaultQuotaStore: store selection', () => {
  it('uses Postgres when the server has the Supabase URL and service-role key', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'not-a-secret');
    expect(defaultQuotaStore()).toBeInstanceOf(SupabaseQuotaStore);
  });

  it.each([
    ['no service-role key', { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' }],
    ['no URL', { NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: 'not-a-secret' }],
  ])('falls back to the in-memory store with %s', (_, env) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    expect(defaultQuotaStore()).toBeInstanceOf(MemoryQuotaStore);
  });
});
