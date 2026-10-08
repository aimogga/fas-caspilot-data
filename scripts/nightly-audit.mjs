#!/usr/bin/env node
/**
 * Nightly Audit (TP-0003) - First slice toward F-601
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DATE = new Date().toISOString().split('T')[0];

function checkHarnessIntegrity() {
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    const fl = JSON.parse(readFileSync('harness/feature_list.json', 'utf-8'));
    const passing = fl.features.filter(f => f.status === 'passing');
    const noEv = passing.filter(f => !f.evidence?.length);
    
    if (noEv.length) {
      r.status = 'YELLOW';
      r.findings.push(`${noEv.length} passing feature(s) lack evidence`);
    } else {
      r.details.push(passing.length ? `All ${passing.length} passing feature(s) have evidence` : 'No passing features yet');
    }

    const amd = readFileSync('AGENTS.md', 'utf-8');
    const cmds = amd.match(/## Commands\n```\n([\s\S]*?)\n```/)?.[1]
      .split('\n').filter(l => l.trim() && !l.trim().startsWith('#'))
      .map(l => l.split('#')[0].trim().replace(/^pnpm /, '').split(' ')[0]) || [];
    
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const missing = cmds.filter(c => !pkg.scripts?.[c]);
    
    if (missing.length) {
      r.status = 'YELLOW';
      r.findings.push(`Missing commands: ${missing.join(', ')}`);
    } else {
      r.details.push('All AGENTS.md commands exist');
    }

    if (existsSync('docs')) {
      const docs = execSync('find docs -name "*.md" 2>/dev/null || true', {encoding: 'utf-8'}).trim().split('\n').filter(f => f);
      let broken = [];
      for (const doc of docs) {
        const txt = readFileSync(doc, 'utf-8');
        const refs = txt.match(/\[.*?\]\(([^)]+)\)/g) || [];
        for (const ref of refs) {
          const p = ref.match(/\[.*?\]\(([^)]+)\)/)?.[1];
          if (p && !p.startsWith('#') && !p.startsWith('http')) {
            const dir = doc.substring(0, doc.lastIndexOf('/'));
            if (!existsSync(join(dir, p))) broken.push(`${doc}: ${p}`);
          }
        }
      }
      if (broken.length) {
        r.status = 'YELLOW';
        r.findings.push(`${broken.length} broken doc ref(s)`);
      } else if (docs.length) {
        r.details.push(`No broken refs in ${docs.length} doc(s)`);
      }
    }
  } catch (e) {
    r.status = 'RED';
    r.findings.push(`Error: ${e.message}`);
  }
  return r;
}

function checkSecretScan() {
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const commits = execSync(`git log --since="${yesterday}" --format="%H" 2>/dev/null || echo ""`, {encoding: 'utf-8'}).trim().split('\n').filter(c => c);
    
    if (!commits.length) {
      r.details.push('No commits in last 24h');
      return r;
    }
    
    r.details.push(`Scanned ${commits.length} commit(s)`);
    
    const patterns = [
      {n: 'AWS', p: /AKIA[0-9A-Z]{16}/},
      {n: 'Key', p: /-----BEGIN .* PRIVATE KEY-----/},
      {n: 'Secret', p: /(password|secret|token|api[_-]?key)\s*[:=]\s*['"][^'"]{12,}['"]/i}
    ];
    
    let found = 0;
    for (const c of commits) {
      const diff = execSync(`git show ${c} --format="" --no-color`, {encoding: 'utf-8', maxBuffer: 10*1024*1024});
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
        
        for (const {p} of patterns) {
          if (p.test(line)) found++;
        }
      }
    }
    
    if (found) {
      r.status = 'RED';
      r.findings.push(`${found} potential secret(s)`);
    } else {
      r.details.push('No obvious secrets');
    }
  } catch (e) {
    r.status = 'YELLOW';
    r.findings.push(`Error: ${e.message}`);
  }
  return r;
}

function checkDeps() {
  const r = {status: 'GREEN', findings: [], details: []};
  try {
    let out;
    try {
      out = execSync('pnpm audit --json', {encoding: 'utf-8', stdio: 'pipe'});
    } catch (e) {
      out = e.stdout || '{}';
    }
    const d = JSON.parse(out);
    const v = d.metadata?.vulnerabilities || {};
    const [c, h, m, l] = [v.critical||0, v.high||0, v.moderate||0, v.low||0];
    
    if (c || h) {
      r.status = 'RED';
      r.findings.push(`${c} critical, ${h} high`);
    } else if (m) {
      r.status = 'YELLOW';
      r.findings.push(`${m} moderate`);
    } else {
      r.details.push(`No high/critical (${l} low)`);
    }
  } catch (e) {
    r.status = 'YELLOW';
    r.findings.push(`Error: ${e.message}`);
  }
  return r;
}

function checkBuild() {
  const r = {status: 'GREEN', findings: [], details: []};
  for (const [n, cmd] of [['lint', 'pnpm lint'], ['typecheck', 'pnpm typecheck'], ['test', 'pnpm test']]) {
    try {
      execSync(cmd, {stdio: 'pipe', timeout: 30000});
      r.details.push(`${n} passed`);
    } catch {
      r.status = 'RED';
      r.findings.push(`${n} failed`);
    }
  }
  return r;
}

export function worst(a, b) {
  const p = {RED: 3, YELLOW: 2, GREEN: 1, SKIPPED: 0};
  return p[a] > p[b] ? a : b;
}

export function generateReport(res) {
  let md = `# Nightly Audit — ${res.date}\n`;
  md += `Overall: ${res.overall}\n`;
  const [crit, high, med] = [[], [], []];
  for (const [n, c] of Object.entries(res.checks)) {
    // Privacy area is Critical severity per NIGHTLY_AUDIT.md
    if (n === 'privacy' && c.status === 'RED') {
      crit.push(...c.findings.map(f => `[${n}] ${f}`));
    } else if (c.status === 'RED') {
      high.push(...c.findings.map(f => `[${n}] ${f}`));
    } else if (c.status === 'YELLOW') {
      med.push(...c.findings.map(f => `[${n}] ${f}`));
    }
  }
  md += `Critical: ${crit.length ? crit.join('; ') : 'none'}\n`;
  md += `High: ${high.length ? high.join('; ') : 'none'}\n`;
  md += `Medium: ${med.length ? med.join('; ') : 'none'}\n`;
  md += `Data freshness: not yet implemented (needs database)\n`;
  md += `Spend: not yet implemented\n`;
  md += `Doc-drift PR: none\n\n`;
  
  for (const [n, c] of Object.entries(res.checks)) {
    md += `### ${n}\n**Status:** ${c.status}\n\n`;
    if (c.reason) md += `**Reason:** ${c.reason}\n\n`;
    if (c.impl?.length) md += `**Implemented:** ${c.impl.join(', ')}\n\n`;
    if (c.todo?.length) md += `**Not Yet Implemented:** ${c.todo.join(', ')}\n\n`;
    if (c.findings?.length) md += `**Findings:**\n${c.findings.map(f => `- ${f}`).join('\n')}\n\n`;
    if (c.details?.length) md += `**Details:**\n${c.details.map(d => `- ${d}`).join('\n')}\n\n`;
  }
  
  md += `---\nTP-0003 nightly audit\n`;
  return md;
}

async function main() {
  const res = {date: DATE, overall: 'GREEN', checks: {}};
  
  res.checks.dataFreshness = {status: 'SKIPPED', reason: 'needs database', findings: [], details: []};
  res.checks.dataSanity = {status: 'SKIPPED', reason: 'needs database schema', findings: [], details: []};
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
  
  const bld = checkBuild();
  const dep = checkDeps();
  res.checks.buildHealth = {
    status: worst(bld.status, dep.status),
    impl: ['Lint', 'Typecheck', 'Test', 'Deps'],
    todo: ['Deploy health (needs VERCEL_TOKEN)'],
    findings: [...bld.findings, ...dep.findings],
    details: [...bld.details, ...dep.details]
  };
  if (bld.status !== 'GREEN' || dep.status !== 'GREEN') res.overall = worst(res.overall, worst(bld.status, dep.status));
  
  const har = checkHarnessIntegrity();
  res.checks.harnessIntegrity = {
    status: har.status,
    impl: ['Feature evidence', 'AGENTS.md commands', 'Doc refs'],
    todo: ['Progress log validation'],
    findings: har.findings,
    details: har.details
  };
  if (har.status !== 'GREEN') res.overall = worst(res.overall, har.status);
  
  res.checks.cost = {status: 'SKIPPED', reason: 'needs cloud billing API', findings: [], details: []};
  
  mkdirSync('harness/audits', {recursive: true});
  const path = join('harness', 'audits', `${DATE}.md`);
  writeFileSync(path, generateReport(res), 'utf-8');
  
  console.log(`\nNightly Audit — ${DATE}`);
  console.log(`Overall: ${res.overall}`);
  console.log(`Report: ${path}\n`);
  
  process.exit(0);
}

// Only run main when executed directly
import { pathToFileURL } from 'url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
  });
}
