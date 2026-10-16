import 'server-only';
import { z } from 'zod';
import { OpenRouterGuard, type GuardSkip, type RetryHeaders } from './guard';
import { defaultQuotaStore } from './quota-store';
import {
  callGemini,
  callOpenRouter,
  openRouterModel,
  ProviderHttpError,
  type Provider,
  type ProviderRequest,
  type ProviderResult,
} from './providers';

/** The one in-app LLM entry point (D-003): Gemini first, OpenRouter's free tier as the fallback. Server-only.
 * Prompts carry public data and suppressed aggregates only, never FAS client rows (golden rules 2 and 5). */
export type { Provider } from './providers';
export { MemoryQuotaStore, OpenRouterGuard, type QuotaStore } from './guard';
export { defaultQuotaStore, SupabaseQuotaStore } from './quota-store';

/** Why an attempt failed or was skipped: the HTTP status, or a word. Never a key, a prompt or a response body. */
export type AttemptStatus = number | 'missing_key' | 'timeout' | 'network' | 'invalid_json' | 'invalid_schema' | GuardSkip;
export type LlmAttempt = { provider: Provider; status: AttemptStatus };

export type LlmMeta = {
  provider: Provider;
  model: string;
  /** Provider calls made, including the one that succeeded (a missing key makes no call). */
  attempts: number;
  input_tokens: number | null;
  output_tokens: number | null;
  latency_ms: number;
};

export class LlmError extends Error {
  readonly name = 'LlmError';
  constructor(readonly attempts: LlmAttempt[]) {
    super(`All LLM providers failed: ${attempts.map((a) => `${a.provider} ${a.status}`).join(', ')}`);
  }
}

export type GenerateJsonInput<T extends z.ZodType> = { system: string; prompt: string; schema: T; timeoutMs?: number };
/** Tests inject a guard with their own clock and store; the app uses one per server instance, counting in Postgres when it can.
 * `forceProvider` is eval-only (F-508i): one provider, no fallback, allowed only under `LLM_EVAL=1` and outside the Next server
 * (route handlers run with `NEXT_RUNTIME` set). It is a separate argument, so a request body spread into `input` cannot set it. */
export type GenerateJsonOptions = { guard?: OpenRouterGuard; forceProvider?: Provider };

let defaultGuard: OpenRouterGuard | undefined;

export const DEFAULT_TIMEOUT_MS = 30_000;
/** Gemini answers these when the key, model or request is wrong: retrying Gemini cannot help. */
const CONFIG_STATUSES = new Set([400, 401, 403]);

type Step = { provider: Provider; key: string | undefined; call: (key: string, req: ProviderRequest) => Promise<ProviderResult> };

export async function generateJson<T extends z.ZodType>(
  input: GenerateJsonInput<T>,
  options: GenerateJsonOptions = {},
): Promise<{ data: z.infer<T>; meta: LlmMeta }> {
  const force = options.forceProvider;
  if (force && (process.env.LLM_EVAL !== '1' || process.env.NEXT_RUNTIME)) throw new Error('forceProvider is eval-only: set LLM_EVAL=1 and run outside the app');
  const guard = options.guard ?? (defaultGuard ??= new OpenRouterGuard(defaultQuotaStore()));
  const started = Date.now();
  const jsonSchema = z.toJSONSchema(input.schema) as Record<string, unknown>;
  delete jsonSchema.$schema; // Gemini's response schema takes the body only
  const steps: Step[] = ([
    { provider: 'gemini', key: process.env.GEMINI_API_KEY, call: callGemini },
    { provider: 'openrouter', key: process.env.OPENROUTER_API_KEY, call: callOpenRouter },
  ] as Step[]).filter((s) => !force || s.provider === force);
  const failed: LlmAttempt[] = [];
  let calls = 0;
  for (const step of steps) {
    if (!step.key) {
      failed.push({ provider: step.provider, status: 'missing_key' });
      continue;
    }
    if (step.provider === 'openrouter') {
      const skip = await guard.admit(openRouterModel());
      if (skip) {
        failed.push({ provider: step.provider, status: skip });
        console.warn(`[llm] openrouter skipped: ${skip}`);
        continue;
      }
    }
    calls += 1;
    const outcome = await attempt(step, step.key, input, jsonSchema);
    if ('data' in outcome) {
      const { result, data } = outcome;
      const meta: LlmMeta = {
        provider: step.provider,
        model: result.model,
        attempts: calls,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        latency_ms: Date.now() - started,
      };
      return { data, meta };
    }
    failed.push({ provider: step.provider, status: outcome.status });
    if (step.provider === 'openrouter') guard.recordFailure(outcome.status, outcome.retry);
    const kind = step.provider === 'gemini' && CONFIG_STATUSES.has(outcome.status as number) ? 'config error' : 'failed';
    console.warn(`[llm] ${step.provider} ${kind}: ${outcome.status}`);
  }
  throw new LlmError(failed);
}

async function attempt<T extends z.ZodType>(
  step: Step,
  key: string,
  input: GenerateJsonInput<T>,
  jsonSchema: Record<string, unknown>,
): Promise<{ result: ProviderResult; data: z.infer<T> } | { status: AttemptStatus; retry?: RetryHeaders }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let result: ProviderResult;
  try {
    result = await step.call(key, { system: input.system, prompt: input.prompt, jsonSchema, signal: controller.signal });
  } catch (err) {
    if (err instanceof ProviderHttpError) return { status: err.status, retry: err.retry };
    if (err instanceof SyntaxError) return { status: 'invalid_json' };
    return { status: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(result.text));
  } catch {
    return { status: 'invalid_json' };
  }
  const checked = input.schema.safeParse(parsed);
  return checked.success ? { result, data: checked.data } : { status: 'invalid_schema' };
}

/** Some free models wrap JSON in a ```json fence even in JSON mode. */
function stripFence(text: string): string {
  const m = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text);
  return m ? m[1] : text;
}
