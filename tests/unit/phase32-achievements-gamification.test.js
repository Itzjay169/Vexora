import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AchievementsService,
  CRITERIA_TYPES,
} from '../../backend/src/achievements/achievements.service.js';

import {
  AchievementRarity,
  AchievementCategory,
  MissionType,
  CosmeticType,
  SelfExclusionSettingsSchema,
  AchievementCreateSchema,
} from '../../packages/validation/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Phase 32: Achievements, Gamification & Retention', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. BADGE ENGINE — Server-Only
  // ═══════════════════════════════════════════════════════════════════════

  describe('Badge Engine (Server-Only Awards)', () => {

    it('service exports evaluateAndAward as server-only method', () => {
      assert.equal(typeof AchievementsService.evaluateAndAward, 'function');
      assert.equal(typeof AchievementsService.awardBadge, 'function');
      assert.equal(typeof AchievementsService.checkCriteria, 'function');
    });

    it('routes do NOT expose direct badge award endpoint to clients', () => {
      const routesPath = path.join(ROOT, 'backend/src/achievements/achievements.routes.js');
      const content = fs.readFileSync(routesPath, 'utf-8');
      // Only admin endpoint exists, which requires ACHIEVEMENTS_MANAGE permission
      assert.ok(content.includes("requirePermission('ACHIEVEMENTS_MANAGE')"));
      // No public POST /award endpoint
      assert.ok(!content.includes("'/award'"));
    });

    it('CRITERIA_TYPES contains all required criteria', () => {
      assert.ok(CRITERIA_TYPES.includes('tournaments_joined'));
      assert.ok(CRITERIA_TYPES.includes('matches_won'));
      assert.ok(CRITERIA_TYPES.includes('total_kills'));
      assert.ok(CRITERIA_TYPES.includes('fair_play_score_min'));
      assert.ok(CRITERIA_TYPES.includes('matches_no_disputes'));
      assert.ok(CRITERIA_TYPES.includes('login_streak'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. NO PAY-TO-WIN ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════

  describe('No Pay-to-Win Enforcement', () => {

    it('migration enforces is_pay_to_win = FALSE via CHECK constraint', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('chk_no_pay_to_win'));
      assert.ok(sql.includes('is_pay_to_win = FALSE'));
    });

    it('mission table enforces no spend-based missions', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('chk_no_spend_missions'));
      assert.ok(sql.includes('is_spend_based = FALSE'));
    });

    it('cosmetic titles enforce no purchasable items in v1', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('chk_no_purchasable_titles'));
      assert.ok(sql.includes('is_purchasable = FALSE'));
    });

    it('AchievementCreateSchema forces isPayToWin to literal false', () => {
      const result = AchievementCreateSchema.parse({
        slug: 'test_badge',
        title: 'Test Badge',
        description: 'A test badge for testing purposes',
        criteriaType: 'matches_won',
        criteriaValue: 5,
      });
      assert.equal(result.isPayToWin, false);

      // Cannot set to true
      assert.throws(() => AchievementCreateSchema.parse({
        slug: 'pay_badge',
        title: 'Pay Badge',
        description: 'A pay to win badge',
        criteriaType: 'money_spent',
        criteriaValue: 100,
        isPayToWin: true,
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. BADGE IMMUTABILITY
  // ═══════════════════════════════════════════════════════════════════════

  describe('Badge Immutability', () => {

    it('migration creates immutability trigger on user_achievements', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('prevent_achievement_revoke'));
      assert.ok(sql.includes('trg_immutable_user_achievement'));
      assert.ok(sql.includes('Badges cannot be revoked'));
    });

    it('season_snapshots are also immutable', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('trg_immutable_season_snapshot'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. MIGRATION 025
  // ═══════════════════════════════════════════════════════════════════════

  describe('Migration 025 Validation', () => {
    const migrationPath = path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql');

    it('migration file exists', () => {
      assert.ok(fs.existsSync(migrationPath));
    });

    it('creates all required tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      for (const table of ['achievements', 'user_achievements', 'missions',
        'user_mission_progress', 'streaks', 'user_streaks', 'season_snapshots',
        'user_titles', 'user_equipped_cosmetics', 'self_exclusion_settings']) {
        assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`), `Missing table: ${table}`);
      }
    });

    it('seeds core achievements (15 badges)', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("'first_tournament'"));
      assert.ok(sql.includes("'first_win'"));
      assert.ok(sql.includes("'hundred_wins'"));
      assert.ok(sql.includes("'fair_play_perfect'"));
      assert.ok(sql.includes("'streak_30'"));
    });

    it('seeds missions and streaks', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("'daily_play_1'"));
      assert.ok(sql.includes("'weekly_5_matches'"));
      assert.ok(sql.includes("'daily_login'"));
    });

    it('seeds cosmetic titles', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("'newcomer'"));
      assert.ok(sql.includes("'champion'"));
      assert.ok(sql.includes("'frame_gold'"));
    });

    it('enables RLS on user tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
    });

    it('badges show source tournament — source_tournament_id column', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('source_tournament_id'));
      assert.ok(sql.includes('source_match_id'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. SERVICE & ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Service & Routes Files', () => {

    it('service exports all required methods', () => {
      assert.equal(typeof AchievementsService.getUserAchievements, 'function');
      assert.equal(typeof AchievementsService.getAchievementCatalogue, 'function');
      assert.equal(typeof AchievementsService.getActiveMissions, 'function');
      assert.equal(typeof AchievementsService.getUserMissionProgress, 'function');
      assert.equal(typeof AchievementsService.incrementMissionProgress, 'function');
      assert.equal(typeof AchievementsService.getUserStreaks, 'function');
      assert.equal(typeof AchievementsService.recordStreakAction, 'function');
      assert.equal(typeof AchievementsService.getSeasonSnapshots, 'function');
      assert.equal(typeof AchievementsService.getSelfExclusionSettings, 'function');
      assert.equal(typeof AchievementsService.updateSelfExclusionSettings, 'function');
    });

    it('routes file has all Phase 32 endpoints', () => {
      const p = path.join(ROOT, 'backend/src/achievements/achievements.routes.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('/catalogue'));
      assert.ok(content.includes('/me'));
      assert.ok(content.includes('/missions'));
      assert.ok(content.includes('/streaks/me'));
      assert.ok(content.includes('/seasons/me'));
      assert.ok(content.includes('/self-exclusion'));
      assert.ok(content.includes('/admin/evaluate'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. VALIDATION SCHEMAS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Validation Schemas', () => {

    it('AchievementRarity has 5 levels', () => {
      for (const r of ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY']) {
        assert.equal(AchievementRarity.parse(r), r);
      }
    });

    it('AchievementCategory has 6 categories', () => {
      for (const c of ['PARTICIPATION', 'FAIR_PLAY', 'SKILL', 'COMMUNITY', 'MILESTONE', 'SEASONAL']) {
        assert.equal(AchievementCategory.parse(c), c);
      }
    });

    it('MissionType has 4 types', () => {
      for (const t of ['DAILY', 'WEEKLY', 'SEASONAL', 'PERMANENT']) {
        assert.equal(MissionType.parse(t), t);
      }
    });

    it('CosmeticType has 4 types', () => {
      for (const t of ['TITLE', 'PROFILE_FRAME', 'BADGE_BORDER', 'NAME_COLOR']) {
        assert.equal(CosmeticType.parse(t), t);
      }
    });

    it('SelfExclusionSettingsSchema validates play limits', () => {
      const result = SelfExclusionSettingsSchema.parse({
        dailyPlayLimitMinutes: 120,
        weeklyPlayLimitMinutes: 600,
      });
      assert.equal(result.dailyPlayLimitMinutes, 120);
    });

    it('SelfExclusionSettingsSchema rejects too-short daily limit', () => {
      assert.throws(() => SelfExclusionSettingsSchema.parse({
        dailyPlayLimitMinutes: 5, // min is 15
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. UI FILES
  // ═══════════════════════════════════════════════════════════════════════

  describe('UI Files Existence & Content', () => {

    it('admin achievements page exists with responsible design', () => {
      const p = path.join(ROOT, 'apps/admin/src/app/achievements/page.tsx');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('Achievement Catalogue'));
      assert.ok(content.includes('No Pay-to-Win'));
      assert.ok(content.includes('Server-Only Awards'));
      assert.ok(content.includes('Responsible Design'));
    });

    it('admin shell includes Achievements nav item', () => {
      const p = path.join(ROOT, 'apps/admin/src/components/AdminShell.tsx');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes("name: 'Achievements'"));
      assert.ok(content.includes("href: '/achievements'"));
    });

    it('Flutter achievements screen exists with badges and missions', () => {
      const p = path.join(ROOT, 'apps/mobile/lib/screens/achievements_screen.dart');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('AchievementsScreen'));
      assert.ok(content.includes('Badges'));
      assert.ok(content.includes('Missions'));
      assert.ok(content.includes('Streaks'));
      assert.ok(content.includes('source'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. RESPONSIBLE DESIGN
  // ═══════════════════════════════════════════════════════════════════════

  describe('Responsible Design Rules', () => {

    it('self-exclusion settings table exists in migration', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      assert.ok(sql.includes('self_exclusion_settings'));
      assert.ok(sql.includes('daily_play_limit_minutes'));
      assert.ok(sql.includes('self_excluded_until'));
      assert.ok(sql.includes('age_verified'));
      assert.ok(sql.includes('parental_consent'));
    });

    it('mission categories are participation and fair play focused', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/025_achievements_gamification.sql'), 'utf-8'
      );
      // Seeded missions must be PARTICIPATION, SKILL, or FAIR_PLAY — never SPEND
      assert.ok(sql.includes("'PARTICIPATION'"));
      assert.ok(sql.includes("'FAIR_PLAY'"));
      assert.ok(!sql.includes("'SPEND'"));
    });
  });
});
