import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { BINARY, MAX_LINES, countDiff, exitCode, format, loadGenerated, longLines, progressAppendOnly, resolveBase, run } from './pr-gate.mjs';

const numstat = (rows) => rows.map(([a, d, f]) => `${a}\t${d}\t${f}`).join('\n');

describe('countDiff (D-012)', () => {
  it('counts added plus deleted and names what it excludes', () => {
    const c = countDiff(numstat([[10, 2, 'lib/a.ts'], [300, 0, 'pnpm-lock.yaml'], [50, 50, 'docs/x.md'], [9, 0, 'public/geo/utah.json'], ['-', '-', 'img.png']]), ['public/geo/utah.json']);
    expect(c).toEqual({ added: 10, deleted: 2, total: 12, excluded: ['pnpm-lock.yaml (lockfile)', 'docs/x.md (markdown)', 'public/geo/utah.json (generated)', 'img.png (binary)'] });
  });

  it('fails a 401-line diff and passes 400 through run()', () => {
    const fake = (lines) => ({ exec: (cmd) => (cmd.includes('--numstat') ? numstat([[lines, 0, 'lib/big.ts']]) : cmd.includes('git show') ? '# p\n' : ''), read: () => '# p\n' });
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

describe('progressAppendOnly', () => {
  const base = '# Progress\n\n## 2026-10-13 17:05 (UTC) — A\nDid: a\n';
  it('passes when the branch entry is appended after the base text', () => {
    expect(progressAppendOnly(base, `${base}\n## 2026-10-13 18:00 (UTC) — B\nDid: b\n`)).toEqual({ verdict: 'pass', evidence: '1 new entry appended last' });
  });
  it('fails when a base line is removed or changed, warns when nothing was appended', () => {
    expect(progressAppendOnly(base, base.replace('Did: a', 'Did: changed')).verdict).toBe('fail');
    expect(progressAppendOnly(base, '# Progress\n').verdict).toBe('fail');
    expect(progressAppendOnly(base, base).verdict).toBe('warn');
    expect(exitCode([{ verdict: 'warn' }, { verdict: 'manual' }])).toBe(0);
  });
});

describe('run and CLI', () => {
  it('turns a failing pnpm step into a fail row with the last output lines', () => {
    const spawn = (_cmd, args) => (args[0] === 'lint' ? { status: 1, stdout: 'a\nb\n', stderr: 'boom' } : { status: 0, stdout: '', stderr: '' });
    const rows = run({ spawn, exec: (cmd) => (cmd.includes('git show') ? '' : ''), read: () => '' });
    expect(rows.find((r) => r.name === 'lint')).toMatchObject({ verdict: 'fail', evidence: 'a | b | boom' });
    expect(rows.find((r) => r.name === 'typecheck').verdict).toBe('pass');
    expect(format(rows).split('\n')[0]).toBe('step | requirement | verdict | evidence');
  });

  it('reads the generated-files allowlist and tolerates a missing one', () => {
    expect(loadGenerated(() => JSON.stringify({ files: ['a.json'] }))).toEqual(['a.json']);
    expect(loadGenerated(() => { throw new Error('ENOENT'); })).toEqual([]);
  });

  it('CLI --skip-tests exits 0 on this repo (base HEAD: CI checkouts have no origin/main)', () => {
    const r = spawnSync(process.execPath, ['scripts/pr-gate.mjs', '--skip-tests', '--base', 'HEAD'], { encoding: 'utf8', timeout: 60000 });
    expect(r.stdout).toContain('secret scan | ');
    expect(r.status).toBe(0);
  });
});

describe('resolveBase (D-032 stacked branches)', () => {
  // Fake git: `config` answers with the branch's gate-base, `merge-base --is-ancestor` throws unless the parent is merged.
  const git = ({ parent = '', merged = false } = {}) => (cmd) => {
    if (cmd.includes('rev-parse')) return 'f508a1-openrouter-guard\n';
    if (cmd.includes('config --get')) {
      expect(cmd).toContain('branch.f508a1-openrouter-guard.gate-base');
      if (!parent) throw new Error('exit 1');
      return `${parent}\n`;
    }
    if (cmd.includes('merge-base --is-ancestor') && !merged) throw new Error('exit 1');
    return '';
  };

  it('prefers --base, then PR_GATE_BASE, over the branch config', () => {
    const exec = git({ parent: 'origin/parent' });
    expect(resolveBase({ argv: ['--base', 'HEAD'], env: { PR_GATE_BASE: 'origin/x' }, exec })).toEqual({ base: 'HEAD', source: '--base' });
    expect(resolveBase({ env: { PR_GATE_BASE: 'origin/x' }, exec })).toEqual({ base: 'origin/x', source: 'PR_GATE_BASE' });
  });

  it("uses the branch's gate-base parent while it is not yet on main", () => {
    expect(resolveBase({ exec: git({ parent: 'origin/f508a-llm-adapter' }) })).toEqual({ base: 'origin/f508a-llm-adapter', source: 'gate-base' });
  });

  it('falls back to origin/main once the parent is merged, or when no parent is set', () => {
    expect(resolveBase({ exec: git({ parent: 'origin/f508a-llm-adapter', merged: true }) })).toEqual({
      base: 'origin/main',
      source: 'default (origin/f508a-llm-adapter is merged)',
    });
    expect(resolveBase({ exec: git() })).toEqual({ base: 'origin/main', source: 'default' });
  });

  it('CLI reads PR_GATE_BASE and prints the base it used', () => {
    const r = spawnSync(process.execPath, ['scripts/pr-gate.mjs', '--skip-tests'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, PR_GATE_BASE: 'HEAD' } });
    expect(r.stdout.split('\n')[0]).toBe('base: HEAD (PR_GATE_BASE)');
    expect(r.status).toBe(0);
  });
});
