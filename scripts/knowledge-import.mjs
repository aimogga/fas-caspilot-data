#!/usr/bin/env node
// F-508b2: load FAS org knowledge from a private JSON file kept outside the repo into org_knowledge (the repo is public).
// Usage: pnpm knowledge:import <file.json> --org <org id or name> --approver <admin email> [--dry-run] [--archive-missing] [--allow-host <host>]
// All-or-nothing: every entry passes the shape check and checkKnowledge before any write. Failures name the key and rule, never the text.
// Idempotent on import_key: unchanged entries are skipped, changed ones are updated (the trigger keeps the old text as a version). No deletes.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, checkKnowledge } from '../lib/knowledge/guard.ts';

export const FAS_DEV_HOST = 'zlizvzpatfyhdydfmxef.supabase.co';
const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]']);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'Usage: pnpm knowledge:import <file.json> --org <org id or name> --approver <admin email> [--dry-run] [--archive-missing] [--allow-host <host>]';
const FIELDS = ['category', 'title', 'body', 'source', 'as_of', 'status'];
const KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);

export function parseArgs(argv) {
  const out = { file: null, org: null, approver: null, dryRun: false, archiveMissing: false, allowHost: null };
  const value = (i) => { if (!argv[i] || argv[i].startsWith('--')) throw new Error(USAGE); return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--archive-missing') out.archiveMissing = true;
    else if (a === '--org') out.org = value(++i);
    else if (a === '--approver') out.approver = value(++i);
    else if (a === '--allow-host') out.allowHost = value(++i);
    else if (!a.startsWith('--') && !out.file) out.file = a;
    else throw new Error(`Unknown argument ${a}. ${USAGE}`);
  }
  if (!out.file || !out.org || !out.approver) throw new Error(USAGE);
  return out;
}

/** The file must live outside the working tree so FAS text can never be committed by accident. Returns its real path. */
export function assertOutsideRepo(file, repo = REPO) {
  const rel = relative(realpathSync(repo), realpathSync(file));
  if (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)) throw new Error('The import file must sit outside the repo working tree. Move it and run again.');
  return realpathSync(file);
}

/** fas-dev or local only, unless the operator names the exact host with --allow-host. */
export function assertHost(url, allowHost = null) {
  const host = new URL(url).hostname.toLowerCase();
  if (host === FAS_DEV_HOST || LOCAL.has(host) || (allowHost && host === allowHost.toLowerCase())) return host;
  throw new Error(`Refusing to import into ${host}: only fas-dev or local Supabase. Pass --allow-host ${host} if that is intended.`);
}

/** Pure. Every entry checked before anything is written; entry source/as_of fall back to the file's source_document/as_of. */
export function validate(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.entries)) return { failures: [{ key: '(file)', rules: ['bad_shape'] }], rows: [] };
  const failures = [], rows = [], seen = new Set();
  doc.entries.forEach((e, i) => {
    const ok = typeof e?.key === 'string' && KEY.test(e.key), key = ok ? e.key : `entry ${i + 1}`, rules = [];
    if (!ok) rules.push('bad_key');
    else if (seen.has(key)) rules.push('duplicate_key');
    seen.add(key);
    const str = (v) => (typeof v === 'string' ? v : '');
    const row = { category: e?.category, title: str(e?.title), body: str(e?.body), status: e?.status,
      source: e?.source ?? doc.source_document ?? null, as_of: e?.as_of ?? doc.as_of ?? null };
    if (!CATEGORIES.includes(row.category)) rules.push('bad_category');
    if (row.status !== 'approved' && row.status !== 'draft') rules.push('bad_status');
    if (row.source !== null && typeof row.source !== 'string') rules.push('bad_source');
    if (row.as_of !== null && !isDate(row.as_of)) rules.push('bad_as_of');
    if (row.title.trim().length > 200) rules.push('title_too_long');
    const guard = checkKnowledge({ ...row, as_of: isDate(row.as_of) ? row.as_of : null });
    if (!guard.ok) for (const r of guard.rules) if (!rules.includes(r)) rules.push(r);
    if (rules.length) failures.push({ key, rules });
    else rows.push({ import_key: key, ...row });
  });
  return { failures, rows };
}

/** Runs the import against a small db adapter (supabaseDb below, or a mock in tests). Throws on refusal; never logs entry text. */
export async function importKnowledge(db, doc, { org, approver, dryRun = false, archiveMissing = false }) {
  const { failures, rows } = validate(doc);
  if (failures.length) return { ok: false, failures };
  const orgs = await db.findOrg(org);
  if (orgs.length !== 1) throw new Error(orgs.length ? 'More than one org matches --org. Pass the org id.' : 'No org matches --org.');
  const orgId = orgs[0].id;
  const user = await db.findUser(approver);
  if (user?.app_metadata?.role !== 'admin' || user.app_metadata.org_id !== orgId) throw new Error('The approver must be an admin of that org. Nothing was written.');
  const existing = new Map((await db.listImported(orgId)).map((r) => [r.import_key, r]));
  const created = [], updated = [], unchanged = [];
  for (const r of rows) {
    const old = existing.get(r.import_key);
    if (!old) created.push(r);
    else if (FIELDS.every((f) => (old[f] ?? null) === (r[f] ?? null))) unchanged.push(r.import_key);
    else updated.push({ id: old.id, ...r });
  }
  const keys = new Set(rows.map((r) => r.import_key));
  const missing = [...existing.values()].filter((r) => !keys.has(r.import_key) && r.status !== 'archived');
  if (!dryRun) {
    const stamp = (r) => ({ ...r, approved_by: r.status === 'approved' ? user.id : null });
    const write = async (key, fn) => { try { await fn(); } catch (e) {
      throw new Error(`Write failed at entry ${key} (${e.code ?? 'error'}). Earlier entries were written; fix and re-run (unchanged entries are skipped).`);
    } };
    for (const r of created) await write(r.import_key, () => db.insert({ org_id: orgId, created_by: user.id, ...stamp(r) }));
    for (const { id, ...r } of updated) await write(r.import_key, () => db.update(id, stamp(r)));
    if (archiveMissing) for (const m of missing) await write(m.import_key, () => db.update(m.id, { status: 'archived' }));
  }
  return { ok: true, dryRun, created: created.length, updated: updated.length, unchanged: unchanged.length,
    missing: missing.map((m) => m.import_key), archived: archiveMissing && !dryRun ? missing.length : 0 };
}

/** The service-role adapter. Errors carry the Postgres code only, never the row. */
export function supabaseDb(client) {
  const must = ({ data, error }) => { if (error) throw Object.assign(new Error('database error'), { code: error.code }); return data; };
  return {
    findOrg: async (ref) => must(await client.from('org').select('id').eq(UUID.test(ref) ? 'id' : 'name', ref)) ?? [],
    async findUser(email) {
      for (let page = 1; ; page++) {
        const { users } = must(await client.auth.admin.listUsers({ page, perPage: 1000 }));
        const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (hit || users.length < 1000) return hit ?? null;
      }
    },
    listImported: async (orgId) => must(await client.from('org_knowledge').select(`id,import_key,${FIELDS.join(',')}`).eq('org_id', orgId).not('import_key', 'is', null)) ?? [],
    insert: async (row) => must(await client.from('org_knowledge').insert(row).select('id').single()),
    update: async (id, fields) => must(await client.from('org_knowledge').update(fields).eq('id', id).select('id').single()),
  };
}

export async function run(argv, env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const file = assertOutsideRepo(args.file);
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  assertHost(url, args.allowHost);
  let doc;
  try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('The import file is not valid JSON.'); }
  const db = supabaseDb(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  const res = await importKnowledge(db, doc, args);
  if (!res.ok) {
    for (const f of res.failures) log(`refused ${f.key}: ${f.rules.join(', ')}`);
    throw new Error(`${res.failures.length} entr${res.failures.length === 1 ? 'y' : 'ies'} failed the checks. Nothing was written.`);
  }
  log(`${res.dryRun ? 'dry run (nothing written): ' : ''}created ${res.created}, updated ${res.updated}, unchanged ${res.unchanged}, missing ${res.missing.length}`
    + (res.archived ? `, archived ${res.archived}` : ''));
  if (res.missing.length) log(`missing from file${args.archiveMissing ? '' : ' (kept; pass --archive-missing to archive)'}: ${res.missing.join(', ')}`);
  return res;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
