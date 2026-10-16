import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertLocalSupabase } from '../../lib/db/local-pg';
import { importKnowledge, supabaseDb } from '../../scripts/knowledge-import.mjs';

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`Missing ${k}. Run pnpm test:db.`); return v; };
const API = env('SUPABASE_URL'), SVC = env('SUPABASE_SERVICE_ROLE_KEY');
assertLocalSupabase(API, env('SUPABASE_DB_URL'));
const ORG1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ORG2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', ADMIN = '11111111-1111-1111-1111-111111111111';
const svc = createClient(API, SVC, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = Date.now().toString(36); // keys are unique per run, so a re-run against the same local DB still passes
const row = (org: string, import_key: string | null) => ({ org_id: org, category: 'program', title: 'kn-import', body: 'Fictional program text.', status: 'draft', import_key });

describe('org_knowledge.import_key', () => {
  it('is unique per org, may repeat across orgs, and NULL never collides', async () => {
    expect((await svc.from('org_knowledge').insert(row(ORG1, `kn-dup-${RUN}`)).select('id')).error).toBeNull();
    expect((await svc.from('org_knowledge').insert(row(ORG1, `kn-dup-${RUN}`)).select('id')).error?.code).toBe('23505');
    expect((await svc.from('org_knowledge').insert(row(ORG2, `kn-dup-${RUN}`)).select('id')).error).toBeNull();
    expect((await svc.from('org_knowledge').insert([row(ORG1, null), row(ORG1, null)]).select('id')).error).toBeNull();
    expect((await svc.from('org_knowledge').insert(row(ORG1, ' ')).select('id')).error?.code).toBe('23514');
  });

  it('the command imports, versions changed text with the approver stamped, and skips unchanged rows', async () => {
    const doc = JSON.parse(readFileSync('tests/fixtures/knowledge/bluebird-import.json', 'utf8'));
    for (const e of doc.entries) e.key = `kn-db-${RUN}-${e.key}`;
    const db = supabaseDb(svc), opts = { org: ORG1, approver: 'admin@example.test' };
    expect(await importKnowledge(db, doc, opts)).toMatchObject({ ok: true, created: 3 });
    doc.entries[0].body += ' Edited.';
    expect(await importKnowledge(db, doc, opts)).toMatchObject({ created: 0, updated: 1, unchanged: 2 });
    const { data } = await svc.from('org_knowledge').select('id,version,approved_by,created_by').eq('org_id', ORG1).eq('import_key', `kn-db-${RUN}-mission`).single();
    expect(data).toMatchObject({ version: 2, approved_by: ADMIN, created_by: ADMIN });
    const versions = await svc.from('org_knowledge_version').select('version').eq('knowledge_id', data!.id).order('version');
    expect(versions.data).toEqual([{ version: 1 }, { version: 2 }]);
    await expect(importKnowledge(db, doc, { ...opts, approver: 'staff@example.test' })).rejects.toThrow('admin');
  });
});
