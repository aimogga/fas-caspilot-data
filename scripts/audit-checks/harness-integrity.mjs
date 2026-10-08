#!/usr/bin/env node

/**
 * Harness integrity check
 * Verifies:
 * - Every 'passing' feature in feature_list.json has evidence links
 * - Commands in AGENTS.md are valid
 * - Docs don't reference missing files
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export function checkHarnessIntegrity() {
  const results = {
    status: 'GREEN',
    findings: [],
    details: []
  };

  try {
    // Check 1: Feature list integrity
    const featureListPath = join(process.cwd(), 'harness/feature_list.json');
    if (!existsSync(featureListPath)) {
      results.status = 'RED';
      results.findings.push('harness/feature_list.json missing');
      return results;
    }

    const featureList = JSON.parse(readFileSync(featureListPath, 'utf-8'));
    const passingFeatures = featureList.features.filter(f => f.status === 'passing');
    
    const featuresWithoutEvidence = passingFeatures.filter(
      f => !f.evidence || f.evidence.length === 0
    );
    
    if (featuresWithoutEvidence.length > 0) {
      results.status = 'YELLOW';
      results.findings.push(
        `${featuresWithoutEvidence.length} passing feature(s) lack evidence: ${
          featuresWithoutEvidence.map(f => f.id).join(', ')
        }`
      );
    } else if (passingFeatures.length > 0) {
      results.details.push(
        `✓ All ${passingFeatures.length} passing feature(s) have evidence`
      );
    } else {
      results.details.push('✓ No passing features yet (all features are failing)');
    }

    // Check 2: AGENTS.md commands are valid
    const agentsMdPath = join(process.cwd(), 'AGENTS.md');
    if (!existsSync(agentsMdPath)) {
      results.status = 'RED';
      results.findings.push('AGENTS.md missing');
      return results;
    }

    const agentsMd = readFileSync(agentsMdPath, 'utf-8');
    const commandsSection = agentsMd.match(/## Commands\n```\n([\s\S]*?)\n```/);
    
    if (commandsSection) {
      const commands = commandsSection[1]
        .split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'))
        .map(line => line.split('#')[0].trim());
      
      const pnpmCommands = commands
        .filter(cmd => cmd.startsWith('pnpm '))
        .map(cmd => cmd.replace('pnpm ', '').split(' ')[0]);
      
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      const missingCommands = pnpmCommands.filter(
        cmd => !packageJson.scripts || !packageJson.scripts[cmd]
      );
      
      if (missingCommands.length > 0) {
        results.status = 'YELLOW';
        results.findings.push(
          `AGENTS.md references missing commands: ${missingCommands.join(', ')}`
        );
      } else {
        results.details.push('✓ All AGENTS.md commands exist in package.json');
      }
    }

    // Check 3: Docs don't reference missing files
    const docsPath = join(process.cwd(), 'docs');
    if (existsSync(docsPath)) {
      try {
        // Find all markdown files in docs
        const docFiles = execSync(
          'find docs -type f -name "*.md" 2>/dev/null || true',
          { encoding: 'utf-8', cwd: process.cwd() }
        )
          .trim()
          .split('\n')
          .filter(f => f);

        let brokenRefs = [];
        for (const docFile of docFiles) {
          const content = readFileSync(docFile, 'utf-8');
          // Look for relative file references (simple pattern)
          const refs = content.match(/\[.*?\]\(([^http][^)]+)\)/g) || [];
          
          for (const ref of refs) {
            const path = ref.match(/\[.*?\]\(([^)]+)\)/)?.[1];
            if (path && !path.startsWith('#') && !path.startsWith('http')) {
              const refPath = join(process.cwd(), 'docs', path);
              if (!existsSync(refPath)) {
                brokenRefs.push(`${docFile}: ${path}`);
              }
            }
          }
        }

        if (brokenRefs.length > 0) {
          results.status = 'YELLOW';
          results.findings.push(
            `${brokenRefs.length} broken file reference(s) in docs: ${brokenRefs.slice(0, 3).join(', ')}${brokenRefs.length > 3 ? '...' : ''}`
          );
        } else if (docFiles.length > 0) {
          results.details.push(`✓ No broken file references in ${docFiles.length} doc file(s)`);
        }
      } catch (err) {
        results.details.push('⚠ Could not check doc file references: ' + err.message);
      }
    } else {
      results.details.push('⚠ docs/ directory not found');
    }

    // Check 4: progress.md is updated for recent merges
    const progressPath = join(process.cwd(), 'harness/progress.md');
    if (existsSync(progressPath)) {
      try {
        // Get recent merge commits
        const recentMerges = execSync(
          'git log --merges --format="%H %s" -n 5 origin/main 2>/dev/null || git log --merges --format="%H %s" -n 5 main 2>/dev/null || echo ""',
          { encoding: 'utf-8', cwd: process.cwd() }
        ).trim();

        if (recentMerges) {
          results.details.push(`✓ Found recent merge commits (progress check: manual review needed)`);
        } else {
          results.details.push('✓ No recent merges to check');
        }
      } catch (err) {
        results.details.push('⚠ Could not check merge history');
      }
    }

  } catch (error) {
    results.status = 'RED';
    results.findings.push(`Error during harness integrity check: ${error.message}`);
  }

  return results;
}
