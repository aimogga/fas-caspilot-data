import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE, readBranchBase, resolveBase } from './pr-gate-hook.mjs';

describe('resolveBase (D-032)', () => {
  it('PR_GATE_BASE wins over the branch config', () => {
    expect(resolveBase({ env: { PR_GATE_BASE: 'origin/f508e-strategy-storage' }, branchBase: 'origin/other' })).toEqual({ base: 'origin/f508e-strategy-storage', from: 'PR_GATE_BASE' });
  });

  it('uses the branch gateBase when the env var is unset or blank', () => {
    expect(resolveBase({ env: {}, branchBase: 'origin/parent\n' })).toEqual({ base: 'origin/parent', from: 'branch gateBase' });
    expect(resolveBase({ env: { PR_GATE_BASE: '  ' }, branchBase: 'origin/parent' }).base).toBe('origin/parent');
  });

  it('falls back to origin/main', () => {
    expect(DEFAULT_BASE).toBe('origin/main');
    expect(resolveBase()).toEqual({ base: 'origin/main', from: 'default' });
    expect(resolveBase({ env: { PR_GATE_BASE: '' }, branchBase: '' }).base).toBe('origin/main');
  });
});

describe('readBranchBase', () => {
  const fakeGit = (branch, config) => (cmd, args) => {
    if (args[0] === 'symbolic-ref') return branch ? { status: 0, stdout: `${branch}\n` } : { status: 1, stdout: '' };
    expect(args).toEqual(['config', '--get', `branch.${branch}.gateBase`]);
    return config ? { status: 0, stdout: `${config}\n` } : { status: 1, stdout: '' };
  };

  it('reads branch.<current>.gateBase', () => {
    expect(readBranchBase(fakeGit('f508d-winner-analysis', 'origin/f508e-strategy-storage'))).toBe('origin/f508e-strategy-storage');
  });

  it('is empty when unset or on a detached HEAD', () => {
    expect(readBranchBase(fakeGit('feature', ''))).toBe('');
    expect(readBranchBase(fakeGit('', 'x'))).toBe('');
  });
});

describe('hook', () => {
  it('lets a non-push command through without running the gate', () => {
    const r = spawnSync(process.execPath, ['scripts/pr-gate-hook.mjs'], { input: JSON.stringify({ tool_input: { command: 'git status' } }), encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});
