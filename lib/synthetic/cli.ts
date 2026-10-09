import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { assertLocalSupabase, localPgEnv } from '../db/local-pg.ts';
import { DEFAULT_CASES, DEFAULT_SEED, generate, toSql } from './generate.ts';

function statusEnv(): Record<string, string | undefined> {
  const raw = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
  const map: Record<string, string> = { API_URL: 'SUPABASE_URL', DB_URL: 'SUPABASE_DB_URL' };
  const env = { ...process.env };
  for (const line of raw.split('\n')) {
    const i = line.indexOf('=');
    if (i < 0) continue;
    const dest = map[line.slice(0, i)];
    if (!dest) continue;
    let v = line.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[dest] = v;
  }
  return env;
}

export function run(argv: string[]): void {
  const i = argv.indexOf('--sql');
  const sql = toSql(generate(DEFAULT_SEED, DEFAULT_CASES));
  if (i >= 0) {
    const path = argv[i + 1];
    if (!path) throw new Error('pnpm seed:synthetic --sql <file>');
    writeFileSync(path, sql);
    return;
  }
  const env = statusEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_DB_URL) throw new Error('supabase status missing API_URL/DB_URL');
  const pg = assertLocalSupabase(env.SUPABASE_URL, env.SUPABASE_DB_URL, env);
  execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql, encoding: 'utf8', env: localPgEnv(pg, env),
  });
}

run(process.argv.slice(2));
