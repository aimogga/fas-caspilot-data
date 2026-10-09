#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';

const raw = execSync('supabase status -o env', { encoding: 'utf8' });
const map = { API_URL: 'SUPABASE_URL', ANON_KEY: 'SUPABASE_ANON_KEY', SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY', DB_URL: 'SUPABASE_DB_URL' };
for (const line of raw.split('\n')) {
  const i = line.indexOf('=');
  if (i < 0) continue;
  const dest = map[line.slice(0, i)];
  if (!dest) continue;
  let v = line.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  process.env[dest] = v;
}
const missing = Object.values(map).filter((k) => !process.env[k]);
if (missing.length) { console.error(`test:db missing ${missing.join(', ')} from supabase status -o env`); process.exit(1); }
process.exit(spawnSync('pnpm', ['exec', 'vitest', 'run', '--config', 'vitest.db.config.mts', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env }).status ?? 1);
