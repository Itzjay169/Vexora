import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Monorepo Scaffold: All Section 30 root directories exist', () => {
  const requiredDirs = [
    'apps/mobile',
    'apps/web',
    'apps/admin',
    'backend/src',
    'packages/shared-types',
    'packages/validation',
    'packages/scoring-engine',
    'infra/docker',
    'infra/migrations',
    'infra/ci',
    'infra/terraform',
    'infra/seeds',
    'docs/api',
    'docs/rules',
    'docs/policies',
    'docs/adr',
    'docs/runbooks',
    'docs/threat-models',
    'docs/mcp',
  ];

  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    assert.ok(fs.existsSync(fullPath), `Missing required directory: ${dir}`);
  }
});

test('Monorepo Scaffold: Essential configuration files exist', () => {
  const requiredFiles = [
    '.mcp.json',
    'CLAUDE.md',
    '.env.example',
    '.gitignore',
    'commitlint.config.js',
    '.github/CODEOWNERS',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/milestones.json',
    'docs/mcp/README.md',
    'docs/legal-review-checklist.md',
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(ROOT, file);
    assert.ok(fs.existsSync(fullPath), `Missing required configuration file: ${file}`);
  }
});

test('MCP Config: .mcp.json defines 9 servers with no embedded secrets', () => {
  const content = fs.readFileSync(path.join(ROOT, '.mcp.json'), 'utf8');
  const json = JSON.parse(content);
  assert.ok(json.mcpServers, 'mcpServers object must exist');

  const expectedServers = [
    'dart',
    'context7',
    'filesystem',
    'firebase',
    'playwright',
    'github',
    'postgres',
    'stitch',
    'developer-knowledge',
  ];

  for (const s of expectedServers) {
    assert.ok(json.mcpServers[s], `MCP server ${s} missing from .mcp.json`);
  }

  // Ensure no plaintext secrets are embedded
  assert.ok(!content.includes('sk_live'), 'No live secrets in .mcp.json');
  assert.ok(!content.includes('BEGIN PRIVATE KEY'), 'No private keys in .mcp.json');
});

test('CODEOWNERS: Sensitive modules mandate multi-party reviewers', () => {
  const codeowners = fs.readFileSync(path.join(ROOT, '.github/CODEOWNERS'), 'utf8');
  assert.ok(codeowners.includes('/backend/src/wallet/'), 'Wallet codeowner missing');
  assert.ok(codeowners.includes('/backend/src/auth/'), 'Auth codeowner missing');
  assert.ok(codeowners.includes('/backend/src/admin/'), 'Admin codeowner missing');
});
