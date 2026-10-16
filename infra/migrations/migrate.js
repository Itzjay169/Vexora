#!/usr/bin/env node

/**
 * Vexora Forward-Only Migration Runner
 *
 * Runs versioned SQL migrations in strict ascending order.
 * Records execution and SHA-256 checksums in schema_migrations.
 * Guarantees idempotency and detects any altered historical migrations.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;

export async function runMigrations(customPool = null) {
  const migrationsDir = path.resolve('infra/migrations');
  console.log(`📁 Scanning migrations in: ${migrationsDir}`);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️ No SQL migration files found.');
    return { applied: 0, total: 0 };
  }

  const pool = customPool || new Pool({
    connectionString: process.env.DATABASE_URL,
    min: 0,
    max: 5,
    connectionTimeoutMillis: 3000,
  });

  const client = await pool.connect();
  let appliedCount = 0;

  try {
    // 1. Ensure schema_migrations exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch applied migrations
    const { rows: applied } = await client.query(`SELECT version, checksum FROM schema_migrations`);
    const appliedMap = new Map(applied.map(r => [r.version, r.checksum]));

    // 3. Process each migration file in order
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (appliedMap.has(file)) {
        const recordedChecksum = appliedMap.get(file);
        if (recordedChecksum !== checksum) {
          throw new Error(
            `🚨 TAMPERING DETECTED: Migration ${file} has been altered! Recorded: ${recordedChecksum}, Current: ${checksum}`
          );
        }
        console.log(`⏩ Migration ${file} already applied (checksum verified).`);
        continue;
      }

      console.log(`⚡ Applying migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ($1, $2, NOW())`,
          [file, checksum]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied ${file} successfully.`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Failed to apply migration ${file}: ${err.message}`);
      }
    }

    console.log(`🎉 Migrations complete. Total applied in this run: ${appliedCount}`);
    return { applied: appliedCount, total: files.length };
  } finally {
    client.release();
    if (!customPool) {
      await pool.end();
    }
  }
}

// Run directly if invoked from CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith('migrate.js') ||
  process.argv[1].includes('migrate.js')
);

if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    });
}
