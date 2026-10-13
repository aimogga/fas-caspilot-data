import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SahieHttp } from '../../lib/ingest/sahie-http';
import { IngestAlert, type IngestAlertPayload } from './ingest-alert';
import { PublicIndicatorIngest, type IndicatorRow } from './public-indicator';

type Row = Record<string, unknown>;

/** In-memory stand-in for the PostgREST calls PublicIndicatorIngest makes. Synthetic data only. */
function fakeDb() {
  const tables: Record<string, Row[]> = {
    geo_county: [],
    source_registry: [{ id: 'src-1', name: 'synthetic-source' }],
    ingest_run: [],
    public_indicator: [],
  };
  let seq = 0;
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    const filters: Array<[string, unknown]> = [];
    let patch: Row | null = null;
    let inserted: Row | null = null;
    const match = (r: Row) => filters.every(([k, v]) => r[k] === v);
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => {
        filters.push([k, v]);
        if (patch) rows.filter(match).forEach((r) => Object.assign(r, patch));
        return q;
      },
      single: async () => {
        const data = inserted ?? rows.find(match) ?? null;
        return { data, error: data ? null : { message: 'not found' } };
      },
      insert: (r: Row) => {
        inserted = { id: `run-${++seq}`, ...r };
        rows.push(inserted);
        return q;
      },
      update: (r: Row) => {
        patch = r;
        return q;
      },
      upsert: async (list: Row[], opts: { onConflict: string }) => {
        const keys = opts.onConflict.split(',');
        for (const r of list) {
          const hit = rows.find((x) => keys.every((k) => x[k] === r[k]));
          if (hit) Object.assign(hit, r);
          else rows.push({ ...r });
        }
        return { error: null };
      },
      then: (ok: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(ok),
    };
    return q;
  };
  return { tables, client: { from } as unknown as SupabaseClient };
}

const ROWS: IndicatorRow[] = ['49001', '49003'].map((geo_fips) => ({
  indicator_code: 'synthetic_rate', geo_fips, period: '2099', value: 1, moe: null, unit: 'pct', vintage: '2099',
}));

describe('PublicIndicatorIngest idempotency', () => {
  it('re-running a vintage logs a second run but does not duplicate rows', async () => {
    const db = fakeDb();
    await PublicIndicatorIngest.load(db.client, 'synthetic-source', 'c1', ROWS);
    await PublicIndicatorIngest.load(db.client, 'synthetic-source', 'c1', ROWS);
    expect(db.tables.public_indicator).toHaveLength(ROWS.length);
    expect(db.tables.ingest_run?.map((r) => r.status)).toEqual(['ok', 'ok']);
    expect(db.tables.ingest_run?.every((r) => r.rows_loaded === ROWS.length && r.checksum === 'c1')).toBe(true);
  });

  it('records a pre-load failure as an error run', async () => {
    const db = fakeDb();
    const id = await PublicIndicatorIngest.recordFailure(db.client, 'synthetic-source', 'parse failed');
    expect(id).toBe('run-1');
    expect(db.tables.ingest_run?.[0]).toMatchObject({ source_id: 'src-1', status: 'error', error: 'parse failed' });
    expect(await PublicIndicatorIngest.recordFailure(db.client, 'unregistered', 'x')).toBeNull();
  });
});

describe('IngestAlert', () => {
  it('redacts env values, truncates, and skips when no webhook is set', async () => {
    const env = { SYNTH_VALUE: 'synth-v-123' };
    const p = IngestAlert.payload('s', new Error(`bad synth-v-123 ${'x'.repeat(400)}`), env);
    expect(p.error).not.toContain('synth-v-123');
    expect(p.error.length).toBe(IngestAlert.MAX_ERROR);
    expect(await IngestAlert.notify(p, {}, async () => new Response())).toBe(false);
  });

  it('returns false instead of throwing when the webhook is down', async () => {
    const p = IngestAlert.payload('s', new Error('x'), {});
    const down = async (): Promise<Response> => {
      throw new Error('offline');
    };
    expect(await IngestAlert.notify(p, { INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' }, down)).toBe(false);
  });
});

describe('simulated failure triggers alert', () => {
  it('POST /api/ingest/sahie alerts n8n with a redacted payload and still returns 500', async () => {
    const sent: Array<{ url: string; body: IngestAlertPayload }> = [];
    const env = {
      INGEST_TOKEN: 'synth-tok',
      INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook',
      CENSUS_API_KEY: 'synth-cen1',
    };
    const res = await SahieHttp.handle(
      new Request('http://127.0.0.1/api/ingest/sahie', {
        method: 'POST',
        headers: { authorization: 'Bearer synth-tok' },
      }),
      {
        env,
        run: async () => {
          throw Object.assign(new Error('upstream 503 synth-cen1'), { ingestRunId: 'run-err' });
        },
        alertFetch: async (url, init) => {
          sent.push({ url: String(url), body: JSON.parse(String(init?.body)) as IngestAlertPayload });
          return new Response(null, { status: 200 });
        },
      },
    );
    expect(res.status).toBe(500);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(env.INGEST_ALERT_WEBHOOK_URL);
    expect(sent[0]?.body).toMatchObject({ source: 'census-sahie', status: 'error', ingestRunId: 'run-err' });
    expect(sent[0]?.body.error).not.toContain('synth-cen1');
  });

  it('logs an error run when the fetch fails before load', async () => {
    const recorded: string[] = [];
    await expect(
      SahieHttp.run({
        year: '2099',
        env: { CENSUS_API_KEY: 'x' },
        httpFetch: async () => new Response('not-json', { status: 200 }),
        client: {} as SupabaseClient,
        load: async () => {
          throw new Error('load must not run');
        },
        recordFailure: async (_c, name) => {
          recorded.push(name);
          return 'run-err';
        },
      }),
    ).rejects.toMatchObject({ ingestRunId: 'run-err' });
    expect(recorded).toEqual(['census-sahie']);
  });
});

it('n8n alert workflow is inactive and opens an ingest-alert issue', () => {
  const text = readFileSync('n8n/ingest-failure-alert.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type)).toEqual(['n8n-nodes-base.webhook', 'n8n-nodes-base.github']);
  expect(text).toContain('"label": "ingest-alert"');
  expect(text).toContain('$json.body.ingestRunId');
  expect(text).not.toMatch(/gh[pousr]_|github_pat_/);
});

describe('IngestAlert GitHub fallback', () => {
  const p = IngestAlert.payload('synthetic-source', new Error('boom'), {}, 'run-synth-1');
  const env = { INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', INGEST_ALERT_GITHUB_TOKEN: 'synth-gh' };
  const recorder = (n8n: Response | Error, gh: Response = Response.json({ number: 7 }, { status: 201 })) => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const f = async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
      if (calls.length > 1) return gh;
      if (n8n instanceof Error) throw n8n;
      return n8n;
    };
    return { calls, f: f as typeof fetch };
  };

  it('opens a labeled issue when n8n returns a Cloudflare challenge', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { calls, f } = recorder(new Response(null, { status: 403, headers: { 'cf-mitigated': 'challenge' } }));
    expect(await IngestAlert.notify(p, env, f)).toBe(true);
    expect(calls[1]?.url).toBe('https://api.github.com/repos/aimogga/fas-caspilot-data/issues');
    expect(calls[1]?.body).toMatchObject({ title: 'Ingest failed: synthetic-source', labels: ['ingest-alert'] });
    expect(calls[1]?.body.body).toContain('run-synth-1');
    expect(calls[1]?.body.body).toContain('Error: boom');
    expect(info).toHaveBeenCalledWith('ingest-alert: opened issue #7 for run run-synth-1');
    info.mockRestore();
  });

  it('falls back to GitHub when the webhook request throws', async () => {
    const { calls, f } = recorder(new Error('network down'));
    expect(await IngestAlert.notify(p, env, f)).toBe(true);
    expect(calls[1]?.url).toContain('/issues');
  });

  it('treats a 2xx Cloudflare challenge as undelivered and falls back', async () => {
    const { calls, f } = recorder(new Response('<html>Just a moment...</html>', { status: 200, headers: { 'cf-mitigated': 'challenge' } }));
    expect(await IngestAlert.notify(p, env, f)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('returns false without an opened-issue log when GitHub rejects the issue', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, f } = recorder(new Response(null, { status: 502 }), Response.json({ message: 'Bad credentials' }, { status: 401 }));
    expect(await IngestAlert.notify(p, env, f)).toBe(false);
    expect(calls).toHaveLength(2);
    expect(info).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('ingest alert: GitHub issue fallback failed with HTTP 401');
    info.mockRestore();
    warn.mockRestore();
  });

  it('does not call GitHub when n8n succeeds', async () => {
    const { calls, f } = recorder(new Response(null, { status: 200 }));
    expect(await IngestAlert.notify(p, env, f)).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('skips without throwing when no token is set', async () => {
    const { calls, f } = recorder(new Response(null, { status: 502 }));
    expect(await IngestAlert.notify(p, { INGEST_ALERT_WEBHOOK_URL: env.INGEST_ALERT_WEBHOOK_URL }, f)).toBe(false);
    expect(calls).toHaveLength(1);
  });
});

describe('IngestAlert webhook secret header', () => {
  const SECRET = 'not-a-secret';
  const p: IngestAlertPayload = { source: 'saipe', status: 'error', error: 'boom', ingestRunId: 'run-1', at: '2026-01-01T00:00:00.000Z' };
  const capture = () => {
    const calls: RequestInit[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    return { calls, f };
  };

  it('sends X-FAS-Alert-Secret when INGEST_ALERT_SECRET is set', async () => {
    const { calls, f } = capture();
    const env = { INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', INGEST_ALERT_SECRET: SECRET };
    expect(await IngestAlert.notify(p, env, f)).toBe(true);
    const headers = new Headers(calls[0].headers);
    expect(headers.get('X-FAS-Alert-Secret')).toBe(SECRET);
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('omits the header gracefully when INGEST_ALERT_SECRET is unset', async () => {
    const { calls, f } = capture();
    expect(await IngestAlert.notify(p, { INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook' }, f)).toBe(true);
    expect(new Headers(calls[0].headers).has('X-FAS-Alert-Secret')).toBe(false);
  });

  it('n8n alert webhook requires header auth', () => {
    const wf = JSON.parse(readFileSync('n8n/ingest-failure-alert.json', 'utf8')) as { nodes: { type: string; parameters: Record<string, unknown> }[] };
    const hook = wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
    expect(hook?.parameters.authentication).toBe('headerAuth');
  });

  it('never leaks the secret into logs, GitHub fallback headers or the issue body', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('127.0.0.1')) return new Response('', { status: 403 });
      return new Response('{"number":1}', { status: 201 });
    }) as unknown as typeof fetch;
    const logs = [vi.spyOn(console, 'info').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {}), vi.spyOn(console, 'log').mockImplementation(() => {}), vi.spyOn(console, 'error').mockImplementation(() => {})];
    const env = { INGEST_ALERT_WEBHOOK_URL: 'http://127.0.0.1/hook', INGEST_ALERT_SECRET: SECRET, INGEST_ALERT_GITHUB_TOKEN: 'gh-test' };
    const leaky = IngestAlert.payload('saipe', new Error(`boom ${SECRET}`), env, 'run-1');
    expect(await IngestAlert.notify(leaky, env, f)).toBe(true);
    const gh = calls.find((c) => c.url.startsWith('https://api.github.com'));
    expect(gh).toBeDefined();
    const ghHeaders = new Headers(gh!.init.headers);
    expect(ghHeaders.has('X-FAS-Alert-Secret')).toBe(false);
    for (const [, v] of ghHeaders) expect(v).not.toContain(SECRET);
    expect(String(gh!.init.body)).not.toContain(SECRET);
    expect(await IngestAlert.notify(leaky, { INGEST_ALERT_WEBHOOK_URL: env.INGEST_ALERT_WEBHOOK_URL, INGEST_ALERT_SECRET: SECRET }, f)).toBe(false);
    for (const spy of logs) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
      spy.mockRestore();
    }
  });
});
