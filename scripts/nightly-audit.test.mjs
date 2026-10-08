/**
 * Unit tests for nightly audit
 */

import { describe, it, expect } from 'vitest';
import { worst, generateReport } from './nightly-audit.mjs';

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
