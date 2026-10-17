import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BINARY, MAX_LINES, countDiff, exitCode, format, loadGenerated, longLines, progressEntry, resolveBase, run } from './pr-gate.mjs';

const numstat = (rows) => rows.map(([a, d, f]) => `${a}\t${d}\t${f}`).join('\n');

describe('countDiff (D-012)', () => {
  it('counts added plus deleted and names what it excludes', () => {
    const c = countDiff(numstat([[10, 2, 'lib/a.ts'], [300, 0, 'pnpm-lock.yaml'], [50, 50, 'docs/x.md'], [9, 0, 'public/geo/utah.json'], ['-', '-', 'img.png']]), ['public/geo/utah.json']);
    expect(c).toEqual({ added: 10, deleted: 2, total: 12, excluded: ['pnpm-lock.yaml (lockfile)', 'docs/x.md (markdown)', 'public/geo/utah.json (generated)', 'img.png (binary)'] });
  });

  it('fails a 401-line diff and passes 400 through run()', () => {
    const fake = (lines) => ({ exec: (cmd) => (cmd.includes('--numstat') ? numstat([[lines, 0, 'lib/big.ts']]) : ''), read: () => '' });
    const rows = run({ skipTests: true, ...fake(401) });
    expect(rows.find((r) => r.name === 'D-012 lines')).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining('= 401') });
    expect(exitCode(rows)).toBe(1);
    expect(run({ skipTests: true, ...fake(MAX_LINES) }).find((r) => r.name === 'D-012 lines').verdict).toBe('pass');
  });
});

describe('longLines', () => {
  it('reports code lines over 300 chars with file and line, and ignores markdown', () => {
    const long = 'x'.repeat(301);
    expect(longLines({ 'lib/a.ts': `ok\n${long}`, 'docs/b.md': long, 'lib/c.ts': 'y'.repeat(300) })).toEqual(['lib/a.ts:2 (301)']);
    expect(longLines({ 'public/geo/x.json': long }, 300, ['public/geo/x.json'])).toEqual([]);
  });

  it('skips binary paths such as committed PNG screenshots, but still checks code beside them', () => {
    const row = 'x'.repeat(400);
    expect(['a.png', 'b.JPG', 'c.jpeg', 'd.pdf', 'e.woff2', 'f.xlsx', 'g.zip'].every((f) => BINARY.test(f))).toBe(true);
    expect(longLines({ 'docs/design/reviews/DS-10a/after/staff-375.png': row })).toEqual([]);
    expect(longLines({ 'docs/design/reviews/DS-10a/notes.ts': row })).toEqual(['docs/design/reviews/DS-10a/notes.ts:1 (400)']);
  });
});

describe('progressEntry (D-041)', () => {
  const entry = 'harness/progress/2026-10-16T0358Z-claude-exciting-ritchie-7wg8ec.md';
  const ns = (rows) => rows.map(([s, f]) => `${s}\t${f}`).join('\n');
  it('passes when the branch adds exactly one well-named entry file', () => {
    expect(progressEntry(ns([['M', 'lib/a.ts'], ['A', entry]]))).toEqual({ verdict: 'pass', evidence: `1 new entry: ${entry}` });
  });
  it('warns when no entry was added yet', () => {
    expect(progressEntry(ns([['M', 'lib/a.ts']])).verdict).toBe('warn');
    expect(progressEntry('').verdict).toBe('warn');
  });
  it('fails two new entries, an edited or deleted entry, or a bad name', () => {
    const second = 'harness/progress/2026-10-16T0400Z-other.md';
    expect(progressEntry(ns([['A', entry], ['A', second]]))).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining('found 2') });
    expect(progressEntry(ns([['A', entry], ['M', second]]))).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining(`${second} (M)`) });
    expect(progressEntry(ns([['D', second]]))).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining('(D)') });
    for (const bad of ['harness/progress/notes.md', 'harness/progress/2026-10-16-0358-x.md', 'harness/progress/2026-10-16T0358Z-a/b.md', 'harness/progress/2026-10-16T0358Z-x.txt']) {
      expect(progressEntry(ns([['A', bad]]))).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining('entry name') });
    }
  });
  it('fails any edit to the frozen harness/progress.md, even an append', () => {
    expect(progressEntry(ns([['A', entry], ['M', 'harness/progress.md']]))).toMatchObject({ verdict: 'fail', evidence: expect.stringContaining('frozen') });
    expect(exitCode([{ verdict: 'warn' }, { verdict: 'manual' }])).toBe(0);
  });
  it('run() reads the name-status diff against the base', () => {
    const cmds = [];
    const exec = (cmd) => (cmds.push(cmd), cmd.includes('--name-status') ? `A\t${entry}\n` : '');
    expect(run({ skipTests: true, base: 'origin/p', exec, read: () => '' }).find((r) => r.name === 'progress entry').verdict).toBe('pass');
    expect(cmds).toContain('git diff --name-status --no-renames origin/p...HEAD');
  });
});

describe('run and CLI', () => {
  it('turns a failing pnpm step into a fail row with the last output lines', () => {
    const spawn = (_cmd, args) => (args[0] === 'lint' ? { status: 1, stdout: 'a\nb\n', stderr: 'boom' } : { status: 0, stdout: '', stderr: '' });
    const rows = run({ spawn, exec: () => '', read: () => '' });
    expect(rows.find((r) => r.name === 'lint')).toMatchObject({ verdict: 'fail', evidence: 'a | b | boom' });
    expect(rows.find((r) => r.name === 'typecheck').verdict).toBe('pass');
    expect(format(rows).split('\n')[0]).toBe('step | requirement | verdict | evidence');
  });

  it('reads the generated-files allowlist and tolerates a missing one', () => {
    expect(loadGenerated(() => JSON.stringify({ files: ['a.json'] }))).toEqual(['a.json']);
    expect(loadGenerated(() => { throw new Error('ENOENT'); })).toEqual([]);
  });

  // The child gets 60 s; vitest's 5 s default cut it off when the first git and file scan after a fresh commit ran slow inside `pnpm gate`
  // ("Test timed out in 5000ms", seen 2026-10-17), so the test's own limit matches the child's.
  const CLI_MS = 60000;
  it('CLI --skip-tests exits 0 on this repo (base HEAD: CI checkouts have no origin/main)', () => {
    const r = spawnSync(process.execPath, ['scripts/pr-gate.mjs', '--skip-tests', '--base', 'HEAD'], { encoding: 'utf8', timeout: CLI_MS });
    expect(r.stdout).toContain('secret scan | ');
    expect(r.status).toBe(0);
  }, CLI_MS + 5000);
});

describe('resolveBase (D-032 stacked branches)', () => {
  const git = (branch, configured) => (args) => {
    expect(Array.isArray(args)).toBe(true);
    if (args[0] === 'rev-parse') return `${branch}\n`;
    if (configured === undefined) throw new Error('exit 1');
    return `${configured}\n`;
  };
  it('--base wins, then branch.<name>.gateBase, then origin/main', () => {
    expect(resolveBase(['node', 'gate', '--base', 'HEAD'], git('x', 'origin/p'))).toBe('HEAD');
    expect(resolveBase(['node', 'gate'], git('child', 'origin/parent-branch'))).toBe('origin/parent-branch');
    expect(resolveBase(['node', 'gate'], git('feature', undefined))).toBe('origin/main');
    expect(resolveBase(['node', 'gate'], git('feature', ''))).toBe('origin/main');
  });
  it('refuses a configured base that is not an origin/* branch', () => {
    expect(() => resolveBase(['node', 'gate'], git('child', 'HEAD'))).toThrow(/origin\/\*/);
    expect(() => resolveBase(['node', 'gate'], git('child', 'origin/x;rm -rf .'))).toThrow(/origin\/\*/);
  });
  it('PR_GATE_BASE sits between --base and gateBase, and must be an origin/* branch', () => {
    const env = { PR_GATE_BASE: 'origin/env-parent' };
    expect(resolveBase(['node', 'gate', '--base', 'HEAD'], git('x', 'origin/p'), env)).toBe('HEAD');
    expect(resolveBase(['node', 'gate'], git('child', 'origin/parent-branch'), env)).toBe('origin/env-parent');
    expect(resolveBase(['node', 'gate'], git('child', 'origin/parent-branch'), { PR_GATE_BASE: '' })).toBe('origin/parent-branch');
    expect(() => resolveBase(['node', 'gate'], git('x', undefined), { PR_GATE_BASE: 'origin/x;rm -rf .' })).toThrow(/PR_GATE_BASE must be/);
  });
  it('passes the branch name to git as one argument, never through a shell', () => {
    const calls = [];
    const git = (args) => (calls.push(args), args[0] === 'rev-parse' ? 'feature;id;#\n' : 'origin/p\n');
    expect(resolveBase(['node', 'gate'], git)).toBe('origin/p');
    expect(calls[1]).toEqual(['config', '--get', 'branch.feature;id;#.gateBase']);
  });
});
