import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import {
  worst,
  generateReport,
  matchSecretLine,
  checkProgressLog,
  readProgressLog,
  parseAgentsCommands,
  parseAudit,
  checkSecretScan,
  checkSecretScanTree,
  scanFileContents,
  secretsOnlyExit,
  localServiceRoleJwts,
  checkDocRefs,
  auditExitCode,
  writeAndPrintReport,
  checkDeps,
  main,
  runPnpmAudit,
  supabaseRest,
  evalFreshness,
  evalSanity,
  checkData, evalGrants, evalRls, checkGrantsAndRls, checkMainCi, checkDeploys,
  classifyProbe, unmatchedAlertIssues, checkIngestAlerts, N8N_MARKER,
} from './nightly-audit.mjs';
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
function gh(p) { return p + '_' + 'A'.repeat(36); }
function pat() { return ['github', 'pat', 'A'.repeat(22), 'B'.repeat(59)].join('_'); }
function sb() { return 'sb' + '_secret_' + 'x'.repeat(24); }
function srJwt() {
  const h = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const p = Buffer.from('{"role":"service_role","iss":"plant"}').toString('base64url');
  return h + '.' + p + '.sig';
}
function akia() { return 'AKIA' + '0123456789ABCDEF'; }
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
  it.each([
    ['ghp', () => gh('ghp')],
    ['gho', () => gh('gho')],
    ['ghu', () => gh('ghu')],
    ['ghs', () => gh('ghs')],
    ['ghr', () => gh('ghr')],
    ['github_pat', pat],
    ['sb_secret', sb],
    ['service_role jwt bare', srJwt],
    ['service_role jwt quoted', () => '"' + srJwt() + '"'],
    ['SUPABASE_SERVICE_ROLE_KEY', () => 'SUPABASE_SERVICE_ROLE_KEY=' + srJwt()],
    ['postgres url', () => 'postgres://u:' + 'p@' + 'evil.test/db'],
    ['postgresql url', () => 'postgresql://u:' + 'p@' + 'evil.test/db'],
    ['AKIA with example', () => 'example cred ' + akia()],
    ['AWS_SECRET_ACCESS_KEY', () => 'AWS_SECRET_ACCESS_KEY=' + 'A'.repeat(40)],
  ])('flags planted %s', (_n, make) => {
    expect(matchSecretLine(make())).toBe(true);
    expect(scanFileContents({'lock.yaml': make()}).status).toBe('RED');
  });
  it('exempts local supabase defaults by exact value', () => {
    expect(matchSecretLine('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toBe(false);
    expect(matchSecretLine('postgresql://postgres:postgres@localhost:54322/postgres')).toBe(false);
    for (const j of localServiceRoleJwts()) {
      expect(matchSecretLine(j)).toBe(false);
      expect(matchSecretLine('SUPABASE_SERVICE_ROLE_KEY=' + j)).toBe(false);
    }
  });
  it('allows listed placeholders only', () => {
    expect(matchSecretLine('api_key = "your_api_key_here"')).toBe(false);
    expect(matchSecretLine('api_key = "' + 'supersecret12345' + '"')).toBe(true);
  });
});
describe('checkProgressLog', () => {
  it('finds documented PRs and flags missing', () => {
    expect(checkProgressLog(['Fix (#3)', 'Merge pull request #4 from'], 'PR #3\nPR #4')).toEqual({found: ['3', '4'], missing: []});
    expect(checkProgressLog(['Add (#5)'], 'PR #3')).toEqual({found: [], missing: ['5']});
  });
});
describe('readProgressLog (D-041)', () => {
  it('joins the frozen progress.md with each entry file in filename order', () => {
    const files = {'harness/progress.md': 'PR #1', 'd/2026-10-16T0400Z-b.md': 'PR #3', 'd/2026-10-16T0358Z-a.md': 'PR #2'};
    const log = readProgressLog('d', (p) => p === 'd' || p in files, (p) => files[p], () => ['2026-10-16T0400Z-b.md', 'x.txt', '2026-10-16T0358Z-a.md']);
    expect(log).toBe('PR #1\nPR #2\nPR #3');
    expect(checkProgressLog(['Add (#3)'], log).missing).toEqual([]);
  });
});
describe('parseAgentsCommands', () => {
  it('parses pnpm scripts, skips builtins and non-pnpm', () => {
    expect(parseAgentsCommands(`## Commands\n> Phase 1 finalizes these.\n\`\`\`\npnpm install\npnpm dev\npnpm lint\npnpm typecheck\npnpm test\npnpm test:db\npnpm test:e2e\npnpm seed:synthetic\nsupabase start\n\`\`\``))
      .toEqual(['dev', 'lint', 'typecheck', 'test', 'test:db', 'test:e2e', 'seed:synthetic']);
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
  it('severity upgrade is RED and downgrade is not silent GREEN', () => {
    expect(parseAudit(BRACES_JSON, {ignores: [{...GHSA_IG, severity: 'moderate'}], today: '2026-10-09'})).toMatchObject({status: 'RED', ignored: []});
    const down = JSON.stringify({advisories: {'1': {severity: 'moderate', module_name: 'braces', github_advisory_id: GHSA_IG.id}}, metadata: {vulnerabilities: {moderate: 1}}});
    const r = parseAudit(down, {ignores: [GHSA_IG], today: '2026-10-09'});
    expect(r.status).toBe('YELLOW');
    expect(r.ignored).toEqual([]);
  });
  it('reports stale ignores as YELLOW', () => {
    const r = parseAudit(BRACES_JSON, {ignores: [GHSA_IG, STALE_IG], today: '2026-10-09'});
    expect(r.status).toBe('YELLOW');
    expect(r.stale.map(s => s.id)).toContain('GHSA-aaaa-bbbb-cccc');
  });
  it.each([[{...GHSA_IG, expires: '2026-11-09'}], [{...GHSA_IG, package: 'left-pad'}]])('duplicate GHSA is RED %j', extra => {
    expect(parseAudit(BRACES_JSON, {ignores: [GHSA_IG, extra], today: '2026-10-09'}).status).toBe('RED');
  });
  it.each([undefined, null, ''])('missing github_advisory_id %j is counted not ignored', gid => {
    const a = {severity: 'high', module_name: 'braces'};
    if (gid !== undefined) a.github_advisory_id = gid;
    expect(parseAudit(JSON.stringify({advisories: {1: a}, metadata: {vulnerabilities: {high: 1}}}), {ignores: [GHSA_IG], today: '2026-10-09'})).toMatchObject({status: 'RED', ignored: [], finding: '0 critical, 1 high'});
  });
  it('second braces GHSA is counted', () => {
    const r = parseAudit(JSON.stringify({advisories: {a: {severity: 'high', module_name: 'braces', github_advisory_id: GHSA_IG.id}, b: {severity: 'high', module_name: 'braces', github_advisory_id: 'GHSA-xxxx-yyyy-zzzz'}}, metadata: {vulnerabilities: {high: 2}}}),
      {ignores: [GHSA_IG], today: '2026-10-09'});
    expect(r).toMatchObject({status: 'RED', finding: '0 critical, 1 high'});
    expect(r.ignored).toHaveLength(1);
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
describe('checkSecretScanTree', () => {
  const planted = 'api_key = "' + 'supersecret12345' + '"';
  it('fails on a planted secret', () => {
    const r = checkSecretScanTree({listFiles: () => ['app/config.ts'], readFile: () => planted});
    expect(r.status).toBe('RED');
    expect(r.findings[0]).toMatch(/secret/);
    expect(secretsOnlyExit(r)).not.toBe(0);
  });
  it('scanFileContents flags a planted secret fixture', () => {
    expect(scanFileContents({'cfg.ts': planted}).status).toBe('RED');
    expect(secretsOnlyExit(scanFileContents({'cfg.ts': planted}))).toBe(1);
  });
  it('scans lock.* paths', () => {
    expect(scanFileContents({'pnpm-lock.yaml': gh('ghp')}).status).toBe('RED');
  });
  it('passes a clean tree', () => {
    const r = checkSecretScanTree({listFiles: () => ['app/ok.ts'], readFile: () => 'export const x = 1;'});
    expect(r.status).toBe('GREEN');
    expect(secretsOnlyExit(r)).toBe(0);
  });
  it('cannot-run is RED', () => {
    expect(checkSecretScanTree({listFiles: () => { throw new Error('no git'); }})).toEqual({
      status: 'RED', findings: ['secret scan could not run'], details: [],
    });
  });
  it('CLI --secrets-only exits 0 on this repo', () => {
    const r = spawnSync(process.execPath, ['scripts/nightly-audit.mjs', '--secrets-only'], {encoding: 'utf8', timeout: 15000});
    expect(r.status).toBe(0);
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

describe('data checks (synthetic)', () => {
  const now = new Date('2099-06-15T09:00:00Z');
  const hoursAgo = (h) => new Date(now - h * 3600000).toISOString();
  const src = (o) => ({id: 's1', name: 'synthetic-src', cadence: 'annual', status: 'active', last_success_at: hoursAgo(5), ...o});
  const counties = (n, vintage, value = 1) => Array.from({length: n}, (_, i) => ({source_id: 's1', indicator_code: 'x', vintage, geo_fips: `49${String(i * 2 + 1).padStart(3, '0')}`, value}));

  it('freshness: GREEN when recent, YELLOW on one failure or stale, RED on two nights', () => {
    expect(evalFreshness([src()], [], now).status).toBe('GREEN');
    expect(evalFreshness([src({last_success_at: null})], [], now).findings).toEqual(['synthetic-src: no success within annual cadence']);
    const fail = (h) => ({source_id: 's1', status: 'error', started_at: hoursAgo(h)});
    expect(evalFreshness([src()], [fail(3)], now)).toMatchObject({status: 'YELLOW', findings: ['synthetic-src: failed in the last 24h']});
    expect(evalFreshness([src()], [fail(3), fail(27)], now).status).toBe('RED');
    expect(evalFreshness([src({status: 'paused', last_success_at: null})], [], now).status).toBe('GREEN');
  });

  it('sanity: flags missing counties, ±20% row swings and null spikes', () => {
    expect(evalSanity([...counties(29, '2098'), ...counties(29, '2099')], {s1: 'syn'}).status).toBe('GREEN');
    expect(evalSanity(counties(28, '2099'), {s1: 'syn'}).findings).toEqual(['syn/x 2099: 28/29 counties']);
    const swing = evalSanity([...counties(29, '2098'), ...counties(29, '2098').map(r => ({...r, indicator_code: 'x'})), ...counties(29, '2099')], {s1: 'syn'});
    expect(swing.findings).toContain('syn/x 2099: 29 rows vs 58 in 2098');
    expect(evalSanity([...counties(29, '2098'), ...counties(29, '2099', null)], {s1: 'syn'}).findings).toEqual(['syn/x 2099: null spike']);
  });

  it('checkData skips without env and reports query errors as YELLOW', async () => {
    expect(supabaseRest({})).toBeNull();
    expect((await checkData(null)).freshness.status).toBe('SKIPPED');
    const down = supabaseRest({SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'placeholder'}, async () => new Response('', {status: 503}));
    expect((await checkData(down, now)).sanity.findings[0]).toMatch(/HTTP 503/);
  });

  it('checkData queries source_registry, ingest_run and public_indicator', async () => {
    const tables = {source_registry: [src()], ingest_run: [], public_indicator: counties(29, '2099')};
    const paths = [];
    const rest = supabaseRest({SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'placeholder'}, async (url) => {
      const p = String(url).split('/rest/v1/')[1];
      paths.push(p.split('?')[0]);
      return Response.json(tables[p.split('?')[0]]);
    });
    const {freshness, sanity} = await checkData(rest, now);
    expect(paths.sort()).toEqual(['ingest_run', 'public_indicator', 'source_registry']);
    expect(freshness.status).toBe('GREEN');
    expect(sanity.details).toEqual(['synthetic-src/x: latest vintage 2099, 29 rows']);
  });

  it('main folds data checks into overall and the report', async () => {
    const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});
    let report;
    const data = async () => ({freshness: {status: 'YELLOW', findings: ['syn: stale'], details: ['syn: last success never']}, sanity: ok()});
    await main({secretScan: ok, build: ok, deps: ok, harness: ok, data, log: () => {}, emit: (res) => { report = generateReport(res); return {path: 'x', exitCode: 0}; }});
    expect(report).toContain('Overall: YELLOW');
    expect(report).toContain('Data freshness: syn: last success never');
  });
});

describe('grants, RLS and main CI checks (synthetic)', () => {
  const now = new Date('2099-06-15T09:00:00Z');
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  const g = {id: 'g1', name: 'grants-gov', last_success_at: null};
  const pursuing = [{status: 'pursuing', opportunity: {title: 'Syn Grant', close_date: '2099-06-20'}}, {status: 'pursuing', opportunity: {title: 'Far', close_date: '2099-09-01'}}];

  it('grants: RED when key unused 25+ days, GREEN when recent, lists 14d pursuing deadlines', () => {
    expect(evalGrants([g], [], [], now)).toMatchObject({status: 'RED'});
    const r = evalGrants([g], [{source_id: 'g1', status: 'success', started_at: daysAgo(3)}], pursuing, now);
    expect(r.status).toBe('GREEN');
    expect(r.details.join(' ')).toContain('Syn Grant 2099-06-20');
    expect(r.details.join(' ')).not.toContain('Far');
    expect(evalGrants([], [], [], now).status).toBe('SKIPPED');
  });

  it('rls: RED per violating relation, GREEN when none', () => {
    expect(evalRls([{relname: 'syn_table'}])).toMatchObject({status: 'RED', findings: ['RLS/view guard: syn_table']});
    expect(evalRls([]).status).toBe('GREEN');
  });

  it('checkGrantsAndRls calls rpc via POST and skips without env', async () => {
    expect((await checkGrantsAndRls(null)).rls.status).toBe('SKIPPED');
    const seen = [];
    const rest = supabaseRest({SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'placeholder'}, async (url, init) => {
      const p = String(url).split('/rest/v1/')[1].split('?')[0];
      seen.push(`${init.method ?? 'GET'} ${p}`);
      return Response.json(p === 'rpc/rls_guard_violations' ? [{relname: 'syn'}] : []);
    });
    const {grants, rls} = await checkGrantsAndRls(rest, now);
    expect(seen).toContain('POST rpc/rls_guard_violations');
    expect(rls.status).toBe('RED');
    expect(grants.status).toBe('SKIPPED');
  });

  it('main CI: GREEN on success, RED on failure, SKIPPED without token', async () => {
    const env = {GITHUB_TOKEN: 'placeholder', GITHUB_REPOSITORY: 'o/r'};
    const run = (conclusion) => async () => Response.json({workflow_runs: [{conclusion, head_sha: 'abcdef1234'}]});
    expect((await checkMainCi(env, run('success'))).status).toBe('GREEN');
    expect((await checkMainCi(env, run('failure'))).findings).toEqual(['main CI failure @ abcdef1']);
    expect((await checkMainCi({}, run('success'))).status).toBe('SKIPPED');
  });
});

describe('F-601 QA mutation kills (synthetic)', () => {
  const now = new Date('2099-06-15T09:00:00Z');
  const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
  const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});
  const run = async (o) => {
    let overall;
    await main({secretScan: ok, build: ok, deps: ok, harness: ok, data: async () => ({freshness: ok(), sanity: ok()}),
      mainCi: async () => ok(), deploys: async () => ok(), alerts: async () => ok(), grantsRls: async () => ({grants: ok(), rls: ok()}), log: () => {},
      emit: (res) => { overall = res.overall; return {path: 'x', exitCode: 0}; }, ...o});
    return overall;
  };

  it('grants key last used 30 days ago (but within the query window) is RED', () => {
    const g = {id: 'g1', name: 'grants-gov', last_success_at: daysAgo(30)};
    expect(evalGrants([g], [{source_id: 'g1', status: 'success', started_at: daysAgo(26)}], [], now)).toMatchObject({status: 'RED'});
  });

  it('past pursuing deadlines are excluded from the 14-day list', () => {
    const p = [{status: 'pursuing', opportunity: {title: 'Syn Past', close_date: '2099-06-10'}}];
    expect(evalGrants([], [], p, now).details).toContain('No pursuing deadlines in 14d');
  });

  it('RLS violation, failed main CI and RED grants each drive overall', async () => {
    const red = {status: 'RED', findings: ['syn'], details: []};
    expect(await run({grantsRls: async () => ({grants: ok(), rls: red})})).toBe('RED');
    expect(await run({mainCi: async () => red})).toBe('RED');
    expect(await run({grantsRls: async () => ({grants: red, rls: ok()})})).toBe('RED');
    expect(await run({})).toBe('GREEN');
  });

  it('main CI HTTP error is YELLOW "could not query"', async () => {
    const r = await checkMainCi({GITHUB_TOKEN: 'placeholder', GITHUB_REPOSITORY: 'o/r'}, async () => Response.json({workflow_runs: [{conclusion: 'success', head_sha: 'abcdef1'}]}, {status: 403}));
    expect(r).toMatchObject({status: 'YELLOW', findings: ['main CI: could not query (HTTP 403)']});
  });
});

describe('deploy health (synthetic)', () => {
  const env = {VERCEL_TOKEN: 'placeholder', VERCEL_PROJECT_ID: 'prj_syn', VERCEL_TEAM_ID: 'team_syn'};
  const states = (prod, prev) => async (url) => {
    const t = new URL(String(url)).searchParams.get('target');
    return Response.json({deployments: [{uid: `dpl_${t}`, readyState: t === 'production' ? prod : prev}]});
  };
  const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});

  it('GREEN when production and preview are READY; queries both targets with team id', async () => {
    const urls = [];
    const r = await checkDeploys(env, async (u, i) => { urls.push(String(u)); return states('READY', 'READY')(u, i); });
    expect(r).toMatchObject({status: 'GREEN', details: ['production deploy READY (dpl_production)', 'preview deploy READY (dpl_preview)']});
    expect(urls.every(u => u.includes('teamId=team_syn') && u.includes('projectId=prj_syn'))).toBe(true);
  });

  it('RED when either latest deploy is ERROR', async () => {
    expect((await checkDeploys(env, states('ERROR', 'READY'))).findings).toEqual(['production deploy ERROR (dpl_production)']);
    expect((await checkDeploys(env, states('READY', 'ERROR'))).status).toBe('RED');
  });

  it('YELLOW on HTTP error or no deployment; SKIPPED without token', async () => {
    expect(await checkDeploys(env, async () => new Response('', {status: 403}))).toMatchObject({status: 'YELLOW', findings: ['deploy health: could not query (HTTP 403)']});
    expect((await checkDeploys(env, async () => Response.json({deployments: []}))).status).toBe('YELLOW');
    expect((await checkDeploys({}, states('READY', 'READY'))).status).toBe('SKIPPED');
  });

  it('deploy ERROR drives overall', async () => {
    let overall;
    await main({secretScan: ok, build: ok, deps: ok, harness: ok, data: async () => ({freshness: ok(), sanity: ok()}),
      mainCi: async () => ok(), grantsRls: async () => ({grants: ok(), rls: ok()}), log: () => {},
      deploys: async () => ({status: 'RED', findings: ['syn'], details: []}),
      emit: (res) => { overall = res.overall; return {path: 'x', exitCode: 0}; }});
    expect(overall).toBe('RED');
  });
});

it('deploy health asks Vercel only for READY/ERROR so canceled deploys never come back', async () => {
  const urls = [];
  const env = {VERCEL_TOKEN: 'placeholder', VERCEL_PROJECT_ID: 'prj_syn'};
  await checkDeploys(env, async (u) => { urls.push(new URL(String(u))); return Response.json({deployments: [{uid: 'dpl_r', readyState: 'READY'}]}); });
  expect(urls.map(u => u.searchParams.get('state'))).toEqual(['READY,ERROR', 'READY,ERROR']);
});

it('deploy health: empty production list is "none found" (not a query failure) while preview is READY', async () => {
  const env = {VERCEL_TOKEN: 'placeholder', VERCEL_PROJECT_ID: 'prj_syn'};
  const r = await checkDeploys(env, async (u) => Response.json({deployments: new URL(String(u)).searchParams.get('target') === 'production' ? [] : [{uid: 'dpl_p', readyState: 'READY'}]}));
  const all = [...r.findings, ...r.details].join('\n');
  expect(r.status).toBe('YELLOW');
  expect(all).toContain('production deploy: none found');
  expect(all).toContain('preview deploy READY');
  expect(all).not.toContain('could not query');
});

describe('ingest alerts (F-201, synthetic)', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const env = {INGEST_ALERT_WEBHOOK_URL: 'https://n8n.example.test/webhook/x', GITHUB_TOKEN: 'placeholder', GITHUB_REPOSITORY: 'syn/repo'};
  const issue = (n, body, extra = {}) => ({number: n, state: 'open', created_at: '2026-10-13T06:00:00Z', body, ...extra});
  const fake = (probe, issues = []) => async (u) => String(u).includes('api.github.com') ? Response.json(issues) : probe();

  it('classifyProbe: plain n8n 401/403 healthy; cf challenge and other codes challenged', () => {
    expect(classifyProbe(403, {}, 'Authorization data is wrong!').ok).toBe(true);
    expect(classifyProbe(401, {}, '').ok).toBe(true);
    expect(classifyProbe(403, {'cf-mitigated': 'challenge'}, '')).toMatchObject({ok: false, why: 'Cloudflare challenge (cf-mitigated)'});
    expect(classifyProbe(403, new Headers(), '<title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/x">')).toMatchObject({ok: false, why: 'Cloudflare challenge page'});
    expect(classifyProbe(200, {}, '')).toMatchObject({ok: false, why: 'unauthenticated probe got HTTP 200'});
    expect(classifyProbe(200, new Headers({'cf-mitigated': 'challenge'}), '').ok).toBe(false);
  });

  it('unmatchedAlertIssues: open or last-24h issues lacking the n8n marker; skips PRs and old closed', () => {
    const bad = unmatchedAlertIssues([
      issue(1, `Source: syn\n${N8N_MARKER}`),
      issue(2, 'Source: syn\nDelivered-by: app-fallback'),
      issue(3, 'Source: syn', {state: 'closed', created_at: '2026-10-12T13:00:00Z'}),
      issue(4, 'Source: syn', {state: 'closed', created_at: '2026-10-10T00:00:00Z'}),
      issue(5, null, {pull_request: {}}),
      issue(6, null),
    ], now);
    expect(bad.map(i => i.number)).toEqual([2, 3, 6]);
  });

  it('GREEN when probe is rejected by n8n and every issue carries the marker', async () => {
    const r = await checkIngestAlerts(env, fake(() => new Response('Authorization data is wrong!', {status: 403}), [issue(9, N8N_MARKER)]), now);
    expect(r).toMatchObject({status: 'GREEN', findings: []});
    expect(r.details).toContain('webhook rejects unauthenticated probe (HTTP 403)');
  });

  it('probe sends no secret header and a synthetic body', async () => {
    let init;
    await checkIngestAlerts({INGEST_ALERT_WEBHOOK_URL: env.INGEST_ALERT_WEBHOOK_URL}, async (u, i) => { init = i; return new Response('', {status: 401}); }, now);
    expect(Object.keys(init.headers).map(k => k.toLowerCase())).not.toContain('x-fas-alert-secret');
    expect(JSON.parse(init.body).source).toBe('nightly-audit-probe');
  });

  it('YELLOW when challenged, open, or unreachable', async () => {
    const cf = await checkIngestAlerts(env, fake(() => new Response('', {status: 403, headers: {'cf-mitigated': 'challenge'}})), now);
    expect(cf).toMatchObject({status: 'YELLOW', findings: ['webhook challenged: Cloudflare challenge (cf-mitigated)']});
    expect((await checkIngestAlerts(env, fake(() => new Response("ok", {status: 200})), now)).status).toBe('YELLOW');
    const down = await checkIngestAlerts(env, fake(() => { throw new Error('ECONNREFUSED'); }), now);
    expect(down.findings).toEqual(['webhook challenged: probe failed (ECONNREFUSED)']);
  });

  it('YELLOW on fallback-only issues or GitHub query failure; SKIPPED without URL', async () => {
    const r = await checkIngestAlerts(env, fake(() => new Response('', {status: 403}), [issue(7, 'Delivered-by: app-fallback')]), now);
    expect(r).toMatchObject({status: 'YELLOW', findings: ['ingest-alert issue(s) without n8n delivery: #7']});
    const q = await checkIngestAlerts(env, async (u) => new Response('', {status: String(u).includes('api.github') ? 500 : 403}), now);
    expect(q.findings).toEqual(['ingest-alert issues: could not query (HTTP 500)']);
    expect((await checkIngestAlerts({}, fake(() => new Response('', {status: 200})), now)).status).toBe('SKIPPED');
  });

  it('queries ingest-alert label for the last 24h and folds into overall', async () => {
    const urls = [];
    await checkIngestAlerts(env, async (u) => { urls.push(String(u)); return u.includes('api.github') ? Response.json([]) : new Response('', {status: 403}); }, now);
    expect(urls[1]).toContain('labels=ingest-alert');
    expect(urls[1]).toContain('since=2026-10-12T12:00:00.000Z');
    const ok = () => ({status: 'GREEN', findings: [], details: [], ignored: [], stale: []});
    let overall;
    await main({secretScan: ok, build: ok, deps: ok, harness: ok, data: async () => ({freshness: ok(), sanity: ok()}), mainCi: async () => ok(),
      deploys: async () => ok(), grantsRls: async () => ({grants: ok(), rls: ok()}), log: () => {},
      alerts: async () => ({status: 'YELLOW', findings: ['syn'], details: []}),
      emit: (res) => { overall = res.overall; return {path: 'x', exitCode: 0}; }});
    expect(overall).toBe('YELLOW');
  });
});
