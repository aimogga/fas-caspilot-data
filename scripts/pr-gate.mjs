#!/usr/bin/env node
// pr-gate (D-028): the deterministic PR checks QA applies, as a script instead of an instruction.
// Usage: node scripts/pr-gate.mjs [--base origin/main] [--skip-tests]   (pnpm gate)
// Base when --base is absent: $PR_GATE_BASE, else `git config branch.<current>.gate-base`, else origin/main (D-032 stacks).
// Rows print as `step | requirement | verdict | evidence`; exit 1 when any row fails.
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { checkSecretScanTree, secretsOnlyExit } from './nightly-audit.mjs';

export const MAX_LINES = 400;
export const MAX_LINE_LENGTH = 300;
/** Committed screenshots, PDFs, fonts and workbooks are never read as text (a PNG row is not a 300-char line). */
export const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|woff2?|xlsx|zip)$/i;
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];

export function loadGenerated(read = readFileSync, path = 'harness/generated-files.json') {
  try {
    const parsed = JSON.parse(read(path, 'utf-8'));
    return Array.isArray(parsed.files) ? parsed.files : [];
  } catch {
    return [];
  }
}

/** D-012: hand-written added + deleted lines. Lockfiles, markdown, binaries and listed generated files don't count but are named. */
export function countDiff(numstat, generated = []) {
  const out = { added: 0, deleted: 0, total: 0, excluded: [] };
  for (const line of String(numstat).split('\n').filter(Boolean)) {
    const [a, d, file] = line.split('\t');
    const skip = a === '-' ? 'binary' : LOCKFILES.includes(file) ? 'lockfile' : file.endsWith('.md') ? 'markdown' : generated.includes(file) ? 'generated' : null;
    if (skip) {
      out.excluded.push(`${file} (${skip})`);
      continue;
    }
    out.added += Number(a);
    out.deleted += Number(d);
  }
  out.total = out.added + out.deleted;
  return out;
}

/** QA rejects code lines over 300 chars (#141 lost a round to one). Markdown and binaries are exempt. */
export function longLines(files, max = MAX_LINE_LENGTH, generated = []) {
  const hits = [];
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith('.md') || BINARY.test(path) || generated.includes(path)) continue;
    String(text).split('\n').forEach((l, i) => {
      if (l.length > max) hits.push(`${path}:${i + 1} (${l.length})`);
    });
  }
  return hits;
}

/** progress.md is append-only: the base file must survive as a prefix, and the branch's own `## ` entry comes after it. */
export function progressAppendOnly(baseText, headText) {
  const base = String(baseText).trimEnd();
  const head = String(headText).trimEnd();
  if (!head.startsWith(base)) return { verdict: 'fail', evidence: 'lines from the base branch were changed or removed' };
  const added = head.slice(base.length);
  const entries = (added.match(/^## /gm) || []).length;
  if (entries === 0) return { verdict: 'warn', evidence: 'no new entry yet (append one before the PR opens)' };
  return { verdict: 'pass', evidence: `${entries} new entry appended last` };
}

function gitFiles(exec) {
  const list = (args) => exec(`git ${args}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  return [...list('ls-files'), ...list('ls-files --others --exclude-standard')];
}

function changedFiles(exec, base) {
  const names = exec(`git diff --name-only --diff-filter=AM ${base}...HEAD`, { encoding: 'utf-8' }).trim().split('\n').filter((n) => n && !BINARY.test(n));
  return Object.fromEntries(names.map((n) => [n, readFileSync(n, 'utf-8')]));
}

/** The ref D-012 and the other diff rows measure against, and where it came from: --base > PR_GATE_BASE > branch gate-base > origin/main. */
export function resolveBase({ argv = [], env = {}, exec = execSync } = {}) {
  const i = argv.indexOf('--base');
  if (i !== -1 && argv[i + 1]) return { base: argv[i + 1], from: '--base' };
  if (env.PR_GATE_BASE?.trim()) return { base: env.PR_GATE_BASE.trim(), from: 'PR_GATE_BASE' };
  try {
    const branch = exec('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const key = `branch.${branch}.gate-base`;
    const set = branch && branch !== 'HEAD' ? exec(`git config --get ${key}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() : '';
    if (set) return { base: set, from: `git config ${key}` };
  } catch {
    // unset key (git exits 1) or no repo: fall through to the default
  }
  return { base: 'origin/main', from: 'default' };
}

export function run({ base = 'origin/main', skipTests = false, exec = execSync, spawn = spawnSync, read = readFileSync } = {}) {
  const rows = [];
  const step = (name, requirement, fn) => {
    try {
      rows.push({ name, requirement, ...fn() });
    } catch (e) {
      rows.push({ name, requirement, verdict: 'fail', evidence: String(e.message ?? e).replace(/\s+/g, ' ').slice(0, 240) });
    }
  };
  const pnpm = (name, args) => step(name, `pnpm ${args.join(' ')} exits 0`, () => {
    const r = spawn('pnpm', args, { encoding: 'utf-8' });
    if (r.status !== 0) throw new Error(`${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-6).join(' | '));
    return { verdict: 'pass', evidence: 'exit 0' };
  });
  if (!skipTests) {
    pnpm('lint', ['lint']);
    pnpm('typecheck', ['typecheck']);
    pnpm('unit tests', ['test']);
  }
  step('secret scan', 'no secret in tracked or untracked files', () => {
    const r = checkSecretScanTree({ listFiles: () => gitFiles(exec) });
    if (secretsOnlyExit(r) !== 0) throw new Error(r.findings.join('; '));
    return { verdict: 'pass', evidence: r.details.join('; ') };
  });
  step('D-012 lines', `hand-written added+deleted <= ${MAX_LINES}`, () => {
    const c = countDiff(exec(`git diff --numstat ${base}...HEAD`, { encoding: 'utf-8' }), loadGenerated(read));
    const evidence = `+${c.added}/-${c.deleted} = ${c.total}; excluded: ${c.excluded.join(', ') || 'none'}`;
    if (c.total > MAX_LINES) throw new Error(evidence);
    return { verdict: 'pass', evidence };
  });
  step('300-char lines', `no changed code line over ${MAX_LINE_LENGTH} chars`, () => {
    const files = changedFiles(exec, base);
    const hits = longLines(files, MAX_LINE_LENGTH, loadGenerated(read));
    if (hits.length) throw new Error(hits.join(', '));
    return { verdict: 'pass', evidence: `${Object.keys(files).length} changed file(s) checked` };
  });
  step('progress.md', 'append-only; branch entry last', () => {
    const baseText = exec(`git show ${base}:harness/progress.md`, { encoding: 'utf-8' });
    return progressAppendOnly(baseText, read('harness/progress.md', 'utf-8'));
  });
  rows.push({ name: 'PR body', requirement: 'contains `Refs F-xxx`; lists excluded files by name', verdict: 'manual', evidence: 'QA checks the body; not visible here' });
  return rows;
}

export function format(rows) {
  return ['step | requirement | verdict | evidence', ...rows.map((r) => `${r.name} | ${r.requirement} | ${r.verdict} | ${r.evidence}`)].join('\n');
}

export function exitCode(rows) {
  return rows.some((r) => r.verdict === 'fail') ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { base, from } = resolveBase({ argv: process.argv, env: process.env });
  const rows = run({ base, skipTests: process.argv.includes('--skip-tests') });
  console.log(`base: ${base} (${from})\n${format(rows)}`);
  process.exit(exitCode(rows));
}
