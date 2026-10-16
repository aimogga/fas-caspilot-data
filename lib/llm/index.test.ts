import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { generateJson, LlmError } from './index';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENROUTER_MODEL } from './providers';

// Mocked fetch only: no real network, no real keys. The values below are fakes the tests look for in errors.
const GEMINI_KEY = 'test-gemini-key-SECRET';
const OPENROUTER_KEY = 'test-openrouter-key-SECRET';
const PROMPT = 'Public ACS rows for Weber County: poverty 11.2% (synthetic)';
const schema = z.object({ summary: z.string(), citations: z.array(z.string()) });
const good = { summary: 'Need is above the state median.', citations: ['acs5:2024:row-1'] };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const gemini = (text: string) =>
  json({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7 } });
const openrouter = (content: string) => json({ choices: [{ message: { content } }], usage: { prompt_tokens: 20, completion_tokens: 9 } });

const fetchMock = vi.fn<typeof fetch>();
const urls = () => fetchMock.mock.calls.map(([u]) => String(u));
const input = { system: 'Cite stored rows only.', prompt: PROMPT, schema };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('GEMINI_API_KEY', GEMINI_KEY);
  vi.stubEnv('OPENROUTER_API_KEY', OPENROUTER_KEY);
  vi.stubEnv('GEMINI_MODEL', '');
  vi.stubEnv('OPENROUTER_MODEL', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generateJson (F-508a)', () => {
  it('returns Gemini output validated, with meta, using JSON mode and a response schema', async () => {
    fetchMock.mockResolvedValueOnce(gemini(JSON.stringify(good)));
    const { data, meta } = await generateJson(input);
    expect(data).toEqual(good);
    expect(meta).toMatchObject({ provider: 'gemini', model: DEFAULT_GEMINI_MODEL, attempts: 1, input_tokens: 12, output_tokens: 7 });
    expect(meta.latency_ms).toBeGreaterThanOrEqual(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`models/${DEFAULT_GEMINI_MODEL}:generateContent`);
    expect(new Headers(init?.headers).get('x-goog-api-key')).toBe(GEMINI_KEY);
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema).toMatchObject({ type: 'object', required: ['summary', 'citations'] });
  });

  it('honours GEMINI_MODEL', async () => {
    vi.stubEnv('GEMINI_MODEL', 'gemini-2.5-pro');
    fetchMock.mockResolvedValueOnce(gemini(JSON.stringify(good)));
    expect((await generateJson(input)).meta.model).toBe('gemini-2.5-pro');
    expect(urls()[0]).toContain('models/gemini-2.5-pro:generateContent');
  });

  it('falls back to OpenRouter on a Gemini 429, with JSON mode and the attribution headers', async () => {
    fetchMock.mockResolvedValueOnce(json({ error: 'quota' }, 429)).mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    const { data, meta } = await generateJson(input);
    expect(data).toEqual(good);
    expect(meta).toMatchObject({ provider: 'openrouter', model: DEFAULT_OPENROUTER_MODEL, attempts: 2, input_tokens: 20, output_tokens: 9 });
    expect(DEFAULT_OPENROUTER_MODEL).toMatch(/:free$/);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${OPENROUTER_KEY}`);
    expect(headers.get('HTTP-Referer')).toBeTruthy();
    expect(headers.get('X-Title')).toBe('FAS Evidence');
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: DEFAULT_OPENROUTER_MODEL, response_format: { type: 'json_object' } });
  });

  it.each([500, 503])('falls back on a Gemini %i', async (status) => {
    fetchMock.mockResolvedValueOnce(json({}, status)).mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    expect((await generateJson(input)).meta.provider).toBe('openrouter');
  });

  it('falls back when Gemini returns invalid JSON', async () => {
    fetchMock.mockResolvedValueOnce(gemini('{"summary": "cut off')).mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    const { data, meta } = await generateJson(input);
    expect(data).toEqual(good);
    expect(meta.provider).toBe('openrouter');
  });

  it('falls back when Gemini JSON fails the schema, and accepts fenced OpenRouter JSON', async () => {
    fetchMock
      .mockResolvedValueOnce(gemini(JSON.stringify({ summary: 1 })))
      .mockResolvedValueOnce(openrouter('```json\n' + JSON.stringify(good) + '\n```'));
    expect((await generateJson(input)).data).toEqual(good);
  });

  it('falls back on a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    expect((await generateJson(input)).meta.provider).toBe('openrouter');
  });

  it.each([400, 401, 403])('treats a Gemini %i as a config error: logged by status, not retried, OpenRouter still tried', async (status) => {
    fetchMock.mockResolvedValueOnce(json({ error: { message: `bad key ${GEMINI_KEY}` } }, status));
    fetchMock.mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    await generateJson(input);
    expect(urls().filter((u) => u.includes('generativelanguage'))).toHaveLength(1);
    expect(urls()[1]).toContain('openrouter.ai');
    expect(console.warn).toHaveBeenCalledWith(`[llm] gemini config error: ${status}`);
  });

  it('calls OpenRouter only when GEMINI_API_KEY is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    fetchMock.mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    const { meta } = await generateJson(input);
    expect(meta).toMatchObject({ provider: 'openrouter', attempts: 1 });
    expect(urls()).toEqual(['https://openrouter.ai/api/v1/chat/completions']);
  });

  it('times out a hung Gemini call and falls back', async () => {
    fetchMock.mockImplementationOnce(
      (_url, init) => new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    );
    fetchMock.mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    const { meta } = await generateJson({ ...input, timeoutMs: 20 });
    expect(meta.provider).toBe('openrouter');
    expect(console.warn).toHaveBeenCalledWith('[llm] gemini failed: timeout');
  });

  it('throws a typed LlmError listing each attempt, with no key, prompt or response body', async () => {
    fetchMock.mockResolvedValueOnce(json({ echo: PROMPT, key: GEMINI_KEY }, 429));
    fetchMock.mockResolvedValueOnce(json({ echo: PROMPT, key: OPENROUTER_KEY }, 502));
    const err = await generateJson(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect((err as LlmError).attempts).toEqual([
      { provider: 'gemini', status: 429 },
      { provider: 'openrouter', status: 502 },
    ]);
    const exposed = [String(err), JSON.stringify(err), (err as Error).stack, JSON.stringify(vi.mocked(console.warn).mock.calls)].join('\n');
    for (const secret of [GEMINI_KEY, OPENROUTER_KEY, PROMPT, 'echo']) expect(exposed).not.toContain(secret);
  });

  it('throws LlmError without calling anything when both keys are missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('OPENROUTER_API_KEY', '');
    const err = await generateJson(input).catch((e: unknown) => e);
    expect((err as LlmError).attempts).toEqual([
      { provider: 'gemini', status: 'missing_key' },
      { provider: 'openrouter', status: 'missing_key' },
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('forceProvider (F-508i, eval only)', () => {
  it('is refused without LLM_EVAL=1, before any call', async () => {
    await expect(generateJson(input, { forceProvider: 'openrouter' })).rejects.toThrow(/eval-only/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is refused inside the Next server even with LLM_EVAL=1', async () => {
    vi.stubEnv('LLM_EVAL', '1');
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    await expect(generateJson(input, { forceProvider: 'gemini' })).rejects.toThrow(/eval-only/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('under LLM_EVAL=1 calls only the forced provider and never falls back', async () => {
    vi.stubEnv('LLM_EVAL', '1');
    vi.stubEnv('NEXT_RUNTIME', '');
    fetchMock.mockResolvedValueOnce(json({}, 429));
    await expect(generateJson(input, { forceProvider: 'gemini' })).rejects.toMatchObject({ attempts: [{ provider: 'gemini', status: 429 }] });
    fetchMock.mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    expect((await generateJson(input, { forceProvider: 'openrouter' })).meta.provider).toBe('openrouter');
    expect(urls()).toHaveLength(2);
  });

  it('a request path cannot set it: a forceProvider key in the input is ignored and the app never names it', async () => {
    vi.stubEnv('LLM_EVAL', '1');
    const body = { ...input, forceProvider: 'openrouter' } as typeof input; // as if a JSON body were spread into the input
    fetchMock.mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(openrouter(JSON.stringify(good)));
    expect((await generateJson(body)).meta).toMatchObject({ provider: 'openrouter', attempts: 2 }); // normal fallback order
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
    expect(files('app').filter((f) => /forceProvider|LLM_EVAL/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
