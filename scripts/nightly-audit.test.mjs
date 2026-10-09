import { describe, it, expect } from 'vitest';
import { worst, generateReport, matchSecretLine, checkProgressLog, parseAgentsCommands, parseAudit, checkSecretScan, checkDocRefs, auditExitCode, writeAndPrintReport, checkDeps, main, formatIgnored } from './nightly-audit.mjs';
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
    ['Overall:', 'Critical:', 'High:', 'Medium:', 'Ignored:', 'Data freshness:', 'Spend:', 'Doc-drift PR:'].forEach(k => expect(md).toContain(k));
  });
  it('maps privacy RED to Critical', () => {
    const md = generateReport({date: '2026-10-08', overall: 'RED', checks: {privacy: {status: 'RED', findings: ['Secret'], details: []}, other: {status: 'RED', findings: ['Issue'], details: []}}});
    expect(md).toContain('Critical: [privacy] Secret');
    expect(md).toContain('High: [other] Issue');
  });
  it('lists ignored advisories with id, package, reason, reviewer and expiry', () => {
    const ig = {id: 'CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm', package: 'braces', severity: 'high', reason: 'dev-only lint toolchain transitive dep, no patched release', reviewer: 'QA bot', expires: '2026-11-08'};
    const md = generateReport({date: '2026-10-09', overall: 'GREEN', checks: {}, ignored: [ig]});
    expect(md).toContain('Ignored: ' + formatIgnored(ig));
    ['CVE-2026-93687', 'GHSA-vfj7-8cjw-p6xm', 'braces', 'dev-only lint toolchain transitive dep, no patched release', 'QA bot', '2026-11-08'].forEach(k => expect(md).toContain(k));
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
    expect(matchSecretLine('+ ' + '-----BEGIN ' + 'EC PRIVATE' + ' KEY-----')).toBe(true);
    expect(matchSecretLine('+ ' + '-----BEGIN ' + 'OPENSSH PRIVATE' + ' KEY-----')).toBe(true);
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
const BRACES_IG = {id: 'CVE-2026-93687 / GHSA-vfj7-8cjw-p6xm', package: 'braces', reason: 'dev-only lint toolchain transitive dep, no patched release', reviewer: 'QA bot', expires: '2026-11-08'};
const BRACES_JSON = JSON.stringify({advisories: {'1240992': {severity: 'high', module_name: 'braces', cves: ['CVE-2026-93687'], github_advisory_id: 'GHSA-vfj7-8cjw-p6xm'}}, metadata: {vulnerabilities: {critical: 0, high: 1, moderate: 0, low: 0}}});
function expectFailClosed(out) {
  const r = parseAudit(out);
  expect(r.status).not.toBe('GREEN');
  expect(r.status).toBe('RED');
  expect(auditExitCode({overall: r.status, checks: {buildHealth: {status: r.status, findings: [r.finding]}}})).not.toBe(0);
}
describe('parseAudit', () => {
  it('returns RED on empty or invalid', () => {
    ['', 'not json', '{}'].forEach(s => {
      expect(parseAudit(s).status).toBe('RED');
      expect(parseAudit(s).finding).toBe('audit could not run');
    });
  });
  it('returns RED on high', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"high":1}}}')).toMatchObject({status: 'RED', finding: '0 critical, 1 high'}));
  it('returns GREEN on no high/critical', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"low":2}}}')).toMatchObject({status: 'GREEN', finding: 'No high/critical (2 low)'}));
  it('empty advisories object is RED not GREEN', () => expectFailClosed('{"advisories":{}}'));
  it('empty advisories array is RED not GREEN', () => expectFailClosed('[]'));
  it('advisories array field is RED not GREEN', () => expectFailClosed('{"advisories":[],"metadata":{"vulnerabilities":{"high":1}}}'));
  it('empty advisories with metadata {} is RED not GREEN', () => expectFailClosed('{"advisories":{},"metadata":{}}'));
  it('empty advisories while metadata has critical 3 / high 2 is RED not GREEN', () => expectFailClosed('{"advisories":{},"metadata":{"vulnerabilities":{"critical":3,"high":2}}}'));
  it('unknown severity is RED not GREEN', () => expectFailClosed('{"advisories":{"1":{"severity":"severe","module_name":"x"}},"metadata":{"vulnerabilities":{"critical":1}}}'));
  it('missing severity is RED not GREEN', () => expectFailClosed('{"advisories":{"1":{"module_name":"x"}},"metadata":{"vulnerabilities":{"critical":1}}}'));
  it('unexpired ignore is GREEN and listed', () => {
    const r = parseAudit(BRACES_JSON, {ignores: [BRACES_IG], today: '2026-10-09'});
    expect(r.status).toBe('GREEN');
    expect(r.ignored[0]).toMatchObject({id: BRACES_IG.id, package: 'braces', severity: 'high', reviewer: 'QA bot', expires: '2026-11-08'});
  });
  it('expired ignore is RED', () => {
    const r = parseAudit(BRACES_JSON, {ignores: [BRACES_IG], today: '2026-11-09'});
    expect(r.status).toBe('RED');
    expect(r.finding).toBe('0 critical, 1 high');
    expect(r.ignored).toEqual([]);
  });
});
describe('checkSecretScan', () => {
  it('returns RED on git missing', () => {
    const failGit = () => { throw new Error('Command failed: git log'); };
    expect(checkSecretScan(failGit)).toEqual({status: 'RED', findings: ['secret scan could not run'], details: []});
  });
});
describe('checkDeps', () => {
  it('pnpm audit crash is RED', () => {
    expect(checkDeps({run: () => { throw new Error('crash'); }}).status).toBe('RED');
  });
  it('network failure is RED', () => {
    expect(checkDeps({run: () => { throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org'); }}).status).toBe('RED');
  });
  it('garbage output is RED', () => {
    expect(checkDeps({run: () => 'not json', ignores: []}).status).toBe('RED');
  });
  it('empty object output is RED', () => {
    expect(checkDeps({run: () => '{}', ignores: []}).status).toBe('RED');
  });
});
const greenStub = () => ({status: 'GREEN', findings: [], details: [], ignored: []});
describe('main', () => {
  it("returns non-zero when a check is RED", async () => {
    const code = await main({
      secretScan: greenStub, build: greenStub,
      deps: () => ({status: 'RED', findings: ['0 critical, 1 high'], details: [], ignored: []}),
      harness: greenStub, emit: (res) => ({path: 'x', md: '', exitCode: auditExitCode(res)}), log: () => {},
    });
    expect(code).not.toBe(0);
  });
  it("returns 0 when checks are GREEN", async () => {
    const code = await main({
      secretScan: greenStub, build: greenStub, deps: greenStub, harness: greenStub,
      emit: (res) => ({path: 'x', md: '', exitCode: auditExitCode(res)}), log: () => {},
    });
    expect(code).toBe(0);
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
