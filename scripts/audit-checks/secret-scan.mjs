#!/usr/bin/env node

/**
 * Secret scan check
 * Scans recent commits for potential secrets
 */

import { execSync } from 'child_process';

export function checkSecretScan() {
  const results = {
    status: 'GREEN',
    findings: [],
    details: []
  };

  try {
    // Get commits from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    let recentCommits;
    try {
      recentCommits = execSync(
        `git log --since="${yesterday}" --format="%H" origin/main 2>/dev/null || git log --since="${yesterday}" --format="%H" main 2>/dev/null || echo ""`,
        { encoding: 'utf-8', cwd: process.cwd() }
      ).trim();
    } catch (err) {
      results.details.push('⚠ Could not fetch recent commits');
      return results;
    }

    if (!recentCommits) {
      results.details.push('✓ No commits in last 24h to scan');
      return results;
    }

    const commitList = recentCommits.split('\n').filter(c => c);
    results.details.push(`Scanning ${commitList.length} commit(s) from last 24h`);

    // Simple secret patterns (basic heuristics)
    const secretPatterns = [
      { name: 'API Key', pattern: /[a-zA-Z0-9_-]{32,}/ },
      { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/ },
      { name: 'Private Key', pattern: /-----BEGIN (RSA |DSA |EC )?PRIVATE KEY-----/ },
      { name: 'Generic Secret', pattern: /(password|secret|token|key)\s*[:=]\s*['"][^'"]{8,}['"]/i },
      { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9\-._~+\/]+/i },
    ];

    let foundSecrets = [];
    
    for (const commit of commitList) {
      try {
        const diff = execSync(
          `git show ${commit} --format="" --no-color`,
          { encoding: 'utf-8', cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 }
        );

        // Skip lockfiles and generated files
        if (diff.includes('pnpm-lock.yaml') || diff.includes('package-lock.json')) {
          continue;
        }

        const addedLines = diff.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
        
        for (const line of addedLines) {
          // Skip lines that look like test fixtures or examples
          if (line.includes('example.com') || 
              line.includes('EXAMPLE') || 
              line.includes('YOUR_') ||
              line.includes('test_') ||
              line.includes('dummy_')) {
            continue;
          }

          for (const { name, pattern } of secretPatterns) {
            if (pattern.test(line)) {
              foundSecrets.push({
                commit: commit.substring(0, 7),
                type: name,
                preview: line.substring(0, 80)
              });
            }
          }
        }
      } catch (err) {
        // Skip commits we can't read
        continue;
      }
    }

    if (foundSecrets.length > 0) {
      results.status = 'RED';
      results.findings.push(
        `Potential secret(s) found in ${foundSecrets.length} location(s): ` +
        foundSecrets.slice(0, 2).map(s => `${s.commit} (${s.type})`).join(', ')
      );
    } else {
      results.details.push('✓ No obvious secrets in recent commits');
    }

  } catch (error) {
    results.status = 'YELLOW';
    results.findings.push(`Error during secret scan: ${error.message}`);
  }

  return results;
}
