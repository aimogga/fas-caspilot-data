const LOCAL = new Set(['127.0.0.1', 'localhost']);

export type LocalPg = { host: string; port: string; user: string; database: string; password: string };

export function assertLocalSupabase(api: string, db: string, env: Record<string, string | undefined> = process.env): LocalPg {
  for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE'] as const) {
    if (env[k]) throw new Error(`${k} must not be set`);
  }
  const apiUrl = new URL(api);
  const dbUrl = new URL(db);
  for (const [n, u] of [['SUPABASE_URL', apiUrl], ['SUPABASE_DB_URL', dbUrl]] as const) {
    const h = u.hostname.toLowerCase();
    if (!LOCAL.has(h)) throw new Error(`${n} host must be 127.0.0.1 or localhost (got ${h})`);
  }
  if (dbUrl.search || dbUrl.hash) throw new Error('SUPABASE_DB_URL must not have a query string or fragment');
  return {
    host: dbUrl.hostname.toLowerCase(),
    port: dbUrl.port || '5432',
    user: decodeURIComponent(dbUrl.username),
    database: decodeURIComponent(dbUrl.pathname.replace(/^\//, '')),
    password: decodeURIComponent(dbUrl.password),
  };
}
