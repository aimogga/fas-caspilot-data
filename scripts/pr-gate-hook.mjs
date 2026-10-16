#!/usr/bin/env node
// Claude Code PreToolUse hook (D-028): runs `pnpm gate --base <base>` before any `git push` and blocks the push when a row fails.
// Input: hook JSON on stdin ({tool_name, tool_input:{command}}). Exit 2 = block (stderr goes back to the model).
// Base (D-032 stacked branches): $PR_GATE_BASE, else `git config branch.<current>.gateBase`, else origin/main.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE = 'origin/main';

/** Pure: the env var wins, then the current branch's `gateBase` config, then origin/main. */
export function resolveBase({ env = {}, branchBase = '' } = {}) {
  const fromEnv = String(env.PR_GATE_BASE ?? '').trim();
  if (fromEnv) return { base: fromEnv, from: 'PR_GATE_BASE' };
  const fromConfig = String(branchBase ?? '').trim();
  if (fromConfig) return { base: fromConfig, from: 'branch gateBase' };
  return { base: DEFAULT_BASE, from: 'default' };
}

/** Reads `branch.<current>.gateBase`; '' on a detached HEAD or when unset. */
export function readBranchBase(spawn = spawnSync) {
  const git = (args) => {
    const r = spawn('git', args, { encoding: 'utf8' });
    return r.status === 0 ? String(r.stdout).trim() : '';
  };
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return branch ? git(['config', '--get', `branch.${branch}.gateBase`]) : '';
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    let command = '';
    try {
      command = JSON.parse(input).tool_input?.command ?? '';
    } catch {
      process.exit(0);
    }
    if (!/\bgit\s+push\b/.test(command)) process.exit(0);
    const { base, from } = resolveBase({ env: process.env, branchBase: readBranchBase() });
    const r = spawnSync('pnpm', ['gate', '--base', base], { encoding: 'utf8' });
    if (r.status === 0) process.exit(0);
    process.stderr.write(`pr-gate blocked the push (base ${base}, from ${from}):\n${r.stdout}${r.stderr}`);
    process.exit(2);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
