#!/usr/bin/env node
// Claude Code PreToolUse hook (D-028): runs `pnpm gate` before any `git push` and blocks the push when a row fails.
// Input: hook JSON on stdin ({tool_name, tool_input:{command}}). Exit 2 = block (stderr goes back to the model).
import { spawnSync } from 'node:child_process';

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
  const r = spawnSync('pnpm', ['gate'], { encoding: 'utf8' });
  if (r.status === 0) process.exit(0);
  process.stderr.write(`pr-gate blocked the push:\n${r.stdout}${r.stderr}`);
  process.exit(2);
});
