import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Security Baseline: No secrets or private keys in tracked files', () => {
  const sensitivePatterns = [
    /-----BEGIN PRIVATE KEY-----/,
    /-----BEGIN RSA PRIVATE KEY-----/,
    /sk_live_[0-9a-zA-Z]{24}/,
    /ghp_[0-9a-zA-Z]{36}/,
  ];

  const filesToCheck = [
    '.mcp.json',
    'package.json',
    'CLAUDE.md',
    '.env.example',
  ];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const pattern of sensitivePatterns) {
      assert.ok(!pattern.test(content), `Found sensitive secret pattern in ${f}`);
    }
  }
});

test('Security Baseline: Sensitive directory paths are git-ignored', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.ok(gitignore.includes('.env'), '.env files must be gitignored');
  assert.ok(gitignore.includes('*.pem'), 'PEM files must be gitignored');
  assert.ok(gitignore.includes('*.key'), 'KEY files must be gitignored');
});
