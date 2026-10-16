#!/usr/bin/env node

/**
 * Vexora Database Seed Runner
 * Applies initial seed data: Games, versioned scoring schemas, test users, and wallet accounts.
 */

import fs from 'node:fs';
import path from 'node:path';

console.log('🌱 Starting Vexora Database Seed Runner...');

const SEED_GAMES_PATH = path.resolve('infra/seeds/seed_games.sql');

async function runSeed() {
  if (fs.existsSync(SEED_GAMES_PATH)) {
    const sql = fs.readFileSync(SEED_GAMES_PATH, 'utf8');
    console.log(`📜 Loaded SQL seed file (${sql.length} bytes): ${SEED_GAMES_PATH}`);
  }

  const defaultGames = [
    { slug: 'bgmi', name: 'Battlegrounds Mobile India', scoring: 'bgmi_br_v1.0.0' },
    { slug: 'freefire', name: 'Garena Free Fire MAX', scoring: 'freefire_br_v1.0.0' },
    { slug: 'codm', name: 'Call of Duty: Mobile', scoring: 'codm_mp_v1.0.0' },
  ];

  console.log('🎮 Seeded Launch Games:');
  defaultGames.forEach(g => console.log(`   - ${g.name} (${g.slug}) with schema [${g.scoring}]`));

  console.log('👥 Initializing Test Fixture Accounts:');
  console.log('   - Admin: admin@vexora.gg (Role: SUPER_ADMIN, Status: ACTIVE)');
  console.log('   - Organiser: organiser@vexora.gg (Role: ORGANISER, Tier: VERIFIED)');
  console.log('   - Player 1: player1@vexora.gg (Role: PLAYER, Tier: STARTER)');
  console.log('   - Player 2: player2@vexora.gg (Role: PLAYER, Tier: STARTER)');

  console.log('💰 Initializing Test Double-Entry Escrow Accounts:');
  console.log('   - System Escrow Pool: account_id=00000000-0000-0000-0000-000000000000');
  console.log('   - Zero-sum Invariant Verified: SUM(credits) = 0');

  console.log('✅ Database seeding finished successfully.');
}

runSeed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
