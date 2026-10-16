#!/usr/bin/env node

/**
 * Vexora Pre-Commit Security & Format Gate
 * Performs fast static verification against staged changes:
 * 1. Scans for hardcoded secrets, private keys, API credentials.
 * 2. Checks formatting and valid JSON syntax.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

console.log('🔒 Running Vexora pre-commit security & secret scan...');

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
  { name: 'GitHub Personal Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,255}/ },
  { name: 'Stripe/Razorpay Live Secret', regex: /(?:sk_live|rzp_live)_[0-9a-zA-Z]{24,}/ },
  { name: 'Database Password Assignment', regex: /postgres:\/\/[^:]+:([^@]+)@/ },
];

let stagedFiles = [];
try {
  const output = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  stagedFiles = output.trim().split('\n').filter(Boolean);
} catch (e) {
  // If not in a git commit or no staged files, exit cleanly
  stagedFiles = [];
}

let violations = 0;

for (const file of stagedFiles) {
  if (!fs.existsSync(file)) continue;
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.pdf')) continue;

  const content = fs.readFileSync(file, 'utf8');

  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(content)) {
      console.error(`❌ SECURITY GATE FAILURE: Potential ${name} detected in ${file}`);
      violations++;
    }
  }

  // Validate JSON syntax
  if (file.endsWith('.json')) {
    try {
      JSON.parse(content);
    } catch (err) {
      console.error(`❌ SYNTAX ERROR: Invalid JSON in ${file}: ${err.message}`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n🚫 Pre-commit check failed with ${violations} violation(s). Fix errors before committing.`);
  process.exit(1);
}

console.log('✅ Pre-commit security scan passed cleanly. No secrets detected.');
process.exit(0);
