import 'server-only';
import { isFreeModel, type RetryHeaders } from './guard';

/** Provider calls behind `generateJson` (lib/llm/index.ts). Callers never import this file (D-003). */
export type Provider = 'gemini' | 'openrouter';

export type ProviderRequest = {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  signal: AbortSignal;
};

export type ProviderResult = { model: string; text: string; inputTokens: number | null; outputTokens: number | null };

/** A provider HTTP failure. Carries the status only: never the key, the prompt or the response body. */
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retry?: RetryHeaders,
  ) {
    super(`HTTP ${status}`);
  }
}

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
const SITE_URL = 'https://fas-caspilot-data.vercel.app';
const SITE_TITLE = 'FAS Evidence';

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export async function callGemini(key: string, req: ProviderRequest): Promise<ProviderResult> {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: [{ text: req.prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: req.jsonSchema },
    }),
    signal: req.signal,
  });
  if (!res.ok) throw new ProviderHttpError(res.status);
  const body = (await res.json()) as GeminiResponse;
  const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const usage = body.usageMetadata;
  return { model, text, inputTokens: usage?.promptTokenCount ?? null, outputTokens: usage?.candidatesTokenCount ?? null };
}

type OpenRouterResponse = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** OpenAI-compatible JSON mode. Free models rarely honour `json_schema`, so the schema rides in the system message. */
export const openRouterModel = () => process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;

export async function callOpenRouter(key: string, req: ProviderRequest): Promise<ProviderResult> {
  const model = openRouterModel();
  // Second lock behind OpenRouterGuard.admit: a paid model never reaches fetch.
  if (!isFreeModel(model)) throw new Error('paid_model_refused');
  const system = `${req.system}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
      'HTTP-Referer': SITE_URL,
      'X-Title': SITE_TITLE,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: req.prompt },
      ],
      response_format: { type: 'json_object' },
    }),
    signal: req.signal,
  });
  if (!res.ok) {
    const retry = { retryAfter: res.headers.get('retry-after'), rateLimitReset: res.headers.get('x-ratelimit-reset') };
    throw new ProviderHttpError(res.status, retry);
  }
  const body = (await res.json()) as OpenRouterResponse;
  const usage = body.usage;
  return {
    model,
    text: body.choices?.[0]?.message?.content ?? '',
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
  };
}
