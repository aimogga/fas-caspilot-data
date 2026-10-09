import { describe, it, expect } from 'vitest';
import { worst, generateReport, matchSecretLine, checkProgressLog, parseAgentsCommands, parseAudit, checkSecretScan, checkDocRefs, auditExitCode, writeAndPrintReport } from './nightly-audit.mjs';
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
describe('auditExitCode', () => {
  it('RED exits non-zero', () => {
    expect(auditExitCode({overall: 'RED', checks: {buildHealth: {status: 'RED', findings: ['0 critical, 1 high']}}})).not.toBe(0);
  });
  it('Critical exits non-zero', () => {
    expect(auditExitCode({overall: 'YELLOW', checks: {privacy: {status: 'RED', findings: ['Secret']}}})).not.toBe(0);
  });
  it('GREEN exits 0', () => {
    expect(auditExitCode({overall: 'GREEN', checks: {}})).toBe(0);
  });
  it('YELLOW exits 0', () => {
    expect(auditExitCode({overall: 'YELLOW', checks: {harnessIntegrity: {status: 'YELLOW', findings: ['Missing commands']}}})).toBe(0);
  });
});
describe('writeAndPrintReport', () => {
  it('prints the full markdown report', () => {
    const logs = [];
    const files = {};
    const res = {date: '2026-10-09', overall: 'RED', checks: {buildHealth: {status: 'RED', findings: ['0 critical, 1 high'], details: []}}};
    const {md, exitCode} = writeAndPrintReport(res, {
      mkdirSync: () => {},
      writeFileSync: (p, c) => { files[p] = c; },
      log: (s) => logs.push(s),
    });
    expect(exitCode).not.toBe(0);
    expect(logs.join('\n')).toBe(md);
    expect(logs.join('\n')).toContain('# Nightly Audit — 2026-10-09');
    expect(logs.join('\n')).toContain('Overall: RED');
    expect(files['harness/audits/2026-10-09.md']).toBe(md);
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
    expect(checkProgressLog(['Fix (#3)', 'Merge pull request #4 from'], 'PR #3\nPR #4')).toEqual({found: ['3', '4'], missing: []});
    expect(checkProgressLog(['Add (#5)'], 'PR #3')).toEqual({found: [], missing: ['5']});
  });
});
describe('parseAgentsCommands', () => {
  it('parses pnpm scripts, skips builtins and non-pnpm', () => {
    expect(parseAgentsCommands(`## Commands\n> Phase 1 finalizes these.\n\`\`\`\npnpm install\npnpm dev\npnpm lint\npnpm typecheck\npnpm test\npnpm test:db\npnpm test:e2e\npnpm seed:synthetic\nsupabase start\n\`\`\``)).toEqual(['dev', 'lint', 'typecheck', 'test', 'test:db', 'test:e2e', 'seed:synthetic']);
  });
  it('returns empty when no fence', () => expect(parseAgentsCommands('## Commands\nNo code')).toEqual([]));
  it('stops at next heading', () => expect(parseAgentsCommands('## Commands\ntext\n## Other\n```\npnpm dev\n```')).toEqual([]));
});
describe('parseAudit', () => {
  it('returns YELLOW on empty or invalid', () => {
    ['', 'not json', '{}'].forEach(s => expect(parseAudit(s)).toEqual({status: 'YELLOW', finding: 'audit could not run'}));
  });
  it('returns RED on high', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"high":1}}}')).toEqual({status: 'RED', finding: '0 critical, 1 high'}));
  it('returns GREEN on no high/critical', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"low":2}}}')).toEqual({status: 'GREEN', finding: 'No high/critical (2 low)'}));
  it('returns RED from remaining advisories even if metadata is empty', () => {
    expect(parseAudit('{"advisories":{"1":{"severity":"high"}},"metadata":{"vulnerabilities":{"high":0}}}')).toEqual({status: 'RED', finding: '0 critical, 1 high'});
  });
  it('ignores muted highs when advisories is empty', () => {
    expect(parseAudit('{"advisories":{},"metadata":{"vulnerabilities":{"high":1}}}')).toEqual({status: 'GREEN', finding: 'No high/critical (0 low)'});
  });
});
describe('checkSecretScan', () => {
  it('returns YELLOW on git failure', () => {
    const failGit = () => { throw new Error('Command failed: git log'); };
    expect(checkSecretScan(failGit)).toEqual({status: 'YELLOW', findings: ['could not read git history'], details: []});
  });
});
describe('checkDocRefs', () => {
  it('returns nothing to check on 0 refs', () => {
    expect(checkDocRefs(() => ['a.md'], () => 'no links', () => true)).toEqual({status: null, detail: 'Doc refs: nothing to check (0 refs in 1 doc(s))'});
  });
  it('returns detail on N refs with none broken', () => {
    expect(checkDocRefs(() => ['a.md'], () => '[link](b.md)', (p) => p.endsWith('b.md'))).toEqual({status: null, detail: 'Checked 1 ref(s) in 1 doc(s), none broken'});
  });
  it('returns YELLOW on broken ref', () => {
    expect(checkDocRefs(() => ['a.md'], () => '[link](missing.md)', () => false).status).toBe('YELLOW');
  });
  it('returns YELLOW on listing failure', () => {
    expect(checkDocRefs(() => { throw new Error('ENOENT'); }, () => '', () => true)).toEqual({status: 'YELLOW', finding: 'Doc refs: could not run (ENOENT)'});
  });
});
