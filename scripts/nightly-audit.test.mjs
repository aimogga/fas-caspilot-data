/**
 * Unit tests for nightly audit
 */

import { describe, it, expect } from 'vitest';
import { worst, generateReport, matchSecretLine, checkProgressLog } from './nightly-audit.mjs';

describe('worst', () => {
  it('ranks RED > YELLOW > GREEN > SKIPPED', () => {
    expect(worst('GREEN', 'RED')).toBe('RED');
    expect(worst('GREEN', 'YELLOW')).toBe('YELLOW');
    expect(worst('SKIPPED', 'GREEN')).toBe('GREEN');
  });
});

describe('generateReport', () => {
  it('includes all NIGHTLY_AUDIT.md template lines', () => {
    const r = {date: '2026-10-08', overall: 'GREEN', checks: {}};
    const md = generateReport(r);
    expect(md).toContain('Overall:');
    expect(md).toContain('Critical:');
    expect(md).toContain('High:');
    expect(md).toContain('Medium:');
    expect(md).toContain('Data freshness:');
    expect(md).toContain('Spend:');
    expect(md).toContain('Doc-drift PR:');
  });

  it('maps privacy RED to Critical, others to High', () => {
    const r = {
      date: '2026-10-08',
      overall: 'RED',
      checks: {
        privacy: {status: 'RED', findings: ['Secret'], details: []},
        other: {status: 'RED', findings: ['Issue'], details: []}
      }
    };
    const md = generateReport(r);
    expect(md).toContain('Critical: [privacy] Secret');
    expect(md).toContain('High: [other] Issue');
  });
});

describe('matchSecretLine', () => {
  it('ignores env(...) placeholders', () => {
    expect(matchSecretLine('+ api_key = "env(API_KEY)"')).toBe(false);
  });

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
