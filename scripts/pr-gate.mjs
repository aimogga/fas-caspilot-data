#!/usr/bin/env node
// pr-gate (D-028): the deterministic PR checks QA applies, as a script instead of an instruction.
// Usage: node scripts/pr-gate.mjs [--base origin/main] [--skip-tests]   (pnpm gate)
// Rows print as `step | requirement | verdict | evidence`; exit 1 when any row fails.
import { execFileSync, execSync, spawnSync } from 'node:child_process';
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

/** D-041: one file per progress entry, so two branches never touch the same path. `harness/progress.md` is frozen history. */
export const PROGRESS_DIR = 'harness/progress/';
export const PROGRESS_ENTRY = /^harness\/progress\/\d{4}-\d{2}-\d{2}T\d{4}Z-[A-Za-z0-9._-]+\.md$/;

/** Takes `git diff --name-status --no-renames base...HEAD`: the branch adds exactly one well-named entry file and edits none. */
export function progressEntry(nameStatus) {
  const rows = String(nameStatus).split('\n').filter(Boolean).map((l) => l.split('\t'));
  if (rows.some(([, f]) => f === 'harness/progress.md')) return { verdict: 'fail', evidence: 'harness/progress.md is frozen (D-041); move the entry to harness/progress/<YYYY-MM-DDTHHMMZ>-<branch>.md' };
  const mine = rows.filter(([, f]) => f.startsWith(PROGRESS_DIR));
  const edited = mine.filter(([s]) => s !== 'A').map(([s, f]) => `${f} (${s})`);
  if (edited.length) return { verdict: 'fail', evidence: `existing entries changed: ${edited.join(', ')}` };
  const bad = mine.map(([, f]) => f).filter((f) => !PROGRESS_ENTRY.test(f));
  if (bad.length) return { verdict: 'fail', evidence: `entry name must be harness/progress/<YYYY-MM-DDTHHMMZ>-<branch>.md: ${bad.join(', ')}` };
  if (mine.length === 0) return { verdict: 'warn', evidence: 'no new entry yet (add one before the PR opens)' };
  if (mine.length > 1) return { verdict: 'fail', evidence: `exactly one new entry per branch, found ${mine.length}: ${mine.map(([, f]) => f).join(', ')}` };
  return { verdict: 'pass', evidence: `1 new entry: ${mine[0][1]}` };
}

function gitFiles(exec) {
  const list = (args) => exec(`git ${args}`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  return [...list('ls-files'), ...list('ls-files --others --exclude-standard')];
}

function changedFiles(exec, base) {
  const names = exec(`git diff --name-only --diff-filter=AM ${base}...HEAD`, { encoding: 'utf-8' }).trim().split('\n').filter((n) => n && !BINARY.test(n));
  return Object.fromEntries(names.map((n) => [n, readFileSync(n, 'utf-8')]));
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
  step('progress entry', 'exactly one new harness/progress/ file; no existing entry or progress.md edited', () =>
    progressEntry(exec(`git diff --name-status --no-renames ${base}...HEAD`, { encoding: 'utf-8' })));
  rows.push({ name: 'PR body', requirement: 'contains `Refs F-xxx`; lists excluded files by name', verdict: 'manual', evidence: 'QA checks the body; not visible here' });
  return rows;
}

export function format(rows) {
  return ['step | requirement | verdict | evidence', ...rows.map((r) => `${r.name} | ${r.requirement} | ${r.verdict} | ${r.evidence}`)].join('\n');
}

export function exitCode(rows) {
  return rows.some((r) => r.verdict === 'fail') ? 1 : 0;
}

const gitArgs = (args) => execFileSync('git', args, { encoding: 'utf-8' });

/** D-032: a stacked branch is gated against its parent. `--base` wins; else `git config branch.<current>.gateBase` (set by the
 * engineer, e.g. `origin/f508a-llm-adapter`); else `origin/main`. Only `origin/*` refs are accepted, so the base is always a pushed branch.
 * `git` takes an argument list, never a shell string: a branch name may contain `;` or `$(…)`. */
export function resolveBase(argv = process.argv, git = gitArgs) {
  const i = argv.indexOf('--base');
  if (i !== -1) return argv[i + 1];
  let configured = '';
  try {
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    configured = git(['config', '--get', `branch.${branch}.gateBase`]).trim();
  } catch {
    return 'origin/main';
  }
  if (!configured) return 'origin/main';
  if (!/^origin\/[\w./-]+$/.test(configured)) throw new Error(`gateBase must be an origin/* branch, got ${configured}`);
  return configured;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = resolveBase();
  const rows = run({ base, skipTests: process.argv.includes('--skip-tests') });
  console.log(`gate base: ${base}`);
  console.log(format(rows));
  process.exit(exitCode(rows));
}
