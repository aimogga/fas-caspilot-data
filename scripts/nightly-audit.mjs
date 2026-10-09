#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
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
      const commits = execSync(`git log --since="${yesterday}" --format="%s"`, {encoding: 'utf-8'}).trim().split('\n').filter(c => c);
      const progLog = checkProgressLog(commits, existsSync('harness/progress.md') ? readFileSync('harness/progress.md', 'utf-8') : '');
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

export function checkProgressLog(commits, progressText) {
  const prNums = new Set();
  commits.forEach(c => {
    const m = c.match(/\(#(\d+)\)$/) || (c.startsWith('Merge pull request #') && c.match(/Merge pull request #(\d+)/));
    if (m) prNums.add(m[1]);
  });
  const found = [], missing = [];
  prNums.forEach(n => (progressText.includes(`PR #${n}`) || progressText.includes(`/pull/${n}`) ? found : missing).push(n));
  return {found, missing};
}

export function matchSecretLine(line) {
  return !/"env\([^)]+\)"/.test(line) && [
    /AKIA[0-9A-Z]{16}/,
    new RegExp('-----BEGIN (?:[A-Z0-9]+ )?(?:ENCRYPTED )?PRIVATE KEY-----'),
    /(password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"]/i
  ].some(p => p.test(line));
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
      let inLock = false;
      for (const line of lines) {
        if (line.startsWith('diff --git') && line.includes('lock.')) {
          inLock = true;
          continue;
        }
        if (line.startsWith('diff --git')) inLock = false;
        if (inLock || !line.startsWith('+') || line.startsWith('+++')) continue;
        if (/example|test_/i.test(line)) continue;
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

function checkBuild() {
  const r = {status: 'GREEN', findings: [], details: []};
  [['lint', 'pnpm lint'], ['typecheck', 'pnpm typecheck'], ['test', 'pnpm test']].forEach(([n, cmd]) => {
    try {
      execSync(cmd, {stdio: 'pipe', timeout: 120000});
      r.details.push(`${n} passed`);
    } catch {
      r.status = 'RED';
      r.findings.push(`${n} failed`);
    }
  });
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
  md += `Data freshness: not yet implemented (needs database)\nSpend: not yet implemented\nDoc-drift PR: none\n\n`;
  
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
  const res = {date, overall: 'GREEN', checks: {}, ignored: [], stale: []};
  
  ['dataFreshness', 'dataSanity'].forEach(k => res.checks[k] = {status: 'SKIPPED', reason: 'needs database' + (k === 'dataSanity' ? ' schema' : ''), findings: [], details: []});
  res.checks.grants = {status: 'SKIPPED', reason: 'needs GRANTS_GOV_API_KEY', findings: [], details: []};
  
  const sec = secretScan();
  res.checks.privacy = {
    status: sec.status,
    impl: ['Secret scan'],
    todo: ['Suppression (needs schema)', 'RLS (needs SUPABASE_ACCESS_TOKEN)', 'Views (needs app)'],
    findings: sec.findings,
    details: sec.details
  };
  if (sec.status !== 'GREEN') res.overall = worst(res.overall, sec.status);
  
  const bld = build(), dep = deps();
  res.ignored = dep.ignored || [];
  res.stale = dep.stale || [];
  res.checks.buildHealth = {
    status: worst(bld.status, dep.status),
    impl: ['Lint', 'Typecheck', 'Test', 'Deps'],
    todo: ['Deploy health (needs VERCEL_TOKEN)'],
    findings: [...bld.findings, ...dep.findings],
    details: [...bld.details, ...dep.details]
  };
  if (res.checks.buildHealth.status !== 'GREEN') res.overall = worst(res.overall, res.checks.buildHealth.status);
  
  const har = harness();
  res.checks.harnessIntegrity = {status: har.status, impl: ['Feature evidence', 'AGENTS.md commands', 'Doc refs', 'Progress log'], findings: har.findings, details: har.details};
  if (har.status !== 'GREEN') res.overall = worst(res.overall, har.status);
  
  res.checks.cost = {status: 'SKIPPED', reason: 'needs cloud billing API', findings: [], details: []};
  
  const {path, exitCode} = emit(res);
  log(`Report: ${path}`);
  return exitCode;
}

// Only run main when executed directly
import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});
  const opts = process.env.NIGHTLY_AUDIT_FIXTURE === 'red'
    ? {secretScan: ok, build: ok, harness: ok, deps: () => ({status: 'RED', findings: ['fixture'], details: [], ignored: [], stale: []})}
    : {};
  main(opts).then(c => process.exit(c ?? 1)).catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
