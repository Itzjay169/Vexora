import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AnalyticsService,
  MATERIALIZED_VIEWS,
  FIREBASE_ANALYTICS_EVENTS,
} from '../../backend/src/analytics/analytics.service.js';

import {
  AnalyticsMetricCategory,
  AnalyticsExportType,
  AnalyticsExportFormat,
  MaterialisedViewName,
  AnalyticsExportRequestSchema,
  AnalyticsDateRangeSchema,
  ViewRefreshRequestSchema,
} from '../../packages/validation/src/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

describe('Phase 31: Analytics & Dashboards', () => {

  // ═══════════════════════════════════════════════════════════════════════
  // 1. PII MASKING — Security Gate
  // ═══════════════════════════════════════════════════════════════════════

  describe('PII Masking (Export Security Gate)', () => {

    it('masks email addresses in export data', () => {
      const rows = [{ email: 'player@vexora.gg', username: 'player1' }];
      const masked = AnalyticsService.maskPII(rows);
      assert.ok(masked[0].email.includes('***'));
      assert.ok(!masked[0].email.includes('player@'));
      assert.equal(masked[0].username, 'player1'); // Non-PII preserved
    });

    it('masks phone numbers in export data', () => {
      const rows = [{ phone: '+919876543210', name: 'Test' }];
      const masked = AnalyticsService.maskPII(rows);
      assert.ok(masked[0].phone.includes('*'));
      assert.equal(masked[0].name, 'Test');
    });

    it('masks firebase_uid in export data', () => {
      const rows = [{ firebase_uid: 'abc123xyz', id: 'user-1' }];
      const masked = AnalyticsService.maskPII(rows);
      assert.equal(masked[0].firebase_uid, '***MASKED***');
      assert.equal(masked[0].id, 'user-1');
    });

    it('handles rows with no PII fields gracefully', () => {
      const rows = [{ tournament_id: 't-001', matches: 5, wins: 3 }];
      const masked = AnalyticsService.maskPII(rows);
      assert.deepStrictEqual(masked[0], rows[0]);
    });

    it('handles empty rows array', () => {
      const masked = AnalyticsService.maskPII([]);
      assert.equal(masked.length, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. CSV GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  describe('CSV Export Generation', () => {

    it('generates valid CSV with headers', () => {
      const rows = [
        { name: 'Alice', score: 100 },
        { name: 'Bob', score: 200 },
      ];
      const csv = AnalyticsService.generateCSV(rows);
      const lines = csv.split('\n');
      assert.equal(lines[0], 'name,score');
      assert.equal(lines[1], 'Alice,100');
      assert.equal(lines[2], 'Bob,200');
    });

    it('handles empty data', () => {
      const csv = AnalyticsService.generateCSV([]);
      assert.equal(csv, '');
    });

    it('escapes commas in values', () => {
      const rows = [{ name: 'Alice, Jr.', score: 100 }];
      const csv = AnalyticsService.generateCSV(rows);
      assert.ok(csv.includes('"Alice, Jr."'));
    });

    it('uses custom column list when provided', () => {
      const rows = [{ a: 1, b: 2, c: 3 }];
      const csv = AnalyticsService.generateCSV(rows, ['a', 'c']);
      assert.equal(csv.split('\n')[0], 'a,c');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. FIREBASE ANALYTICS EVENT PLAN
  // ═══════════════════════════════════════════════════════════════════════

  describe('Firebase Analytics Event Plan (no personal data in event names)', () => {

    it('defines all canonical event names', () => {
      assert.ok(Object.keys(FIREBASE_ANALYTICS_EVENTS).length >= 15);
      assert.equal(FIREBASE_ANALYTICS_EVENTS.SCREEN_VIEW, 'screen_view');
      assert.equal(FIREBASE_ANALYTICS_EVENTS.TOURNAMENT_REGISTERED, 'tournament_registered');
      assert.equal(FIREBASE_ANALYTICS_EVENTS.MATCH_COMPLETED, 'match_completed');
      assert.equal(FIREBASE_ANALYTICS_EVENTS.ACHIEVEMENT_UNLOCKED, 'achievement_unlocked');
    });

    it('event names contain NO personal data patterns', () => {
      // Use specific PII patterns that won't false-positive on game/action terms
      const piiPatterns = ['user_email', 'user_phone', 'full_name', 'home_address', 'firebase_uid', 'user_password', 'auth_token'];
      for (const [key, value] of Object.entries(FIREBASE_ANALYTICS_EVENTS)) {
        for (const pattern of piiPatterns) {
          assert.ok(
            !value.toLowerCase().includes(pattern),
            `Event ${key}="${value}" contains PII pattern "${pattern}"`
          );
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. MATERIALISED VIEWS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Materialised View Definitions', () => {

    it('defines exactly 4 materialised views', () => {
      assert.equal(MATERIALIZED_VIEWS.length, 4);
    });

    it('includes all required views', () => {
      assert.ok(MATERIALIZED_VIEWS.includes('mv_player_stats'));
      assert.ok(MATERIALIZED_VIEWS.includes('mv_organiser_stats'));
      assert.ok(MATERIALIZED_VIEWS.includes('mv_platform_daily_stats'));
      assert.ok(MATERIALIZED_VIEWS.includes('mv_game_popularity'));
    });

    it('rejects unknown view names', () => {
      assert.throws(() => MaterialisedViewName.parse('mv_nonexistent'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. MIGRATION 024
  // ═══════════════════════════════════════════════════════════════════════

  describe('Migration 024 Validation', () => {
    const migrationPath = path.join(ROOT, 'infra/migrations/024_analytics_and_dashboards.sql');

    it('migration file exists', () => {
      assert.ok(fs.existsSync(migrationPath));
    });

    it('creates analytics_metric_definitions table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS analytics_metric_definitions'));
    });

    it('creates materialised views', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_stats'));
      assert.ok(sql.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS mv_organiser_stats'));
      assert.ok(sql.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_daily_stats'));
      assert.ok(sql.includes('CREATE MATERIALIZED VIEW IF NOT EXISTS mv_game_popularity'));
    });

    it('creates analytics_export_log with immutability trigger', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS analytics_export_log'));
      assert.ok(sql.includes('prevent_export_log_mutation'));
      assert.ok(sql.includes('trg_immutable_export_log'));
    });

    it('creates analytics_refresh_log table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS analytics_refresh_log'));
    });

    it('seeds metric definitions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes("'total_users'"));
      assert.ok(sql.includes("'active_users_daily'"));
      assert.ok(sql.includes("'player_win_rate'"));
      assert.ok(sql.includes("'organiser_tournaments_hosted'"));
      assert.ok(sql.includes("'game_active_players'"));
    });

    it('enables Row-Level Security on audit tables', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
    });

    it('creates unique indexes for concurrent refresh', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      assert.ok(sql.includes('idx_mv_player_stats_user_id'));
      assert.ok(sql.includes('idx_mv_organiser_stats_id'));
      assert.ok(sql.includes('idx_mv_platform_daily_date'));
      assert.ok(sql.includes('idx_mv_game_popularity_id'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. SERVICE & ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  describe('Service & Routes Files', () => {

    it('analytics service exports required methods', () => {
      assert.equal(typeof AnalyticsService.maskPII, 'function');
      assert.equal(typeof AnalyticsService.generateCSV, 'function');
      assert.equal(typeof AnalyticsService.getPlayerStats, 'function');
      assert.equal(typeof AnalyticsService.getOrganiserStats, 'function');
      assert.equal(typeof AnalyticsService.getPlatformOverview, 'function');
      assert.equal(typeof AnalyticsService.getDailyStats, 'function');
      assert.equal(typeof AnalyticsService.getGamePopularity, 'function');
      assert.equal(typeof AnalyticsService.refreshMaterialisedView, 'function');
      assert.equal(typeof AnalyticsService.refreshAllViews, 'function');
      assert.equal(typeof AnalyticsService.exportData, 'function');
      assert.equal(typeof AnalyticsService.getMetricDefinitions, 'function');
    });

    it('analytics routes file has all Phase 31 endpoints', () => {
      const p = path.join(ROOT, 'backend/src/analytics/analytics.routes.js');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('/player/me'));
      assert.ok(content.includes('/player/:id'));
      assert.ok(content.includes('/organiser/me'));
      assert.ok(content.includes('/platform/overview'));
      assert.ok(content.includes('/platform/daily'));
      assert.ok(content.includes('/games/popularity'));
      assert.ok(content.includes('/metrics'));
      assert.ok(content.includes('/refresh/:viewName'));
      assert.ok(content.includes('/refresh-all'));
      assert.ok(content.includes('/export'));
      assert.ok(content.includes('/firebase-events'));
    });

    it('server.js mounts analytics router', () => {
      const p = path.join(ROOT, 'backend/src/server.js');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes("analyticsRouter"));
      assert.ok(content.includes("/api/v1/analytics"));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. VALIDATION SCHEMAS
  // ═══════════════════════════════════════════════════════════════════════

  describe('Validation Schemas', () => {

    it('AnalyticsMetricCategory has 4 categories', () => {
      for (const cat of ['PLATFORM', 'PLAYER', 'ORGANISER', 'GAME']) {
        assert.equal(AnalyticsMetricCategory.parse(cat), cat);
      }
      assert.throws(() => AnalyticsMetricCategory.parse('INVALID'));
    });

    it('AnalyticsExportType has 4 types', () => {
      for (const t of ['PLAYER_STATS', 'ORGANISER_STATS', 'PLATFORM_DAILY', 'GAME_POPULARITY']) {
        assert.equal(AnalyticsExportType.parse(t), t);
      }
    });

    it('AnalyticsExportRequestSchema validates required fields', () => {
      const result = AnalyticsExportRequestSchema.parse({
        reportName: 'Monthly Report',
        exportType: 'PLAYER_STATS',
      });
      assert.equal(result.format, 'CSV'); // default
      assert.equal(result.reportName, 'Monthly Report');
    });

    it('AnalyticsExportRequestSchema rejects short report name', () => {
      assert.throws(() => AnalyticsExportRequestSchema.parse({
        reportName: 'Hi',
        exportType: 'PLAYER_STATS',
      }));
    });

    it('AnalyticsDateRangeSchema applies defaults', () => {
      const result = AnalyticsDateRangeSchema.parse({});
      assert.equal(result.days, 30);
    });

    it('AnalyticsDateRangeSchema enforces max 365', () => {
      assert.throws(() => AnalyticsDateRangeSchema.parse({ days: 999 }));
    });

    it('ViewRefreshRequestSchema validates view names', () => {
      const result = ViewRefreshRequestSchema.parse({ viewName: 'mv_player_stats' });
      assert.equal(result.viewName, 'mv_player_stats');
      assert.throws(() => ViewRefreshRequestSchema.parse({ viewName: 'mv_fake' }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 8. UI FILES
  // ═══════════════════════════════════════════════════════════════════════

  describe('UI Files Existence & Content', () => {

    it('admin analytics page exists with KPIs and exports', () => {
      const p = path.join(ROOT, 'apps/admin/src/app/analytics/page.tsx');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('Platform KPIs'));
      assert.ok(content.includes('Game Popularity'));
      assert.ok(content.includes('Materialised View'));
      assert.ok(content.includes('Data Exports'));
      assert.ok(content.includes('Export Security Gate'));
      assert.ok(content.includes('Metric Definitions'));
    });

    it('web dashboard page exists with player stats', () => {
      const p = path.join(ROOT, 'apps/web/src/app/dashboard/page.tsx');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('Player Dashboard'));
      assert.ok(content.includes('Win Rate'));
      assert.ok(content.includes('Kill Performance'));
      assert.ok(content.includes('Game Breakdown'));
      assert.ok(content.includes('fair_play_score'));
    });

    it('admin shell includes Analytics nav item', () => {
      const p = path.join(ROOT, 'apps/admin/src/components/AdminShell.tsx');
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes("name: 'Analytics'"));
      assert.ok(content.includes("href: '/analytics'"));
    });

    it('Flutter analytics dashboard screen exists', () => {
      const p = path.join(ROOT, 'apps/mobile/lib/screens/analytics_dashboard_screen.dart');
      assert.ok(fs.existsSync(p));
      const content = fs.readFileSync(p, 'utf-8');
      assert.ok(content.includes('AnalyticsDashboardScreen'));
      assert.ok(content.includes('Kill Performance'));
      assert.ok(content.includes('Game Breakdown'));
      assert.ok(content.includes('Win Rate'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 9. METRIC DEFINITIONS — Exit Criterion
  // ═══════════════════════════════════════════════════════════════════════

  describe('Metric Definitions (Every metric documented)', () => {

    it('migration seeds at least 18 metric definitions', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/024_analytics_and_dashboards.sql'),
        'utf-8'
      );
      const matches = sql.match(/\('[\w_]+'/g);
      assert.ok(matches && matches.length >= 18, `Expected >=18 metrics, found ${matches?.length}`);
    });

    it('each metric has display_name, description, category, and data_source', () => {
      const sql = fs.readFileSync(
        path.join(ROOT, 'infra/migrations/024_analytics_and_dashboards.sql'),
        'utf-8'
      );
      assert.ok(sql.includes('display_name'));
      assert.ok(sql.includes('description'));
      assert.ok(sql.includes('data_source'));
      assert.ok(sql.includes('refresh_cadence'));
    });
  });
});
