import { createServer } from 'node:http';
import { SahieHttp } from '../lib/ingest/sahie-http';

const env = process.env;
const db = SahieHttp.db(env);
const got: string[] = [];
const srv = createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => { got.push(b); res.end('ok'); });
});

async function counts() {
  const src = await db.from('source_registry').select('id').eq('name', 'census-sahie').single();
  const pi = await db.from('public_indicator').select('id', { count: 'exact', head: true }).eq('source_id', src.data?.id);
  return pi.count;
}

srv.listen(0, '127.0.0.1', async () => {
  const port = (srv.address() as { port: number }).port;
  const catcher = `http://127.0.0.1:${port}/catch`;
  const hook = env.INGEST_ALERT_WEBHOOK_URL || catcher;
  console.log('alert target:', env.INGEST_ALERT_WEBHOOK_URL ? 'n8n webhook' : 'temporary in-runner catcher');
  const failEnv = { ...env, INGEST_TOKEN: 'evidence-tok', INGEST_ALERT_WEBHOOK_URL: hook };
  const res = await SahieHttp.handle(
    new Request('http://x/api/ingest/sahie', { method: 'POST', headers: { authorization: 'Bearer evidence-tok' }, body: '{"year":"2024"}' }),
    { env: failEnv, httpFetch: async () => new Response('not-json') },
  );
  console.log('forced failure: route status', res.status);
  console.log('webhook received:', got.map((b) => b.replace(/"at":"[^"]+"/, '"at":"…"')));
  const errRun = await db.from('ingest_run').select('id,status,error,started_at').eq('status', 'error').order('started_at', { ascending: false }).limit(1);
  console.log('latest error ingest_run:', JSON.stringify(errRun.data));
  const before = await counts();
  const r1 = await SahieHttp.run({ year: '2024', env });
  const mid = await counts();
  const r2 = await SahieHttp.run({ year: '2024', env });
  const after = await counts();
  console.log('re-run 2024:', JSON.stringify({ before, run1: r1.rowsLoaded, mid, run2: r2.rowsLoaded, after }));
  const runs = await db.from('ingest_run').select('status,rows_loaded,checksum,started_at').in('id', [r1.ingestRunId, r2.ingestRunId]);
  console.log('re-run ingest_run rows:', JSON.stringify(runs.data));
  srv.close();
});
