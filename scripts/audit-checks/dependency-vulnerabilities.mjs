#!/usr/bin/env node

/**
 * Dependency vulnerability audit
 */

import { execSync } from 'child_process';

export function checkDependencyVulnerabilities() {
  const results = {
    status: 'GREEN',
    findings: [],
    details: []
  };

  try {
    // Run pnpm audit
    let auditOutput;
    try {
      auditOutput = execSync('pnpm audit --json', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      // pnpm audit exits with non-zero if vulnerabilities found
      auditOutput = err.stdout || '{}';
    }

    let auditData;
    try {
      auditData = JSON.parse(auditOutput);
    } catch (err) {
      results.details.push('⚠ Could not parse pnpm audit output');
      return results;
    }

    const metadata = auditData.metadata || {};
    const vulnerabilities = metadata.vulnerabilities || {};
    
    const critical = vulnerabilities.critical || 0;
    const high = vulnerabilities.high || 0;
    const moderate = vulnerabilities.moderate || 0;
    const low = vulnerabilities.low || 0;
    const info = vulnerabilities.info || 0;

    if (critical > 0 || high > 0) {
      results.status = 'RED';
      results.findings.push(
        `Found ${critical} critical and ${high} high severity vulnerabilities`
      );
    } else if (moderate > 0) {
      results.status = 'YELLOW';
      results.findings.push(`Found ${moderate} moderate severity vulnerabilities`);
    } else {
      results.details.push(
        `✓ No high/critical vulnerabilities (${low} low, ${info} info)`
      );
    }

  } catch (error) {
    results.status = 'YELLOW';
    results.findings.push(`Error during dependency audit: ${error.message}`);
  }

  return results;
}
