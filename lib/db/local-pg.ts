const LOCAL = new Set(['127.0.0.1', 'localhost']);
const IDENT = /^\w+$/;

export type LocalPg = { host: string; port: string; user: string; database: string; password: string };

export function assertLocalSupabase(api: string, db: string, env: Record<string, string | undefined> = process.env): LocalPg {
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE'] as const) if (env[k]) throw new Error(`${k} must not be set`);
  const a = new URL(api), d = new URL(db);
  for (const [n, u] of [['SUPABASE_URL', a], ['SUPABASE_DB_URL', d]] as const) {
    const h = u.hostname.toLowerCase();
    if (!LOCAL.has(h)) throw new Error(`${n} host must be 127.0.0.1 or localhost (got ${h})`);
  }
  if (d.search || d.hash) throw new Error('SUPABASE_DB_URL must not have a query string or fragment');
  const user = decodeURIComponent(d.username);
  const database = decodeURIComponent(d.pathname.replace(/^\//, ''));
  if (!IDENT.test(user) || !IDENT.test(database)) throw new Error('SUPABASE_DB_URL user and dbname must match /^\\w+$/');
  return { host: d.hostname.toLowerCase(), port: d.port || '5432', user, database, password: decodeURIComponent(d.password) };
}

export function localPgEnv(pg: LocalPg, env: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
  const out: Record<string, string | undefined> = { ...env, PGPASSWORD: pg.password };
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGOPTIONS'] as const) delete out[k];
  return out as unknown as NodeJS.ProcessEnv;
}
