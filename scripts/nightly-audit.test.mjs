/**
 * Unit tests for nightly audit
 */

import { describe, it, expect } from 'vitest';
import { worst, generateReport, matchSecretLine, checkProgressLog, parseAgentsCommands } from './nightly-audit.mjs';

describe('worst', () => {
  it('ranks RED > YELLOW > GREEN > SKIPPED', () => {
    expect(worst('GREEN', 'RED')).toBe('RED');
    expect(worst('GREEN', 'YELLOW')).toBe('YELLOW');
    expect(worst('SKIPPED', 'GREEN')).toBe('GREEN');
  });
});

describe('generateReport', () => {
  it('includes template lines', () => {
    const md = generateReport({date: '2026-10-08', overall: 'GREEN', checks: {}});
    ['Overall:', 'Critical:', 'High:', 'Medium:', 'Data freshness:', 'Spend:', 'Doc-drift PR:'].forEach(k => expect(md).toContain(k));
  });

  it('maps privacy RED to Critical', () => {
    const md = generateReport({date: '2026-10-08', overall: 'RED', checks: {privacy: {status: 'RED', findings: ['Secret'], details: []}, other: {status: 'RED', findings: ['Issue'], details: []}}});
    expect(md).toContain('Critical: [privacy] Secret');
    expect(md).toContain('High: [other] Issue');
  });
});

describe('matchSecretLine', () => {
  it('ignores env(...) placeholders', () => expect(matchSecretLine('+ api_key = "env(API_KEY)"')).toBe(false));
  it('flags fake secrets and PEM keys', () => {
    expect(matchSecretLine('+ ' + 'api' + '_key = "' + 'supersecret12345' + '"')).toBe(true);
    expect(matchSecretLine('+ ' + '-----BEGIN ' + 'RSA PRIVATE' + ' KEY-----')).toBe(true);
  });
});

describe('checkProgressLog', () => {
  it('finds documented PRs and flags missing', () => {
    const r1 = checkProgressLog(['Fix bug (#3)', 'Merge pull request #4 from'], 'PR #3 fix\nPR #4 feature');
    expect(r1.found).toEqual(['3', '4']);
    expect(r1.missing).toEqual([]);
    const r2 = checkProgressLog(['Add feature (#5)'], 'PR #3 done');
    expect(r2.found).toEqual([]);
    expect(r2.missing).toEqual(['5']);
  });
});

describe('parseAgentsCommands', () => {
  it('parses pnpm scripts, skips builtins and non-pnpm', () => {
    const cmds = parseAgentsCommands(`## Commands\n> Note\n\`\`\`\npnpm install\npnpm dev\npnpm lint\npnpm typecheck\npnpm test\npnpm test:db\npnpm test:e2e\npnpm seed:synthetic\nsupabase start\n\`\`\``);
    expect(cmds).toEqual(['dev', 'lint', 'typecheck', 'test', 'test:db', 'test:e2e', 'seed:synthetic']);
  });
  it('returns empty when no fence', () => expect(parseAgentsCommands('## Commands\nNo code')).toEqual([]));
});
