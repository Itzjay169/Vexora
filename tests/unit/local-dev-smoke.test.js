import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('Local Dev Environment: Docker Compose defines all required services', () => {
  const composePath = path.join(ROOT, 'infra/docker/docker-compose.yml');
  assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist');

  const content = fs.readFileSync(composePath, 'utf8');
  assert.ok(content.includes('vexora-postgres'), 'PostgreSQL service container must be defined');
  assert.ok(content.includes('vexora-redis'), 'Redis service container must be defined');
  assert.ok(content.includes('vexora-minio'), 'MinIO S3 service container must be defined');
  assert.ok(content.includes('vexora-mailcatcher'), 'Mailcatcher service container must be defined');
});

test('Local Dev Environment: Database seeds and migrations exist', () => {
  const seedPath = path.join(ROOT, 'infra/seeds/seed.js');
  const sqlSeedPath = path.join(ROOT, 'infra/seeds/seed_games.sql');
  const migrationPath = path.join(ROOT, 'infra/migrations/001_initial_schema.sql');

  assert.ok(fs.existsSync(seedPath), 'infra/seeds/seed.js must exist');
  assert.ok(fs.existsSync(sqlSeedPath), 'infra/seeds/seed_games.sql must exist');
  assert.ok(fs.existsSync(migrationPath), 'infra/migrations/001_initial_schema.sql must exist');

  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  assert.ok(migrationContent.includes('CREATE TABLE'), 'Migration must contain table definitions');
  assert.ok(migrationContent.includes('ledger_transactions'), 'Migration must include ledger_transactions table');
  assert.ok(migrationContent.includes('audit_logs'), 'Migration must include audit_logs table');
});

test('Local Dev Environment: Firebase configuration files exist for DEV and PROD', () => {
  const firebasercPath = path.join(ROOT, '.firebaserc');
  const firebaseJsonPath = path.join(ROOT, 'firebase.json');

  assert.ok(fs.existsSync(firebasercPath), '.firebaserc must exist');
  assert.ok(fs.existsSync(firebaseJsonPath), 'firebase.json must exist');

  const rc = JSON.parse(fs.readFileSync(firebasercPath, 'utf8'));
  assert.equal(rc.projects.dev, 'vexora-esports-dev', 'Dev project must be vexora-esports-dev');
  assert.equal(rc.projects.prod, 'vexora-esports-prod', 'Prod project must be vexora-esports-prod');
});
