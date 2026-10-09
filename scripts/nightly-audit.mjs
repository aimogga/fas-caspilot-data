#!/usr/bin/env node
import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
const DATE = new Date().toISOString().split('T')[0];
export function parseAgentsCommands(md) {
  const m = md.match(/## Commands\n([\s\S]*?)(```\n([\s\S]*?)\n```|\n## )/);
  return m && m[3] ? [...new Set(m[3].split('\n').filter(l => l.trim().startsWith('pnpm ')).map(l => l.split('#')[0].trim().replace(/^pnpm /, '').split(/\s+/)[0]).filter(c => c !== 'install'))] : [];
}
function countVulns(parsed) {
  const adv = parsed.advisories;
  if (adv && typeof adv === 'object') {
    const n = {critical: 0, high: 0, moderate: 0, low: 0};
    for (const a of Object.values(adv)) {
      const s = String(a?.severity || '').toLowerCase();
      if (s in n) n[s]++;
    }
    return n;
  }
  const v = parsed.metadata?.vulnerabilities;
  if (!v) return null;
  return {critical: v.critical || 0, high: v.high || 0, moderate: v.moderate || 0, low: v.low || 0};
}

export function parseAudit(out) {
  if (!out || !out.trim()) return {status: 'YELLOW', finding: 'audit could not run'};
  try {
    const n = countVulns(JSON.parse(out));
    if (!n) return {status: 'YELLOW', finding: 'audit could not run'};
    const [c, h, m, l] = [n.critical, n.high, n.moderate, n.low];
    if (c || h) return {status: 'RED', finding: `${c} critical, ${h} high`};
    if (m) return {status: 'YELLOW', finding: `${m} moderate`};
    return {status: 'GREEN', finding: `No high/critical (${l} low)`};
  } catch {
    return {status: 'YELLOW', finding: 'audit could not run'};
  }
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
    new RegExp('-----BEGIN ' + '.* PRIVATE' + ' KEY-----'),
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
    r.details.push(`Scanned ${commits.length} commit(s)`);
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
    if (found) {
      r.status = 'RED';
      r.findings.push(`${found} potential secret(s)`);
    } else r.details.push('No obvious secrets');
  } catch {
    r.status = 'YELLOW';
    r.findings.push('could not read git history');
  }
  return r;
}

function checkDeps() {
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    let out;
    try { out = execSync('pnpm audit --json', {encoding: 'utf-8', stdio: 'pipe'}); }
    catch (e) { out = e.stdout || ''; }
    const {status, finding} = parseAudit(out);
    r.status = status;
    if (status === 'GREEN') r.details.push(finding);
    else r.findings.push(finding);
  } catch (e) {
    r.status = 'YELLOW';
    r.findings.push(`Error: ${e.message}`);
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

async function main() {
  const res = {date: DATE, overall: 'GREEN', checks: {}};
  
  ['dataFreshness', 'dataSanity'].forEach(k => res.checks[k] = {status: 'SKIPPED', reason: 'needs database' + (k === 'dataSanity' ? ' schema' : ''), findings: [], details: []});
  res.checks.grants = {status: 'SKIPPED', reason: 'needs GRANTS_GOV_API_KEY', findings: [], details: []};
  
  const sec = checkSecretScan();
  res.checks.privacy = {
    status: sec.status,
    impl: ['Secret scan'],
    todo: ['Suppression (needs schema)', 'RLS (needs SUPABASE_ACCESS_TOKEN)', 'Views (needs app)'],
    findings: sec.findings,
    details: sec.details
  };
  if (sec.status !== 'GREEN') res.overall = worst(res.overall, sec.status);
  
  const bld = checkBuild(), dep = checkDeps();
  res.checks.buildHealth = {
    status: worst(bld.status, dep.status),
    impl: ['Lint', 'Typecheck', 'Test', 'Deps'],
    todo: ['Deploy health (needs VERCEL_TOKEN)'],
    findings: [...bld.findings, ...dep.findings],
    details: [...bld.details, ...dep.details]
  };
  if (res.checks.buildHealth.status !== 'GREEN') res.overall = worst(res.overall, res.checks.buildHealth.status);
  
  const har = checkHarnessIntegrity();
  res.checks.harnessIntegrity = {status: har.status, impl: ['Feature evidence', 'AGENTS.md commands', 'Doc refs', 'Progress log'], findings: har.findings, details: har.details};
  if (har.status !== 'GREEN') res.overall = worst(res.overall, har.status);
  
  res.checks.cost = {status: 'SKIPPED', reason: 'needs cloud billing API', findings: [], details: []};
  
  const {path, exitCode} = writeAndPrintReport(res);
  console.log(`Report: ${path}`);
  process.exit(exitCode);
}

// Only run main when executed directly
import { pathToFileURL } from 'url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
