import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
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

it('n8n alert workflow is inactive and reads recipients from env', () => {
  const text = readFileSync('n8n/ingest-failure-alert.json', 'utf8');
  const wf = JSON.parse(text) as { active: boolean; nodes: { type: string }[] };
  expect(wf.active).toBe(false);
  expect(wf.nodes.map((n) => n.type)).toEqual(['n8n-nodes-base.webhook', 'n8n-nodes-base.emailSend']);
  expect(text).toContain('$env.FAS_ALERT_TO');
  expect(text).not.toMatch(/@/);
});
