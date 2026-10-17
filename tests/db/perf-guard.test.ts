import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { assertLocalSupabase, localPgEnv } from '../../lib/db/local-pg';

// F-602b: catalog guards for the two Supabase performance advisors, so a new migration can't bring them back.
const need = (name: string) => process.env[name] ?? (() => { throw new Error(`Missing ${name}. Run pnpm test:db`); })();
const pg = assertLocalSupabase(need('SUPABASE_URL'), need('SUPABASE_DB_URL'));
const sql = (q: string) => execFileSync('psql', ['-h', pg.host, '-p', pg.port, '-U', pg.user, '-d', pg.database, '-v', 'ON_ERROR_STOP=1', '-At', '-c', q], { encoding: 'utf8', env: localPgEnv(pg) }).trim();

describe('catalog: performance guards (F-602b)', () => {
  it('no public policy calls auth.uid(), auth.jwt() or auth.role() per row; each is wrapped as (select auth.<fn>()) (lint 0003)', () => {
    const rows = sql("select policyname || '|' || coalesce(qual, '') || ' ' || coalesce(with_check, '') from pg_policies where schemaname = 'public'").split('\n').filter(Boolean);
    const bare = rows.filter((r) => (r.match(/auth\.(uid|jwt|role)\(\)/g) ?? []).length > (r.match(/SELECT auth\.(uid|jwt|role)\(\)/g) ?? []).length);
    expect(bare.map((r) => r.split('|')[0])).toEqual([]);
  });

  it('every public foreign key has an index that starts with its columns (lint 0001)', () => {
    const uncovered = sql(`select c.conrelid::regclass || '.' || c.conname from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public' and not exists (select 1 from pg_index i where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey)`);
    expect(uncovered.split('\n').filter(Boolean)).toEqual([]);
  });
});
