/**
 * Unit tests for nightly audit
 */

import { describe, it, expect } from 'vitest';
import { worst, generateReport } from './nightly-audit.mjs';

describe('worst status', () => {
  it('ranks RED highest', () => {
    expect(worst('GREEN', 'RED')).toBe('RED');
    expect(worst('RED', 'YELLOW')).toBe('RED');
  });

  it('ranks YELLOW over GREEN', () => {
    expect(worst('GREEN', 'YELLOW')).toBe('YELLOW');
  });

  it('handles SKIPPED as lowest', () => {
    expect(worst('SKIPPED', 'GREEN')).toBe('GREEN');
  });
});

describe('generateReport', () => {
  it('generates markdown with overall status', () => {
    const r = {
      date: '2026-10-08',
      overall: 'GREEN',
      checks: {test: {status: 'GREEN', findings: [], details: ['OK']}}
    };
    const md = generateReport(r);
    expect(md).toContain('# Nightly Audit — 2026-10-08');
    expect(md).toContain('**Overall:** GREEN');
  });

  it('categorizes findings by severity', () => {
    const r = {
      date: '2026-10-08',
      overall: 'RED',
      checks: {
        a: {status: 'RED', findings: ['High'], details: []},
        b: {status: 'YELLOW', findings: ['Med'], details: []}
      }
    };
    const md = generateReport(r);
    expect(md).toContain('**High:** [a] High');
    expect(md).toContain('**Medium:** [b] Med');
  });
});
