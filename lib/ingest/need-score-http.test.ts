import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NeedScoreHttp } from './need-score-http';

const req = (token?: string): Request =>
  new Request('http://127.0.0.1/api/ingest/need-score', { method: 'POST', headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
const client = {} as SupabaseClient;

afterEach(() => vi.restoreAllMocks());

describe('NeedScoreHttp', () => {
  it('rejects a missing, wrong or unconfigured token before running', async () => {
    const run = vi.fn();
    expect((await NeedScoreHttp.handle(req(), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect((await NeedScoreHttp.handle(req('t'), { env: { INGEST_TOKEN: 's' }, run })).status).toBe(401);
    expect((await NeedScoreHttp.handle(req('s'), { env: {}, run })).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the recompute with the database client and returns what it scored', async () => {
    const run = vi.fn().mockResolvedValue({ version: 'v1', scored: 29 });
    const res = await NeedScoreHttp.handle(req('s'), { env: { INGEST_TOKEN: 's' }, client, run });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'v1', scored: 29 });
    expect(run).toHaveBeenCalledWith(client);
  });

  it('logs and alerts a redacted failure, then answers 500 without the cause', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const alertFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    const env = { INGEST_TOKEN: 'not-a-secret', INGEST_ALERT_WEBHOOK_URL: 'https://n8n.example.test/hook' };
    const run = vi.fn().mockRejectedValue(new Error('weights must sum to 1 not-a-secret'));
    const res = await NeedScoreHttp.handle(req('not-a-secret'), { env, client, run, alertFetch });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'recompute failed' });
    expect(JSON.stringify(log.mock.calls)).toContain('weights must sum to 1');
    expect(JSON.stringify(log.mock.calls)).not.toContain('not-a-secret');
    expect(alertFetch).toHaveBeenCalledTimes(1);
    expect(String(alertFetch.mock.calls[0]?.[1]?.body)).toContain('"source":"need-score"');
  });
});

type Wf = {
  active: boolean;
  nodes: { name: string; type: string; parameters: Record<string, unknown>; credentials?: Record<string, { id: string; name: string }> }[];
  connections: Record<string, { main: { node: string }[][] }>;
};

describe('n8n need-score-recompute', () => {
  const text = readFileSync('n8n/need-score-recompute.json', 'utf8');
  const wf = JSON.parse(text) as Wf;
  const node = (name: string) => wf.nodes.find((n) => n.name === name);

  it('is inactive, weekly after the census slots, and callable from the census workflows', () => {
    expect(wf.active).toBe(false);
    const rule = node('Schedule need-score recompute')?.parameters.rule as { interval: { expression: string }[] };
    expect(rule.interval[0]?.expression).toMatch(/^\d+ (1[6-9]|2[0-3]) \* \* [0-6]$/);
    expect(node('Called after a census ingest')?.type).toBe('n8n-nodes-base.executeWorkflowTrigger');
  });

  it('POSTs the fas-dev need-score path with the ingest-token credential, never an inlined secret', () => {
    const http = node('POST need-score recompute');
    expect(http?.parameters).toMatchObject({ method: 'POST', url: 'https://fas-caspilot-data.vercel.app/api/ingest/need-score', authentication: 'predefinedCredentialType', nodeCredentialType: 'httpHeaderAuth' });
    expect(http?.credentials?.httpHeaderAuth).toEqual({ id: 'hJd3gjSOX9o2ITvB', name: 'FAS ingest token' });
    expect(http?.parameters).not.toHaveProperty('headerParameters');
    expect(text).not.toMatch(/\$env\./);
    expect(text).not.toMatch(/Bearer|authorization|x-fas-alert-secret/i);
  });

  it('sends a non-200 answer to the ingest-failure alert webhook', () => {
    expect(wf.connections['POST need-score recompute']?.main[0]?.[0]?.node).toBe('Not 200?');
    expect(wf.connections['Not 200?']?.main[0]?.[0]?.node).toBe('POST ingest failure alert');
    const alert = node('POST ingest failure alert');
    expect(alert?.parameters.url).toBe('https://n8n.casepilot.io/webhook/ingest-failure-alert');
    expect(alert?.credentials?.httpHeaderAuth).toEqual({ id: 'XYit0wFy8TngKt2F', name: 'FAS ingest alert secret' });
    expect(String(alert?.parameters.jsonBody)).toContain("source: 'need-score'");
    expect(JSON.stringify(node('Not 200?')?.parameters)).toContain('"operation":"notEquals"');
  });
});
