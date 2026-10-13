import { SahieHttp } from '../lib/ingest/sahie-http';

async function main() {
  const env = { ...process.env, INGEST_TOKEN: 'evidence-tok' };
  const res = await SahieHttp.handle(
    new Request('http://x/api/ingest/sahie', { method: 'POST', headers: { authorization: 'Bearer evidence-tok' }, body: '{"year":"2024"}' }),
    { env, httpFetch: async () => new Response('not-json') },
  );
  console.log('forced failure: route status', res.status);
  const db = SahieHttp.db(env);
  const run = await db.from('ingest_run').select('id,status,error,started_at').eq('status', 'error').order('started_at', { ascending: false }).limit(1);
  console.log('latest error ingest_run:', JSON.stringify(run.data));
}
void main();
