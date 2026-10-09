import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { worst, generateReport, matchSecretLine, checkProgressLog, parseAgentsCommands, parseAudit, checkSecretScan, checkDocRefs, auditExitCode, writeAndPrintReport, checkDeps, main, runPnpmAudit } from './nightly-audit.mjs';
const GHSA_IG = {id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', reason: 'CVE-2026-93687; dev-only lint toolchain transitive dep, no patched release', reviewer: 'QA bot', expires: '2026-11-08', severity: 'high'};
const STALE_IG = {...GHSA_IG, id: 'GHSA-aaaa-bbbb-cccc', package: 'nope'};
const BRACES_JSON = JSON.stringify({advisories: {'1240992': {severity: 'high', module_name: 'braces', cves: ['CVE-2026-93687'], github_advisory_id: 'GHSA-vfj7-8cjw-p6xm'}}, metadata: {vulnerabilities: {critical: 0, high: 1, moderate: 0, low: 0}}});
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
    ['Overall:', 'Critical:', 'High:', 'Medium:', 'Ignored:', 'Stale:', 'Data freshness:', 'Spend:', 'Doc-drift PR:'].forEach(k => expect(md).toContain(k));
  });
  it('maps privacy RED to Critical', () => {
    const md = generateReport({date: '2026-10-08', overall: 'RED', checks: {privacy: {status: 'RED', findings: ['Secret'], details: []}, other: {status: 'RED', findings: ['Issue'], details: []}}});
    expect(md).toContain('Critical: [privacy] Secret');
    expect(md).toContain('High: [other] Issue');
  });
  it('lists ignored and stale with literal report text', () => {
    const md = generateReport({date: '2026-10-09', overall: 'YELLOW', checks: {}, ignored: [GHSA_IG], stale: [STALE_IG]});
    expect(md).toContain('Ignored: GHSA-vfj7-8cjw-p6xm (braces, high): CVE-2026-93687; dev-only lint toolchain transitive dep, no patched release, reviewer QA bot, re-review by 2026-11-08');
    expect(md).toContain('Stale: GHSA-aaaa-bbbb-cccc (nope, high): CVE-2026-93687; dev-only lint toolchain transitive dep, no patched release, reviewer QA bot, re-review by 2026-11-08');
  });
});
describe('auditExitCode', () => {
  it.each([
    [{overall: 'RED', checks: {buildHealth: {status: 'RED', findings: ['x']}}}, false],
    [{overall: 'YELLOW', checks: {privacy: {status: 'RED', findings: ['Secret']}}}, false],
    [{overall: 'GREEN', checks: {}}, true],
    [{overall: 'YELLOW', checks: {harnessIntegrity: {status: 'YELLOW', findings: ['x']}}}, true],
  ])('exit zero? %j', (res, zero) => expect(auditExitCode(res) === 0).toBe(zero));
});
describe('writeAndPrintReport', () => {
  it('prints the full markdown report', () => {
    const logs = [], files = {};
    const res = {date: '2026-10-09', overall: 'RED', checks: {buildHealth: {status: 'RED', findings: ['0 critical, 1 high'], details: []}}};
    const {md, exitCode} = writeAndPrintReport(res, {mkdirSync() {}, writeFileSync(p, c) { files[p] = c; }, log: s => logs.push(s)});
    expect(exitCode).not.toBe(0);
    expect(logs.join('\n')).toBe(md);
    expect(md).toContain('# Nightly Audit — 2026-10-09');
    expect(md).toContain('Overall: RED');
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
    expect(matchSecretLine('+ -----' + 'BEGIN PRIVATE KEY-----')).toBe(true);
    expect(matchSecretLine('+ -----' + 'BEGIN ENCRYPTED PRIVATE KEY-----')).toBe(true);
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
function expectFailClosed(out) {
  const r = parseAudit(out);
  expect(r.status).toBe('RED');
  expect(auditExitCode({overall: r.status, checks: {buildHealth: {status: r.status, findings: [r.finding]}}})).not.toBe(0);
}
describe('parseAudit', () => {
  it.each(['', 'not json', '{}'])('RED could not run %j', s => expect(parseAudit(s)).toMatchObject({status: 'RED', finding: 'audit could not run'}));
  it('returns RED on high', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"high":1}}}')).toMatchObject({status: 'RED', finding: '0 critical, 1 high'}));
  it('returns GREEN on no high/critical', () => expect(parseAudit('{"metadata":{"vulnerabilities":{"low":2}}}')).toMatchObject({status: 'GREEN', finding: 'No high/critical (2 low)'}));
  it.each([
    '{"advisories":{}}', '[]', '{"advisories":[],"metadata":{"vulnerabilities":{"high":1}}}',
    '{"advisories":{},"metadata":{}}', '{"advisories":{},"metadata":{"vulnerabilities":{"critical":3,"high":2}}}',
    '{"advisories":{},"metadata":{"vulnerabilities":{"moderate":2}}}',
    '{"advisories":[],"metadata":{"vulnerabilities":{"critical":0,"high":0,"moderate":0,"low":0}}}',
  ])('fail-closed %s', expectFailClosed);
  it.each([
    '{"advisories":{"1":{"severity":"severe","module_name":"x"}},"metadata":{"vulnerabilities":{"low":1}}}',
    '{"advisories":{"1":{"module_name":"x"}},"metadata":{"vulnerabilities":{"low":1}}}',
  ])('unknown severity is an error not low %s', out => expect(parseAudit(out)).toMatchObject({status: 'RED', finding: 'unknown severity'}));
  it('unexpired ignore is GREEN and listed', () => {
    const r = parseAudit(BRACES_JSON, {ignores: [GHSA_IG], today: '2026-10-09'});
    expect(r.status).toBe('GREEN');
    expect(r.ignored[0]).toMatchObject({id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', severity: 'high', reviewer: 'QA bot', expires: '2026-11-08'});
  });
  it('expired ignore is RED', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [GHSA_IG], today: '2026-11-09'})).toMatchObject({status: 'RED', finding: '0 critical, 1 high', ignored: []});
  });
  it.each([
    [{expires: undefined}, 'expiry missing'], [{expires: 'never'}, 'never'], [{expires: '2026/11/08'}, 'slash date'],
    [{expires: 20261108}, 'numeric expires'], [{reviewer: undefined}, 'missing reviewer'], [{reason: undefined}, 'missing reason'],
    [{package: undefined}, 'missing package'], [{id: ''}, 'empty id'],
    [{reviewer: '   '}, 'whitespace reviewer'], [{expires: '2026-02-30'}, 'Feb 30'],
    [{id: 'CVE-2026-93687'}, 'CVE id'], [{expires: '2027-01-08'}, 'over 90 days'],
  ])('invalid ignore %s is RED', (over) => {
    const r = parseAudit(BRACES_JSON, {ignores: [{...GHSA_IG, ...over}], today: '2026-10-09'});
    expect(r.status).toBe('RED');
    expect(r.finding).toMatch(/^invalid ignore/);
  });
  it('ignore requires GHSA id and package match', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [{...GHSA_IG, package: 'left-pad'}], today: '2026-10-09'})).toMatchObject({status: 'RED', finding: '0 critical, 1 high', ignored: []});
  });
  it('upgraded severity is RED', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [{...GHSA_IG, severity: 'moderate'}], today: '2026-10-09'})).toMatchObject({status: 'RED', ignored: []});
  });
  it('reports stale ignores as YELLOW', () => {
    const r = parseAudit(BRACES_JSON, {ignores: [GHSA_IG, STALE_IG], today: '2026-10-09'});
    expect(r.status).toBe('YELLOW');
    expect(r.stale.map(s => s.id)).toContain('GHSA-aaaa-bbbb-cccc');
  });
  it('duplicate GHSA same package is RED', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [GHSA_IG, {...GHSA_IG, expires: '2026-11-09'}], today: '2026-10-09'}).status).toBe('RED');
  });
  it('duplicate GHSA different package is RED', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [GHSA_IG, {...GHSA_IG, package: 'left-pad'}], today: '2026-10-09'}).status).toBe('RED');
  });
  it('reports moderate and stale together', () => {
    const r = parseAudit(JSON.stringify({advisories: {1: {severity: 'moderate', module_name: 'x', github_advisory_id: 'GHSA-xxxx-yyyy-zzzz'}}, metadata: {vulnerabilities: {moderate: 1}}}), {ignores: [STALE_IG], today: '2026-10-09'});
    expect(r.status).toBe('YELLOW');
    expect(r.finding).toMatch(/moderate/);
    expect(r.finding).toMatch(/stale/);
  });
});
describe('checkSecretScan', () => {
  it('returns RED on git missing', () => {
    const failGit = () => { throw new Error('Command failed: git log'); };
    expect(checkSecretScan(failGit)).toEqual({status: 'RED', findings: ['secret scan could not run'], details: []});
  });
});
describe('checkDeps', () => {
  it.each([
    [() => { throw new Error('crash'); }],
    [() => { throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org'); }],
    [() => 'not json'],
    [() => '{}'],
  ])('scanner fault is RED', run => expect(checkDeps({run, ignores: []}).status).toBe('RED'));
  it('pnpm runner propagates scanner errors', () => {
    const boom = () => { throw Object.assign(new Error('crash'), {stdout: ''}); };
    expect(() => runPnpmAudit(boom)).toThrow();
    expect(checkDeps({run: () => runPnpmAudit(boom)}).status).toBe('RED');
  });
  it('passes pnpm audit timeout', () => {
    let opts;
    runPnpmAudit((_c, o) => { opts = o; return '{}'; });
    expect(opts.timeout).toBe(90000);
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
  it('main passes ignored and stale into the report', async () => {
    let md = '';
    await main({
      secretScan: greenStub, build: greenStub, harness: greenStub,
      deps: () => ({status: 'YELLOW', findings: ['stale'], details: [], ignored: [GHSA_IG], stale: [STALE_IG]}),
      emit: (res) => ({path: 'x', md: md = generateReport(res), exitCode: 0}), log: () => {},
    });
    expect(md).toContain('Ignored: GHSA-vfj7-8cjw-p6xm (braces, high):');
    expect(md).toContain('Stale: GHSA-aaaa-bbbb-cccc (nope, high):');
  });
  it('CLI entry exits non-zero for RED fixture', () => {
    const r = spawnSync(process.execPath, ['scripts/nightly-audit.mjs'], {env: {...process.env, NIGHTLY_AUDIT_FIXTURE: 'red'}, encoding: 'utf8', timeout: 15000});
    expect(r.status).not.toBe(0);
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
