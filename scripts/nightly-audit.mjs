#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { register } from 'node:module';
import { execSync } from 'child_process';
const DATE = new Date().toISOString().split('T')[0];
export function parseAgentsCommands(md) {
  const m = md.match(/## Commands\n([\s\S]*?)(```\n([\s\S]*?)\n```|\n## )/);
  return m && m[3] ? [...new Set(m[3].split('\n').filter(l => l.trim().startsWith('pnpm ')).map(l => l.split('#')[0].trim().replace(/^pnpm /, '').split(/\s+/)[0]).filter(c => c !== 'install'))] : [];
}
const SEV = ['critical', 'high', 'moderate', 'low', 'info'];
const AUDIT_TIMEOUT_MS = 90000;
const IGNORE_FILE = 'harness/audit-ignores.json';
const IGNORE_KEYS = ['id', 'package', 'reason', 'reviewer', 'expires', 'severity'];

function failRun(finding) {
  return {status: 'RED', finding, ignored: [], stale: []};
}

export function loadIgnores(readFile = readFileSync, path = IGNORE_FILE) {
  const raw = JSON.parse(readFile(path, 'utf-8'));
  return Array.isArray(raw) ? raw : raw.ignores || [];
}

function parseIsoDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

function validateIgnore(ig, today) {
  for (const k of IGNORE_KEYS) {
    if (typeof ig?.[k] !== 'string' || !ig[k].trim()) return `invalid ignore: ${k}`;
  }
  if (!/^GHSA(-[a-z0-9]{4}){3}$/.test(ig.id)) return 'invalid ignore: id';
  const exp = parseIsoDate(ig.expires), t = parseIsoDate(today);
  if (!exp) return 'invalid ignore: expires';
  if (t && (exp - t) / 86400000 > 90) return 'invalid ignore: expires';
  if (!SEV.includes(ig.severity.toLowerCase())) return 'invalid ignore: severity';
}

export function formatIgnored(i) {
  return `${i.id} (${i.package}, ${i.severity}): ${i.reason}, reviewer ${i.reviewer}, re-review by ${i.expires}`;
}

export function parseAudit(out, opts = {}) {
  if (!out || !String(out).trim()) return failRun('audit could not run');
  let parsed;
  try { parsed = JSON.parse(out); }
  catch { return failRun('audit could not run'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failRun('audit could not run');
  const meta = parsed.metadata?.vulnerabilities;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return failRun('audit could not run');
  const hasAdv = Object.prototype.hasOwnProperty.call(parsed, 'advisories');
  const adv = parsed.advisories;
  if (hasAdv && (!adv || typeof adv !== 'object' || Array.isArray(adv))) return failRun('audit could not run');
  const today = opts.today || DATE;
  const ignores = opts.ignores || [];
  const seen = new Set();
  for (const ig of ignores) {
    const err = validateIgnore(ig, today);
    if (err) return failRun(err);
    if (seen.has(ig.id)) return failRun('duplicate ignore');
    seen.add(ig.id);
  }
  const counted = {critical: 0, high: 0, moderate: 0, low: 0, info: 0};
  const ignCounts = {critical: 0, high: 0, moderate: 0, low: 0, info: 0};
  const ignored = [];
  const touched = new Set();
  if (hasAdv) {
    for (const a of Object.values(adv)) {
      const s = a?.severity == null || a.severity === '' ? '' : String(a.severity).toLowerCase();
      if (!SEV.includes(s)) return failRun('unknown severity');
      const ig = ignores.find(x => x.id === a.github_advisory_id && x.package === a.module_name);
      if (ig) touched.add(ig.id);
      if (ig && !(parseIsoDate(today) > parseIsoDate(ig.expires)) && s === ig.severity.toLowerCase()) {
        ignored.push({id: ig.id, package: ig.package, severity: ig.severity, reason: ig.reason, reviewer: ig.reviewer, expires: ig.expires});
        ignCounts[s]++;
        continue;
      }
      counted[s]++;
    }
    for (const k of ['critical', 'high', 'moderate']) {
      if ((counted[k] || 0) + (ignCounts[k] || 0) !== (meta[k] || 0)) return failRun('advisories/metadata mismatch');
    }
  } else {
    Object.assign(counted, {critical: meta.critical || 0, high: meta.high || 0, moderate: meta.moderate || 0, low: meta.low || 0});
  }
  const stale = ignores.filter(ig => !touched.has(ig.id));
  const [c, h, m, l] = [counted.critical, counted.high, counted.moderate, counted.low];
  if (c || h) return {status: 'RED', finding: `${c} critical, ${h} high`, ignored, stale};
  const bits = [...(m ? [`${m} moderate`] : []), ...(stale.length ? [`${stale.length} stale ignore(s)`] : [])];
  if (bits.length) return {status: 'YELLOW', finding: bits.join('; '), ignored, stale};
  return {status: 'GREEN', finding: `No high/critical (${l} low)`, ignored, stale};
}
export function checkDocRefs(listDocs, readFile, fileExists) {
  try {
    const docs = listDocs();
    let broken = [], refCount = 0;
    for (const doc of docs) {
      const txt = readFile(doc);
      const refs = txt.match(/\[.*?\]\(([^)]+)\)/g) || [];
      for (const ref of refs) {
        const p = ref.match(/\[.*?\]\(([^)]+)\)/)?.[1];
        if (p && !p.startsWith('#') && !p.startsWith('http')) {
          refCount++;
          const dir = doc.substring(0, doc.lastIndexOf('/'));
          if (!fileExists(join(dir, p))) broken.push(`${doc}: ${p}`);
        }
      }
    }
    if (broken.length) return {status: 'YELLOW', finding: `${broken.length} broken doc ref(s)`};
    if (refCount === 0) return {status: null, detail: `Doc refs: nothing to check (0 refs in ${docs.length} doc(s))`};
    return {status: null, detail: `Checked ${refCount} ref(s) in ${docs.length} doc(s), none broken`};
  } catch (e) {
    return {status: 'YELLOW', finding: `Doc refs: could not run (${e.message})`};
  }
}

function checkHarnessIntegrity() {
  const r = {status: 'GREEN', findings: [], details: []};
  const addYellow = (f) => { r.status = 'YELLOW'; r.findings.push(f); };
  try {
    const fl = JSON.parse(readFileSync('harness/feature_list.json', 'utf-8'));
    const passing = fl.features.filter(f => f.status === 'passing');
    const noEv = passing.filter(f => !f.evidence?.length);
    if (noEv.length) addYellow(`${noEv.length} passing feature(s) lack evidence`);
    else r.details.push(passing.length ? `All ${passing.length} passing feature(s) have evidence` : 'No passing features yet');
    const cmds = parseAgentsCommands(readFileSync('AGENTS.md', 'utf-8'));
    if (!cmds.length) {
      addYellow('AGENTS.md: parsed 0 commands from ## Commands');
    } else {
      const missing = cmds.filter(c => !JSON.parse(readFileSync('package.json', 'utf-8')).scripts?.[c]);
      if (missing.length) addYellow(`Missing commands: ${missing.join(', ')}`);
      else r.details.push('All AGENTS.md commands exist');
    }
    const listDocs = () => readdirSync('docs', {recursive: true, encoding: 'utf-8'}).filter(f => f.endsWith('.md')).map(f => join('docs', f));
    const docCheck = checkDocRefs(listDocs, (p) => readFileSync(p, 'utf-8'), existsSync);
    if (docCheck.status) { r.status = worst(r.status, docCheck.status); r.findings.push(docCheck.finding); }
    else r.details.push(docCheck.detail);
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const commits = execSync(`git log --since="${yesterday}" --format="%H%x09%s"`, {encoding: 'utf-8'}).trim().split('\n').filter(c => c)
        .map(line => { const [sha, ...subject] = line.split('\t'); return {subject: subject.join('\t'), changed: changedFiles(sha)}; });
      const progLog = checkProgressLog(commits, readProgressLog());
      if (progLog.missing.length) {
        r.status = worst(r.status, 'YELLOW');
        r.findings.push(`Missing progress entries: PR ${progLog.missing.join(', ')}`);
      } else if (commits.length) {
        r.details.push(`All ${progLog.found.length} merged PR(s) documented`);
      }
    } catch {
      r.status = worst(r.status, 'YELLOW');
      r.findings.push('could not read git history');
    }
  } catch (e) {
    r.status = 'RED';
    r.findings.push(`Error: ${e.message}`);
  }
  return r;
}

/** D-041: frozen `harness/progress.md` plus one file per entry under `harness/progress/`. */
export function readProgressLog(dir = 'harness/progress', exists = existsSync, read = (p) => readFileSync(p, 'utf-8'), list = readdirSync) {
  const legacy = exists('harness/progress.md') ? read('harness/progress.md') : '';
  const entries = exists(dir) ? list(dir).filter((f) => f.endsWith('.md')).sort().map((f) => read(join(dir, f))) : [];
  return [legacy, ...entries].join('\n');
}

/** Files a commit adds or modifies against its first parent (a merge or squash commit's whole PR). Empty when git cannot say. */
export function changedFiles(sha, run = (cmd) => execSync(cmd, {encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore']})) {
  try { return run(`git diff --name-only --diff-filter=AM ${sha}^1 ${sha}`).trim().split('\n').filter(f => f); } catch { return []; }
}
const PROGRESS_ENTRY = /^harness\/(progress\.md|progress\/[^/]+\.md)$/;

/** A merged PR is documented when its merge commit adds a `harness/progress/*.md` entry (D-041: entries are written before the PR number exists) or
 * updates `harness/progress.md` (before D-041), or when the log text names it (`PR #n`, `/pull/n`). `commits` are subjects, or `{subject, changed}`. */
export function checkProgressLog(commits, progressText) {
  const prs = new Map();
  commits.forEach(c => {
    const subject = typeof c === 'string' ? c : c.subject, changed = typeof c === 'string' ? [] : c.changed ?? [];
    const m = subject.match(/\(#(\d+)\)$/) || (subject.startsWith('Merge pull request #') && subject.match(/Merge pull request #(\d+)/));
    if (m) prs.set(m[1], (prs.get(m[1]) ?? false) || changed.some(f => PROGRESS_ENTRY.test(f)));
  });
  const found = [], missing = [];
  prs.forEach((hasEntry, n) => (hasEntry || progressText.includes(`PR #${n}`) || progressText.includes(`/pull/${n}`) ? found : missing).push(n));
  return {found, missing};
}

const PLACEHOLDERS = new Set([
  'changeme', 'placeholder', 'redacted', 'dummy', 'xxx', 'not-a-secret',
  'your_api_key_here', 'your-api-key-here', 'your-token-here', 'insert_token_here',
  'dummy_secret_here',
]);
const LOCAL_PG = new Set([
  'postgresql://postgres:postgres@127.0.0.1:54322',
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  'postgresql://postgres:postgres@localhost:54322',
  'postgresql://postgres:postgres@localhost:54322/postgres',
  'postgres://postgres:postgres@127.0.0.1:54322',
  'postgres://postgres:postgres@127.0.0.1:54322/postgres',
  'postgres://postgres:postgres@localhost:54322',
  'postgres://postgres:postgres@localhost:54322/postgres',
]);
function localServiceRoleJwts() {
  return [
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0', 'EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'],
    ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'eyAgCiAgICAicm9sZSI6ICJzZXJ2aWNlX3JvbGUiLAogICAgImlzcyI6ICJzdXBhYmFzZS1kZW1vIiwKICAgICJpYXQiOiAxNjQxNzY5MjAwLAogICAgImV4cCI6IDE3OTk1MzU2MDAKfQ', 'DaYlNEoUrrEn2Ig7tqibS-PHK5vgusbcbo7X36XVt4Q'],
  ].map(p => p.join('.'));
}
const LOCAL_JWT = new Set(localServiceRoleJwts());
export { localServiceRoleJwts, LOCAL_PG, PLACEHOLDERS };

function jwtRole(tok) {
  try {
    return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).role;
  } catch { return null; }
}
function hasServiceRoleJwt(line) {
  for (const tok of line.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    if (!LOCAL_JWT.has(tok) && jwtRole(tok) === 'service_role') return true;
  }
  return false;
}
function hasRemotePgUrl(line) {
  for (const raw of line.match(/postgres(?:ql)?:\/\/[^\s'"`]+/gi) || []) {
    const url = raw.replace(/[.,;)]+$/, '');
    if (LOCAL_PG.has(url)) continue;
    try { if (new URL(url).password) return true; }
    catch { if (/:\/\/[^/@]+:[^/@]+@/.test(url)) return true; }
  }
  return false;
}
function assignedSecrets(line) {
  const quoted = /(password|secret|token|api[_-]?key)\s*[:=]\s*['"]([^'"]{12,})['"]/gi;
  let m;
  while ((m = quoted.exec(line))) {
    const val = m[2];
    if (/^env\([^)]+\)$/i.test(val) || PLACEHOLDERS.has(val.toLowerCase())) continue;
    return true;
  }
  const aws = line.match(/AWS_SECRET_ACCESS_KEY\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i);
  if (aws && !PLACEHOLDERS.has(aws[1].toLowerCase()) && !/^env\(/i.test(aws[1])) return true;
  const sr = line.match(/SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*['"]?([A-Za-z0-9._-]+)['"]?/);
  return Boolean(sr && !LOCAL_JWT.has(sr[1]) && !PLACEHOLDERS.has(sr[1].toLowerCase()));
}

export function matchSecretLine(line) {
  return /AKIA[0-9A-Z]{16}/.test(line)
    || new RegExp('-----BEGIN (?:[A-Z0-9]+ )?(?:ENCRYPTED )?PRIVATE KEY-----').test(line)
    || /\b(gh[pousr])_[A-Za-z0-9]{36}\b/.test(line)
    || /\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\b/.test(line)
    || /\bsb_secret_[A-Za-z0-9_]{16,}\b/.test(line)
    || hasServiceRoleJwt(line)
    || hasRemotePgUrl(line)
    || assignedSecrets(line);
}

export function scanFileContents(files) {
  const r = {status: 'GREEN', findings: [], details: []};
  let found = 0, scanned = 0;
  for (const text of Object.values(files)) {
    scanned++;
    for (const line of String(text).split('\n')) {
      if (matchSecretLine(line)) found++;
    }
  }
  r.details.push(`Scanned ${scanned} file(s)`);
  if (found) {
    r.status = 'RED';
    r.findings.push(`${found} potential secret(s)`);
  } else r.details.push('No obvious secrets');
  return r;
}

export function checkSecretScanTree({listFiles, readFile} = {}) {
  try {
    const names = (listFiles ?? (() => execSync('git ls-files', {encoding: 'utf-8'}).trim().split('\n').filter(Boolean)))();
    const read = readFile ?? readFileSync;
    const files = {};
    for (const p of names) files[p] = read(p, 'utf-8');
    return scanFileContents(files);
  } catch {
    return {status: 'RED', findings: ['secret scan could not run'], details: []};
  }
}

export function secretsOnlyExit(result) {
  return result.status === 'GREEN' ? 0 : 1;
}

export function checkSecretScan(gitRunner = execSync) {
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const commits = gitRunner(`git log --since="${yesterday}" --format="%H"`, {encoding: 'utf-8'}).trim().split('\n').filter(c => c);
    if (!commits.length) {
      r.details.push('No commits in last 24h');
      return r;
    }
    let found = 0;
    for (const c of commits) {
      const diff = gitRunner(`git show ${c} --format="" --no-color`, {encoding: 'utf-8', maxBuffer: 10*1024*1024});
      const lines = diff.split('\n');
      for (const line of lines) {
        if (!line.startsWith('+') || line.startsWith('+++')) continue;
        if (matchSecretLine(line)) found++;
      }
    }
    r.details.push(`Scanned ${commits.length} commit(s)`);
    if (found) {
      r.status = 'RED';
      r.findings.push(`${found} potential secret(s)`);
    } else r.details.push('No obvious secrets');
  } catch {
    r.status = 'RED';
    r.findings = ['secret scan could not run'];
    r.details = [];
  }
  return r;
}

export function runPnpmAudit(run = execSync) {
  try {
    return run('pnpm audit --json', {encoding: 'utf-8', stdio: 'pipe', timeout: AUDIT_TIMEOUT_MS});
  } catch (e) {
    if (e.stdout && String(e.stdout).trim()) return e.stdout;
    throw e;
  }
}

export function checkDeps({run = runPnpmAudit, parse = parseAudit, ignores, today} = {}) {
  const r = {status: 'GREEN', findings: [], details: [], ignored: [], stale: []};
  try {
    const parsed = parse(run(), {ignores: ignores ?? loadIgnores(), today});
    r.status = parsed.status;
    r.ignored = parsed.ignored || [];
    r.stale = parsed.stale || [];
    if (parsed.status === 'GREEN') r.details.push(parsed.finding);
    else r.findings.push(parsed.finding);
  } catch {
    r.status = 'RED';
    r.findings.push('audit could not run');
  }
  return r;
}

export function checkBuild(run = execSync) {
  const r = {status: 'GREEN', findings: [], details: []};
  [['lint', 'pnpm lint'], ['typecheck', 'pnpm typecheck'], ['test', 'pnpm test']].forEach(([n, cmd]) => {
    try {
      run(cmd, {stdio: 'pipe', timeout: 120000});
      r.details.push(`${n} passed`);
    } catch (e) {
      r.status = 'RED';
      r.findings.push(`${n} failed`);
      // Name what failed: the failing test files and assertion lines, short, never the whole log.
      const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`.split('\n').filter((l) => /FAIL|×|Error|ETIMEDOUT|ENOBUFS|Timed out/.test(l));
      for (const l of [...new Set(out)].slice(0, 12)) r.details.push(`${n}: ${l.trim().slice(0, 200)}`);
      if (e.code || e.signal) r.details.push(`${n}: exit ${e.status ?? '?'} ${e.code ?? ''} ${e.signal ?? ''}`.trim());
    }
  });
  return r;
}

const CADENCE_DAYS = {daily: 2, weekly: 8, monthly: 32, quarterly: 95, annual: 370};
const UTAH_COUNTIES = 29;
const DAY_MS = 86400000;

export function supabaseRest(env = process.env, httpFetch = fetch) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return async (path) => {
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const res = await httpFetch(`${url}/rest/v1/${path}`, {
        headers: {apikey: key, authorization: `Bearer ${key}`, range: `${from}-${from + 999}`, 'content-type': 'application/json'},
        ...(path.startsWith('rpc/') ? {method: 'POST', body: '{}'} : {}),
      });
      if (!res.ok) throw new Error(`${path.split('?')[0]}: HTTP ${res.status}`);
      if (path.startsWith('rpc/')) return res.json();
      const page = await res.json();
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  };
}

export function evalFreshness(sources, runs, now = new Date()) {
  const r = {status: 'GREEN', findings: [], details: []};
  for (const s of sources.filter(x => x.status === 'active')) {
    const days = CADENCE_DAYS[s.cadence] ?? CADENCE_DAYS.annual;
    const last = s.last_success_at ? new Date(s.last_success_at) : null;
    const fails = runs.filter(x => x.source_id === s.id && x.status === 'error');
    const ago = (h) => fails.some(x => now - new Date(x.started_at) <= h * 3600000 && now - new Date(x.started_at) > (h - 24) * 3600000);
    const stale = !last || now - last > days * DAY_MS;
    if (ago(24) && ago(48)) {
      r.status = 'RED';
      r.findings.push(`${s.name}: failed 2 nights in a row`);
    } else if (ago(24) || stale) {
      r.status = worst(r.status, 'YELLOW');
      r.findings.push(`${s.name}: ${ago(24) ? 'failed in the last 24h' : `no success within ${s.cadence ?? 'annual'} cadence`}`);
    }
    r.details.push(`${s.name}: last success ${last ? last.toISOString() : 'never'}`);
  }
  if (!r.details.length) r.details.push('No active sources');
  return r;
}

export function evalSanity(rows, names = {}) {
  const r = {status: 'GREEN', findings: [], details: []};
  const groups = new Map();
  for (const row of rows) {
    const k = `${names[row.source_id] ?? row.source_id}/${row.indicator_code}`;
    const byVintage = groups.get(k) ?? new Map();
    const v = byVintage.get(row.vintage) ?? {fips: new Set(), n: 0, nulls: 0};
    v.fips.add(row.geo_fips);
    v.n++;
    if (row.value == null) v.nulls++;
    byVintage.set(row.vintage, v);
    groups.set(k, byVintage);
  }
  const flag = (f) => { r.status = 'YELLOW'; r.findings.push(f); };
  for (const [k, byVintage] of groups) {
    const [latest, prev] = [...byVintage.keys()].sort().reverse();
    const cur = byVintage.get(latest);
    if (cur.fips.size < UTAH_COUNTIES) flag(`${k} ${latest}: ${cur.fips.size}/${UTAH_COUNTIES} counties`);
    if (prev) {
      const old = byVintage.get(prev);
      if (Math.abs(cur.n - old.n) > old.n * 0.2) flag(`${k} ${latest}: ${cur.n} rows vs ${old.n} in ${prev}`);
      if (cur.nulls / cur.n - old.nulls / old.n > 0.1) flag(`${k} ${latest}: null spike`);
    }
    r.details.push(`${k}: latest vintage ${latest}, ${cur.n} rows`);
  }
  if (!groups.size) r.details.push('No public_indicator rows');
  return r;
}

export async function checkData(rest = supabaseRest(), now = new Date()) {
  if (!rest) {
    const skip = {status: 'SKIPPED', reason: 'needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', findings: [], details: []};
    return {freshness: skip, sanity: skip};
  }
  try {
    const since = new Date(now - 2 * DAY_MS).toISOString();
    const [sources, runs, rows] = await Promise.all([
      rest('source_registry?select=id,name,cadence,status,last_success_at'),
      rest(`ingest_run?select=source_id,status,started_at&started_at=gte.${since}`),
      rest('public_indicator?select=source_id,indicator_code,vintage,geo_fips,value'),
    ]);
    const names = Object.fromEntries(sources.map(s => [s.id, s.name]));
    return {freshness: evalFreshness(sources, runs, now), sanity: evalSanity(rows, names)};
  } catch (e) {
    const fail = {status: 'YELLOW', findings: [`could not query database (${e.message})`], details: []};
    return {freshness: fail, sanity: fail};
  }
}

const GRANTS_KEY_DAYS = 25;

export function evalGrants(sources, runs, pipeline, now = new Date()) {
  const r = {status: 'GREEN', findings: [], details: []};
  const src = sources.find(s => /grants/i.test(s.name));
  if (!src) {
    r.status = 'SKIPPED';
    r.reason = 'no grants source in source_registry yet (F-3xx); key-usage and refresh not checkable';
  } else {
    const ok = runs.filter(x => x.source_id === src.id && x.status === 'success').map(x => new Date(x.started_at)).sort((a, b) => b - a)[0];
    const last = ok ?? (src.last_success_at ? new Date(src.last_success_at) : null);
    if (!last || now - last > GRANTS_KEY_DAYS * DAY_MS) {
      r.status = 'RED';
      r.findings.push(`Grants.gov key not used in ${GRANTS_KEY_DAYS} days (last ${last ? last.toISOString() : 'never'})`);
    } else r.details.push(`Grants.gov last refresh ${last.toISOString()}`);
  }
  const soon = pipeline.filter(p => p.status === 'pursuing' && p.opportunity?.close_date)
    .filter(p => { const d = new Date(p.opportunity.close_date) - now; return d >= 0 && d <= 14 * DAY_MS; });
  r.details.push(soon.length ? `Pursuing deadlines (14d): ${soon.map(p => `${p.opportunity.title} ${p.opportunity.close_date}`).join('; ')}` : 'No pursuing deadlines in 14d');
  return r;
}

export function evalRls(violations) {
  return violations.length
    ? {status: 'RED', findings: violations.map(v => `RLS/view guard: ${v.relname}`), details: []}
    : {status: 'GREEN', findings: [], details: ['rls_guard_violations(): none']};
}

export async function checkGrantsAndRls(rest = supabaseRest(), now = new Date()) {
  const skip = {status: 'SKIPPED', reason: 'needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', findings: [], details: []};
  if (!rest) return {grants: skip, rls: skip};
  const since = new Date(now - 30 * DAY_MS).toISOString();
  const safe = (f) => f().catch(e => ({status: 'YELLOW', findings: [`could not query database (${e.message})`], details: []}));
  const grants = await safe(async () => evalGrants(
    await rest('source_registry?select=id,name,last_success_at'),
    await rest(`ingest_run?select=source_id,status,started_at&started_at=gte.${since}`),
    await rest('pipeline_status?select=status,opportunity(title,close_date)&status=eq.pursuing'), now));
  const rls = await safe(async () => evalRls(await rest('rpc/rls_guard_violations')));
  return {grants, rls};
}

// F-601 check 4: the suppression suite. Builds every evidence packet per org with the app's own builders (lib/packets/audit.ts) and runs the export
// assertions on it. Findings name the packet, rule and place only, never the value, so the report itself cannot carry a small count.
const PRIVACY_RULES = ['small-cell', 'exact-date', 'case-field'];
export function evalSuppression({checked, findings}) {
  if (!checked.length) return {status: 'YELLOW', findings: ['suppression suite: no org to check'], details: []};
  const lines = findings.map(f => `Packet ${f.packet}: ${f.rule} at ${f.where}`);
  const status = findings.some(f => PRIVACY_RULES.includes(f.rule)) ? 'RED' : findings.length ? 'YELLOW' : 'GREEN';
  return {status, findings: lines, details: status === 'GREEN' ? [`Suppression suite: ${checked.length} packets, no cell under 11, no exact date, no case field`] : []};
}
async function loadPacketAudit(url, key, now) {
  const root = pathToFileURL(join(import.meta.dirname, '..') + '/').href;
  const hook = `export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) spec = ${JSON.stringify(root)} + spec.slice(2);
  if (!/^(\\.\\.?\\/|file:)/.test(spec) || /\\.[cm]?[jt]s$/.test(spec)) return next(spec, ctx);
  try { return await next(spec, ctx); } catch (e) {
    if (e?.code === 'ERR_UNSUPPORTED_DIR_IMPORT') return next(spec + '/index.ts', ctx);
    if (e?.code !== 'ERR_MODULE_NOT_FOUND') throw e;
    return next(spec + '.ts', ctx);
  }
}`; // as in llm-bakeoff.mjs: extensionless and '@/' imports in lib/ resolve to their .ts files
  register(`data:text/javascript,${encodeURIComponent(hook)}`, pathToFileURL(import.meta.filename));
  const {createClient} = await import('@supabase/supabase-js');
  const {auditPackets} = await import('../lib/packets/audit.ts');
  const client = createClient(url, key, {auth: {persistSession: false}});
  const orgs = await client.from('org').select('id');
  if (orgs.error) throw new Error(`org: ${orgs.error.message}`);
  return auditPackets(client, orgs.data.map(o => o.id), now);
}
export async function checkSuppression(env = process.env, load = loadPacketAudit, now = new Date()) {
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {status: 'SKIPPED', reason: 'needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', findings: [], details: []};
  try { return evalSuppression(await load(url, key, now)); }
  catch (e) { return {status: 'YELLOW', findings: [`suppression suite: could not build packets (${e.message})`], details: []}; }
}

export async function checkMainCi(env = process.env, httpFetch = fetch) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) return {status: 'SKIPPED', findings: [], details: ['main CI: needs GITHUB_TOKEN']};
  try {
    const res = await httpFetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?branch=main&status=completed&per_page=1`,
      {headers: {authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json'}});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const run = (await res.json()).workflow_runs?.[0];
    if (!run) return {status: 'YELLOW', findings: ['main CI: no completed run'], details: []};
    return run.conclusion === 'success'
      ? {status: 'GREEN', findings: [], details: [`main CI green @ ${run.head_sha.slice(0, 7)}`]}
      : {status: 'RED', findings: [`main CI ${run.conclusion} @ ${run.head_sha.slice(0, 7)}`], details: []};
  } catch (e) {
    return {status: 'YELLOW', findings: [`main CI: could not query (${e.message})`], details: []};
  }
}

export async function checkDeploys(env = process.env, httpFetch = fetch) {
  if (!env.VERCEL_TOKEN || !env.VERCEL_PROJECT_ID) return {status: 'SKIPPED', findings: [], details: ['deploy health: needs VERCEL_TOKEN']};
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    for (const target of ['production', 'preview']) {
      const q = new URLSearchParams({projectId: env.VERCEL_PROJECT_ID, target, state: 'READY,ERROR', limit: '1', ...(env.VERCEL_TEAM_ID ? {teamId: env.VERCEL_TEAM_ID} : {})});
      const res = await httpFetch(`https://api.vercel.com/v6/deployments?${q}`, {headers: {authorization: `Bearer ${env.VERCEL_TOKEN}`}});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()).deployments?.[0];
      const state = d?.readyState ?? d?.state;
      if (!d) { r.status = worst(r.status, 'YELLOW'); r.findings.push(`${target} deploy: none found`); }
      else if (state === 'READY') r.details.push(`${target} deploy READY (${d.uid})`);
      else if (state === 'ERROR') { r.status = 'RED'; r.findings.push(`${target} deploy ERROR (${d.uid})`); }
      else { r.status = worst(r.status, 'YELLOW'); r.findings.push(`${target} deploy ${state} (${d.uid})`); }
    }
    return r;
  } catch (e) {
    return {status: 'YELLOW', findings: [`deploy health: could not query (${e.message})`], details: []};
  }
}

// F-201: n8n ingest-failure-alert health. Issue bodies from both paths share the same lines, and both
// authenticate as the same GitHub user, so the only reliable discriminator is an explicit body line:
// n8n workflow writes `Delivered-by: n8n`, the app fallback writes `Delivered-by: app-fallback`.
export const N8N_MARKER = 'Delivered-by: n8n';

export function classifyProbe(status, headers = {}, body = '') {
  const h = (k) => (typeof headers.get === 'function' ? headers.get(k) : headers[k]) ?? '';
  if (h('cf-mitigated') === 'challenge') return {ok: false, why: 'Cloudflare challenge (cf-mitigated)'};
  if (status === 403 && /cf-chl|challenge-platform|Just a moment|Attention Required/i.test(body)) return {ok: false, why: 'Cloudflare challenge page'};
  if (status === 401 || status === 403) return {ok: true};
  return {ok: false, why: `unauthenticated probe got HTTP ${status}`};
}

export function unmatchedAlertIssues(issues, now = new Date()) {
  return issues.filter(i => !i.pull_request && (i.state === 'open' || now - new Date(i.created_at) <= DAY_MS))
    .filter(i => !String(i.body ?? '').includes(N8N_MARKER));
}

export async function checkIngestAlerts(env = process.env, httpFetch = fetch, now = new Date()) {
  const url = env.INGEST_ALERT_WEBHOOK_URL;
  if (!url) return {status: 'SKIPPED', reason: 'needs INGEST_ALERT_WEBHOOK_URL', findings: [], details: []};
  const r = {status: 'GREEN', findings: [], details: []};
  const yellow = (f) => { r.status = 'YELLOW'; r.findings.push(f); };
  try {
    const res = await httpFetch(url, {method: 'POST', headers: {'content-type': 'application/json'},
      body: JSON.stringify({source: 'nightly-audit-probe', status: 'error', error: 'synthetic unauthenticated probe', ingestRunId: null, at: now.toISOString()})});
    const p = classifyProbe(res.status, res.headers, await res.text().catch(() => ''));
    if (p.ok) r.details.push(`webhook rejects unauthenticated probe (HTTP ${res.status})`);
    else yellow(`webhook challenged: ${p.why}`);
  } catch (e) {
    yellow(`webhook challenged: probe failed (${e.message})`);
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) r.details.push('ingest-alert issues: needs GITHUB_TOKEN');
  else {
    try {
      const since = new Date(now - DAY_MS).toISOString();
      const res = await httpFetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues?labels=ingest-alert&state=all&since=${since}&per_page=100`,
        {headers: {authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json'}});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bad = unmatchedAlertIssues(await res.json(), now);
      if (bad.length) yellow(`ingest-alert issue(s) without n8n delivery: ${bad.map(i => `#${i.number}`).join(', ')}`);
      else r.details.push('ingest-alert issues: all delivered by n8n');
    } catch (e) {
      yellow(`ingest-alert issues: could not query (${e.message})`);
    }
  }
  return r;
}

export function worst(a, b) {
  const p = {RED: 3, YELLOW: 2, GREEN: 1, SKIPPED: 0};
  return p[a] > p[b] ? a : b;
}

export function collectFindings(res) {
  const crit = [], high = [], med = [];
  Object.entries(res.checks || {}).forEach(([n, c]) => {
    (n === 'privacy' && c.status === 'RED' ? crit : c.status === 'RED' ? high : c.status === 'YELLOW' ? med : []).push(...(c.findings || []).map(f => `[${n}] ${f}`));
  });
  return {crit, high, med};
}

export function auditExitCode(res) {
  if (res.overall === 'RED' || collectFindings(res).crit.length) return 1;
  return 0;
}

export function writeAndPrintReport(res, io = {}) {
  const md = generateReport(res);
  const dir = join('harness', 'audits');
  (io.mkdirSync ?? mkdirSync)(dir, {recursive: true});
  const path = join(dir, `${res.date}.md`);
  (io.writeFileSync ?? writeFileSync)(path, md, 'utf-8');
  (io.log ?? console.log)(md);
  return {path, md, exitCode: auditExitCode(res)};
}

export function generateReport(res) {
  let md = `# Nightly Audit — ${res.date}\nOverall: ${res.overall}\n`;
  const {crit, high, med} = collectFindings(res);
  md += `Critical: ${crit.length ? crit.join('; ') : 'none'}\nHigh: ${high.length ? high.join('; ') : 'none'}\nMedium: ${med.length ? med.join('; ') : 'none'}\n`;
  md += `Ignored: ${res.ignored?.length ? res.ignored.map(formatIgnored).join('; ') : 'none'}\n`;
  md += `Stale: ${res.stale?.length ? res.stale.map(formatIgnored).join('; ') : 'none'}\n`;
  const fr = res.checks?.dataFreshness;
  md += `Data freshness: ${fr?.status === 'SKIPPED' || !fr ? 'skipped' : fr.details.join('; ')}\nSpend: not yet implemented\nDoc-drift PR: none\n\n`;
  
  Object.entries(res.checks || {}).forEach(([n, c]) => {
    md += `### ${n}\n**Status:** ${c.status}\n\n`;
    ['reason', 'impl', 'todo', 'findings', 'details'].forEach(k => {
      if (c[k]?.length || c[k]) {
        md += `**${k === 'impl' ? 'Implemented' : k === 'todo' ? 'Not Yet Implemented' : k.charAt(0).toUpperCase() + k.slice(1)}:** `;
        md += k === 'findings' || k === 'details' ? '\n' + c[k].map(x => `- ${x}`).join('\n') + '\n\n' : k === 'reason' ? c[k] + '\n\n' : c[k].join(', ') + '\n\n';
      }
    });
  });
  
  return md + `---\nTP-0003 nightly audit\n`;
}

export async function main(opts = {}) {
  const date = opts.date || DATE;
  const secretScan = opts.secretScan || checkSecretScan;
  const build = opts.build || checkBuild;
  const deps = opts.deps || checkDeps;
  const harness = opts.harness || checkHarnessIntegrity;
  const emit = opts.emit || writeAndPrintReport;
  const log = opts.log || console.log;
  const data = opts.data || checkData;
  const res = {date, overall: 'GREEN', checks: {}, ignored: [], stale: []};
  
  const {freshness, sanity} = await data();
  res.checks.dataFreshness = freshness;
  res.checks.dataSanity = sanity;
  for (const c of [freshness, sanity]) res.overall = worst(res.overall, c.status === 'SKIPPED' ? 'GREEN' : c.status);
  const {grants, rls} = await (opts.grantsRls || checkGrantsAndRls)();
  res.checks.grants = grants;
  if (grants.status !== 'SKIPPED') res.overall = worst(res.overall, grants.status);

  const sec = secretScan(), sup = await (opts.suppression || checkSuppression)();
  const priv = [rls, sup].reduce((s, c) => worst(s, c.status === 'SKIPPED' ? 'GREEN' : c.status), sec.status);
  res.checks.privacy = {
    status: priv,
    impl: ['Secret scan', ...(rls.status === 'SKIPPED' ? [] : ['RLS + view security_invoker guard']), ...(sup.status === 'SKIPPED' ? [] : ['Suppression suite: no cell < 11 in board/export packets'])],
    todo: [...(sup.status === 'SKIPPED' ? ['Suppression suite (needs Supabase secrets)'] : []), ...(rls.status === 'SKIPPED' ? ['RLS (needs Supabase secrets)'] : [])],
    findings: [...sec.findings, ...rls.findings, ...sup.findings],
    details: [...sec.details, ...rls.details, ...sup.details]
  };
  if (priv !== 'GREEN') res.overall = worst(res.overall, priv);
  
  const bld = build(), dep = deps(), ci = await (opts.mainCi || checkMainCi)(), dpl = await (opts.deploys || checkDeploys)();
  res.ignored = dep.ignored || [];
  res.stale = dep.stale || [];
  res.checks.buildHealth = {
    status: [ci, dpl].reduce((s, c) => worst(s, c.status === 'SKIPPED' ? 'GREEN' : c.status), worst(bld.status, dep.status)),
    impl: ['Lint', 'Typecheck', 'Test', 'Deps', ...(ci.status === 'SKIPPED' ? [] : ['Main CI']), ...(dpl.status === 'SKIPPED' ? [] : ['Deploy health'])],
    todo: dpl.status === 'SKIPPED' ? ['Deploy health (needs VERCEL_TOKEN)'] : [],
    findings: [...bld.findings, ...dep.findings, ...ci.findings, ...dpl.findings],
    details: [...bld.details, ...dep.details, ...ci.details, ...dpl.details]
  };
  if (res.checks.buildHealth.status !== 'GREEN') res.overall = worst(res.overall, res.checks.buildHealth.status);
  
  const har = harness();
  res.checks.harnessIntegrity = {status: har.status, impl: ['Feature evidence', 'AGENTS.md commands', 'Doc refs', 'Progress log'], findings: har.findings, details: har.details};
  if (har.status !== 'GREEN') res.overall = worst(res.overall, har.status);
  
  const alerts = await (opts.alerts || checkIngestAlerts)();
  res.checks.ingestAlerts = alerts;
  if (alerts.status !== 'SKIPPED') res.overall = worst(res.overall, alerts.status);

  res.checks.cost = {status: 'SKIPPED', reason: 'needs CURSOR_ADMIN_API_KEY (Cloud Agent usage) and LLM provider usage key; caps in D-009', findings: [], details: []};
  
  const {path, exitCode} = emit(res);
  log(`Report: ${path}`);
  return exitCode;
}

// Only run main when executed directly
import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--secrets-only')) {
    const r = checkSecretScanTree();
    for (const d of r.details) console.log(d);
    for (const f of r.findings) console.error(f);
    process.exit(secretsOnlyExit(r));
  }
  const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});
  const opts = process.env.NIGHTLY_AUDIT_FIXTURE === 'red'
    ? {secretScan: ok, build: ok, harness: ok, mainCi: ok, deploys: ok, alerts: ok, grantsRls: async () => ({grants: ok(), rls: ok()}), deps: () => ({status: 'RED', findings: ['fixture'], details: [], ignored: [], stale: []})}
    : {};
  main(opts).then(c => process.exit(c ?? 1)).catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
