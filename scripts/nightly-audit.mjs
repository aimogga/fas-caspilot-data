#!/usr/bin/env node

/**
 * Nightly Audit Script
 * 
 * Runs the checks from harness/NIGHTLY_AUDIT.md that can work today
 * without secrets, and produces a dated report.
 * 
 * This is TP-0003, a first slice toward F-601 (Phase 6 full audit script).
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { checkHarnessIntegrity } from './audit-checks/harness-integrity.mjs';
import { checkSecretScan } from './audit-checks/secret-scan.mjs';
import { checkDependencyVulnerabilities } from './audit-checks/dependency-vulnerabilities.mjs';
import { checkBuildHealth } from './audit-checks/build-health.mjs';

const AUDIT_DATE = new Date().toISOString().split('T')[0];

async function runAudit() {
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Nightly Audit — ${AUDIT_DATE}`);
  console.log(`═══════════════════════════════════════════\n`);

  const results = {
    date: AUDIT_DATE,
    overall: 'GREEN',
    checks: {}
  };

  // Check 1: Data freshness (not yet implemented - needs database)
  console.log('🔍 Check 1: Data freshness');
  results.checks.dataFreshness = {
    status: 'SKIPPED',
    reason: 'Not yet implemented: needs database access and ingest infrastructure',
    findings: [],
    details: []
  };
  console.log('   ⊗ Skipped: needs database access\n');

  // Check 2: Data sanity (not yet implemented - needs database)
  console.log('🔍 Check 2: Data sanity');
  results.checks.dataSanity = {
    status: 'SKIPPED',
    reason: 'Not yet implemented: needs database schema and historical data',
    findings: [],
    details: []
  };
  console.log('   ⊗ Skipped: needs database schema\n');

  // Check 3: Grants (not yet implemented - needs Grants.gov integration)
  console.log('🔍 Check 3: Grants');
  results.checks.grants = {
    status: 'SKIPPED',
    reason: 'Not yet implemented: needs GRANTS_GOV_API_KEY',
    findings: [],
    details: []
  };
  console.log('   ⊗ Skipped: needs GRANTS_GOV_API_KEY\n');

  // Check 4: Privacy (partial - secret scan only for now)
  console.log('🔍 Check 4: Privacy');
  const secretScanResult = checkSecretScan();
  results.checks.privacy = {
    status: secretScanResult.status,
    implemented: ['Secret scan of last 24h commits'],
    notYetImplemented: [
      'Suppression test suite (needs database schema)',
      'RLS enabled check (needs SUPABASE_ACCESS_TOKEN)',
      'Board/export view checks (needs application code)'
    ],
    findings: secretScanResult.findings,
    details: secretScanResult.details
  };
  
  console.log(`   ${getStatusIcon(secretScanResult.status)} Secret scan: ${secretScanResult.status}`);
  for (const detail of secretScanResult.details) {
    console.log(`     ${detail}`);
  }
  for (const finding of secretScanResult.findings) {
    console.log(`     ⚠ ${finding}`);
  }
  console.log('   ⊗ Suppression tests: needs database schema');
  console.log('   ⊗ RLS check: needs SUPABASE_ACCESS_TOKEN');
  console.log('   ⊗ Board/export views: needs application code\n');

  if (secretScanResult.status !== 'GREEN') {
    results.overall = worstStatus(results.overall, secretScanResult.status);
  }

  // Check 5: Build health
  console.log('🔍 Check 5: Build health');
  const buildHealthResult = checkBuildHealth();
  const depVulnResult = checkDependencyVulnerabilities();
  
  results.checks.buildHealth = {
    status: worstStatus(buildHealthResult.status, depVulnResult.status),
    implemented: ['Lint', 'Typecheck', 'Test', 'Dependency vulnerabilities'],
    notYetImplemented: [
      'Preview deploy health (needs VERCEL_TOKEN)',
      'Production deploy health (needs VERCEL_TOKEN)'
    ],
    findings: [...buildHealthResult.findings, ...depVulnResult.findings],
    details: [...buildHealthResult.details, ...depVulnResult.details]
  };

  console.log(`   ${getStatusIcon(buildHealthResult.status)} Build checks: ${buildHealthResult.status}`);
  for (const detail of buildHealthResult.details) {
    console.log(`     ${detail}`);
  }
  for (const finding of buildHealthResult.findings) {
    console.log(`     ⚠ ${finding}`);
  }
  
  console.log(`   ${getStatusIcon(depVulnResult.status)} Dependencies: ${depVulnResult.status}`);
  for (const detail of depVulnResult.details) {
    console.log(`     ${detail}`);
  }
  for (const finding of depVulnResult.findings) {
    console.log(`     ⚠ ${finding}`);
  }
  
  console.log('   ⊗ Deploy health: needs VERCEL_TOKEN\n');

  if (buildHealthResult.status !== 'GREEN' || depVulnResult.status !== 'GREEN') {
    results.overall = worstStatus(results.overall, worstStatus(buildHealthResult.status, depVulnResult.status));
  }

  // Check 6: Harness integrity
  console.log('🔍 Check 6: Harness integrity');
  const harnessResult = checkHarnessIntegrity();
  results.checks.harnessIntegrity = {
    status: harnessResult.status,
    implemented: [
      'Feature evidence validation',
      'AGENTS.md command validation',
      'Doc file reference checks',
      'Progress log checks'
    ],
    notYetImplemented: [],
    findings: harnessResult.findings,
    details: harnessResult.details
  };

  console.log(`   ${getStatusIcon(harnessResult.status)} Harness checks: ${harnessResult.status}`);
  for (const detail of harnessResult.details) {
    console.log(`     ${detail}`);
  }
  for (const finding of harnessResult.findings) {
    console.log(`     ⚠ ${finding}`);
  }
  console.log('');

  if (harnessResult.status !== 'GREEN') {
    results.overall = worstStatus(results.overall, harnessResult.status);
  }

  // Check 7: Cost (not yet implemented - needs cloud billing APIs)
  console.log('🔍 Check 7: Cost tracking');
  results.checks.cost = {
    status: 'SKIPPED',
    reason: 'Not yet implemented: needs cloud billing API access',
    findings: [],
    details: []
  };
  console.log('   ⊗ Skipped: needs cloud billing API access\n');

  // Generate report
  const reportPath = join(process.cwd(), 'harness', 'audits', `${AUDIT_DATE}.md`);
  mkdirSync(join(process.cwd(), 'harness', 'audits'), { recursive: true });
  
  const report = generateReport(results);
  writeFileSync(reportPath, report, 'utf-8');

  console.log(`═══════════════════════════════════════════`);
  console.log(`  Overall Status: ${results.overall}`);
  console.log(`═══════════════════════════════════════════\n`);
  console.log(`Report written to: ${reportPath}\n`);

  // Exit with appropriate code
  if (results.overall === 'RED') {
    process.exit(1);
  } else if (results.overall === 'YELLOW') {
    process.exit(0); // Don't fail CI on warnings
  }
  process.exit(0);
}

function getStatusIcon(status) {
  switch (status) {
    case 'GREEN': return '✓';
    case 'YELLOW': return '⚠';
    case 'RED': return '✗';
    case 'SKIPPED': return '⊗';
    default: return '?';
  }
}

function worstStatus(a, b) {
  const priority = { 'RED': 3, 'YELLOW': 2, 'GREEN': 1, 'SKIPPED': 0 };
  return priority[a] > priority[b] ? a : b;
}

function generateReport(results) {
  let report = `# Nightly Audit — ${results.date}\n\n`;
  report += `**Overall Status:** ${results.overall}\n\n`;

  // Summary of findings by severity
  const critical = [];
  const high = [];
  const medium = [];

  for (const [checkName, check] of Object.entries(results.checks)) {
    if (check.status === 'RED') {
      high.push(...check.findings.map(f => `[${checkName}] ${f}`));
    } else if (check.status === 'YELLOW') {
      medium.push(...check.findings.map(f => `[${checkName}] ${f}`));
    }
  }

  report += `**Critical:** ${critical.length > 0 ? critical.join('; ') : 'none'}\n`;
  report += `**High:** ${high.length > 0 ? high.join('; ') : 'none'}\n`;
  report += `**Medium:** ${medium.length > 0 ? medium.join('; ') : 'none'}\n\n`;

  // Detailed results
  report += `## Check Results\n\n`;

  for (const [checkName, check] of Object.entries(results.checks)) {
    report += `### ${checkName}\n`;
    report += `**Status:** ${check.status}\n\n`;

    if (check.reason) {
      report += `**Reason:** ${check.reason}\n\n`;
    }

    if (check.implemented && check.implemented.length > 0) {
      report += `**Implemented:**\n`;
      for (const item of check.implemented) {
        report += `- ${item}\n`;
      }
      report += `\n`;
    }

    if (check.notYetImplemented && check.notYetImplemented.length > 0) {
      report += `**Not Yet Implemented:**\n`;
      for (const item of check.notYetImplemented) {
        report += `- ${item}\n`;
      }
      report += `\n`;
    }

    if (check.findings && check.findings.length > 0) {
      report += `**Findings:**\n`;
      for (const finding of check.findings) {
        report += `- ${finding}\n`;
      }
      report += `\n`;
    }

    if (check.details && check.details.length > 0) {
      report += `**Details:**\n`;
      for (const detail of check.details) {
        report += `- ${detail}\n`;
      }
      report += `\n`;
    }
  }

  report += `---\n`;
  report += `Generated by TP-0003 nightly audit workflow\n`;
  report += `This is a first slice toward F-601 (Phase 6 full audit script)\n`;

  return report;
}

// Run the audit
runAudit().catch(err => {
  console.error('Fatal error during audit:', err);
  process.exit(1);
});
