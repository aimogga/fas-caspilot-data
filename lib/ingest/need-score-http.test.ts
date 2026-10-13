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
