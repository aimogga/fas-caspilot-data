#!/usr/bin/env node

/**
 * Build health check
 * Runs lint, typecheck, and test on main branch
 */

import { execSync } from 'child_process';

export function checkBuildHealth() {
  const results = {
    status: 'GREEN',
    findings: [],
    details: []
  };

  const checks = [
    { name: 'lint', command: 'pnpm lint' },
    { name: 'typecheck', command: 'pnpm typecheck' },
    { name: 'test', command: 'pnpm test' }
  ];

  for (const check of checks) {
    try {
      execSync(check.command, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      results.details.push(`✓ ${check.name} passed`);
    } catch (error) {
      results.status = 'RED';
      results.findings.push(`${check.name} failed: ${error.message.split('\n')[0]}`);
    }
  }

  return results;
}
