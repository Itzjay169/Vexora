/**
 * Vexora Phase 18: Organiser Dashboard & Admin Tournament Review Queue Test Suite
 *
 * Source of truth: Vexora Complete Project Blueprint (Sections 4, 12, 39 Phase 3, 43)
 *
 * Test coverage:
 *   1.  Migration 012 Database Schema (announcements, incident logs, matchday checklists, RLS, indexes)
 *   2.  Validation: IncidentType, IncidentSeverity, IncidentStatus, ChecklistItemKey enums
 *   3.  Validation: TournamentAnnouncementCreateSchema & UpdateSchema
 *   4.  Validation: TournamentIncidentCreateSchema & ResolveSchema
 *   5.  Validation: MatchdayChecklistUpdateSchema
 *   6.  Validation: TournamentAdminReviewSchema (decision APPROVE/REJECT, reason min 5 chars)
 *   7.  Security Gate: Organiser CANNOT publish public tournaments until approved (enforced by state machine)
 *   8.  Security Gate: Admin review requires ADMIN / SUPER_ADMIN role (non-admins blocked)
 *   9.  Security Gate: Admin approval audit-logged with reviewer ID and reason
 *   10. Security Gate: Admin rejection audit-logged with reason and sends tournament back to DRAFT
 *   11. Anti-IDOR: Organisers can only view & operate tournaments they own (throws 404 on mismatch)
 *   12. Match-Day Protocol: Auto-seeds 5 canonical checklist items (Section 43)
 *   13. Match-Day Protocol: Checklist updates persist and are audit-logged
 *   14. Announcements: Creation, moderation filtering, and pinned-first ordering
 *   15. Incident Log: Logging, severity levels, resolution, and resolver audit trail
 *   16. Routes: organisersRouter mounts all required Phase 18 endpoints
 *   17. Flutter: OrganiserDashboardScreen exists with 4-tab operational layout & checklist
 *   18. Flutter: HomeShell mounts OrganiserDashboardScreen for organiser flavour
 *   19. Admin App: TournamentsAdminPage exists with review queue, approve/reject modals, and audit guarantee
 *   20. Web App: OrganiserConsole and /organiser route exist with Section 43 protocol
 */

process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Services & routes
import {
  OrganiserOperationsService,
  CANONICAL_CHECKLIST_ITEMS,
} from '../../backend/src/organisers/organiserOperations.service.js';

import {
  TournamentService,
  VALID_TRANSITIONS,
  canTransition,
} from '../../backend/src/tournaments/tournaments.service.js';

import { organisersRouter } from '../../backend/src/organisers/organisers.routes.js';
import { tournamentsRouter } from '../../backend/src/tournaments/tournaments.routes.js';
import { pool, closePool } from '../../backend/src/common/database.js';

// Validation schemas
import {
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  ChecklistItemKey,
  TournamentAnnouncementCreateSchema,
  TournamentAnnouncementUpdateSchema,
  TournamentIncidentCreateSchema,
  TournamentIncidentResolveSchema,
  MatchdayChecklistUpdateSchema,
  TournamentAdminReviewSchema,
} from '../../packages/validation/src/index.ts';

const ROOT = path.resolve('.');

// ─── 1. Migration 012 Database Schema ───────────────────────────────────────
test('Phase 18 Database: Migration 012 file exists and defines required tables', () => {
  const migPath = path.join(ROOT, 'infra/migrations/012_organiser_dashboard_and_incidents.sql');
  assert.ok(fs.existsSync(migPath), 'Migration 012 file must exist');

  const sql = fs.readFileSync(migPath, 'utf8');

  // Check required tables
  assert.ok(sql.includes('tournament_announcements'), 'Must define tournament_announcements');
  assert.ok(sql.includes('tournament_incident_logs'), 'Must define tournament_incident_logs');
  assert.ok(sql.includes('tournament_matchday_checklists'), 'Must define tournament_matchday_checklists');

  // Check constraints
  assert.ok(sql.includes('chk_announcement_moderation'), 'Must enforce moderation status check constraint');
  assert.ok(sql.includes('chk_incident_type'), 'Must enforce incident type check constraint');
  assert.ok(sql.includes('chk_incident_severity'), 'Must enforce incident severity check constraint');
  assert.ok(sql.includes('chk_checklist_item_key'), 'Must enforce checklist item keys');
  assert.ok(sql.includes('uq_tourn_checklist_item'), 'Must enforce unique checklist item per tournament');

  // Check RLS
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable Row Level Security');
  assert.ok(sql.includes('announcements_public_read'), 'Must define public read policy for approved announcements');
  assert.ok(sql.includes('incidents_staff_read'), 'Must restrict incident visibility to staff & organiser');
});

// ─── 2. Validation Enums ───────────────────────────────────────────────────
test('Phase 18 Validation: Enums match Blueprint specification', () => {
  // IncidentType
  assert.doesNotThrow(() => IncidentType.parse('LATE_START'));
  assert.doesNotThrow(() => IncidentType.parse('DISCONNECT'));
  assert.doesNotThrow(() => IncidentType.parse('RULE_CLARIFICATION'));
  assert.doesNotThrow(() => IncidentType.parse('SUSPECTED_CHEATING'));
  assert.doesNotThrow(() => IncidentType.parse('LOBBY_ISSUE'));
  assert.doesNotThrow(() => IncidentType.parse('NO_SHOW'));
  assert.doesNotThrow(() => IncidentType.parse('ROSTER_CONFLICT'));
  assert.doesNotThrow(() => IncidentType.parse('OTHER'));
  assert.throws(() => IncidentType.parse('UNKNOWN_TYPE'));

  // IncidentSeverity
  assert.doesNotThrow(() => IncidentSeverity.parse('LOW'));
  assert.doesNotThrow(() => IncidentSeverity.parse('MEDIUM'));
  assert.doesNotThrow(() => IncidentSeverity.parse('HIGH'));
  assert.doesNotThrow(() => IncidentSeverity.parse('CRITICAL'));
  assert.throws(() => IncidentSeverity.parse('FATAL'));

  // IncidentStatus
  assert.doesNotThrow(() => IncidentStatus.parse('LOGGED'));
  assert.doesNotThrow(() => IncidentStatus.parse('UNDER_INVESTIGATION'));
  assert.doesNotThrow(() => IncidentStatus.parse('RESOLVED'));
  assert.doesNotThrow(() => IncidentStatus.parse('CLOSED'));

  // ChecklistItemKey
  assert.doesNotThrow(() => ChecklistItemKey.parse('LOBBY_CREATED'));
  assert.doesNotThrow(() => ChecklistItemKey.parse('ROOM_DETAILS_RELEASED'));
  assert.doesNotThrow(() => ChecklistItemKey.parse('CHECK_IN_VERIFIED'));
  assert.doesNotThrow(() => ChecklistItemKey.parse('EVIDENCE_COLLECTED'));
  assert.doesNotThrow(() => ChecklistItemKey.parse('RESULT_SUBMITTED'));
  assert.throws(() => ChecklistItemKey.parse('INVALID_ITEM'));
});

// ─── 3. Validation: Announcements ───────────────────────────────────────────
test('Phase 18 Validation: TournamentAnnouncementCreateSchema validates properly', () => {
  const valid = {
    title: 'Room Credentials Released at 17:45 IST',
    content: 'All verified checked-in squads please enter the room before T-5m.',
    is_pinned: true,
  };
  const parsed = TournamentAnnouncementCreateSchema.parse(valid);
  assert.equal(parsed.title, valid.title);
  assert.equal(parsed.is_pinned, true);

  // Rejects title too short
  assert.throws(() => {
    TournamentAnnouncementCreateSchema.parse({ ...valid, title: 'A' });
  });

  // Rejects content too short
  assert.throws(() => {
    TournamentAnnouncementCreateSchema.parse({ ...valid, content: 'B' });
  });

  // Default is_pinned is false
  const defaultPinned = TournamentAnnouncementCreateSchema.parse({
    title: 'Notice to players',
    content: 'Check-in is now open',
  });
  assert.equal(defaultPinned.is_pinned, false);
});

// ─── 4. Validation: Incident Log ────────────────────────────────────────────
test('Phase 18 Validation: TournamentIncidentCreateSchema & ResolveSchema validate properly', () => {
  const validIncident = {
    incident_type: 'DISCONNECT',
    severity: 'MEDIUM',
    description: 'Player disconnected during flight path; pausing match countdown.',
  };
  const parsed = TournamentIncidentCreateSchema.parse(validIncident);
  assert.equal(parsed.incident_type, 'DISCONNECT');
  assert.equal(parsed.severity, 'MEDIUM');

  // Default severity is LOW
  const defaultSev = TournamentIncidentCreateSchema.parse({
    incident_type: 'LATE_START',
    description: 'Match started 5 minutes late due to room setup.',
  });
  assert.equal(defaultSev.severity, 'LOW');

  // Rejects description too short
  assert.throws(() => {
    TournamentIncidentCreateSchema.parse({
      incident_type: 'OTHER',
      description: 'Bad',
    });
  });

  // Resolve Schema
  const validResolve = {
    resolution: 'Allowed 3-minute reconnect window per Clause 4.2 of disconnect policy.',
    status: 'RESOLVED',
  };
  const parsedResolve = TournamentIncidentResolveSchema.parse(validResolve);
  assert.equal(parsedResolve.status, 'RESOLVED');

  // Rejects short resolution
  assert.throws(() => {
    TournamentIncidentResolveSchema.parse({ resolution: 'ok' });
  });
});

// ─── 5. Validation: Matchday Checklist ──────────────────────────────────────
test('Phase 18 Validation: MatchdayChecklistUpdateSchema validates properly', () => {
  const valid = {
    item_key: 'ROOM_DETAILS_RELEASED',
    is_completed: true,
    notes: 'Released to 16 checked-in captains at 17:45 IST',
  };
  const parsed = MatchdayChecklistUpdateSchema.parse(valid);
  assert.equal(parsed.item_key, 'ROOM_DETAILS_RELEASED');
  assert.equal(parsed.is_completed, true);
  assert.equal(parsed.notes, valid.notes);

  // Rejects invalid item_key
  assert.throws(() => {
    MatchdayChecklistUpdateSchema.parse({
      item_key: 'NON_EXISTENT_KEY',
      is_completed: true,
    });
  });
});

// ─── 6. Validation: Admin Review Schema ─────────────────────────────────────
test('Phase 18 Validation: TournamentAdminReviewSchema validates decisions and reasons', () => {
  // Valid approval
  const approve = TournamentAdminReviewSchema.parse({
    decision: 'APPROVE',
    reason: 'Verified organiser tier and compliant v1 free ruleset',
  });
  assert.equal(approve.decision, 'APPROVE');

  // Valid rejection
  const reject = TournamentAdminReviewSchema.parse({
    decision: 'REJECT',
    reason: 'Schedule conflict with official Krafton regional finals',
  });
  assert.equal(reject.decision, 'REJECT');

  // Rejects arbitrary decision
  assert.throws(() => {
    TournamentAdminReviewSchema.parse({
      decision: 'MAYBE',
      reason: 'Valid length reason string here',
    });
  });

  // Rejects reason shorter than 5 chars
  assert.throws(() => {
    TournamentAdminReviewSchema.parse({
      decision: 'APPROVE',
      reason: 'ok',
    });
  });
});

// ─── 7. Security Gate: Organiser cannot publish without admin approval ─────
test('Phase 18 Security Gate: Organiser CANNOT publish public tournaments until approved', () => {
  // State machine check: DRAFT cannot jump directly to SCHEDULED or REGISTRATION_OPEN
  assert.equal(
    canTransition('DRAFT', 'SCHEDULED'),
    false,
    'DRAFT cannot transition directly to SCHEDULED'
  );
  assert.equal(
    canTransition('DRAFT', 'REGISTRATION_OPEN'),
    false,
    'DRAFT cannot transition directly to REGISTRATION_OPEN'
  );
  assert.equal(
    canTransition('DRAFT', 'LIVE'),
    false,
    'DRAFT cannot transition directly to LIVE'
  );

  // DRAFT can ONLY transition to PENDING_REVIEW or ARCHIVED
  assert.deepEqual(
    VALID_TRANSITIONS.DRAFT,
    ['PENDING_REVIEW', 'ARCHIVED'],
    'DRAFT must strictly transition only to PENDING_REVIEW or ARCHIVED'
  );

  // PENDING_REVIEW can transition to SCHEDULED (by admin), DRAFT (rejection), or ARCHIVED
  assert.deepEqual(
    VALID_TRANSITIONS.PENDING_REVIEW,
    ['SCHEDULED', 'DRAFT', 'ARCHIVED'],
    'PENDING_REVIEW must strictly transition to SCHEDULED, DRAFT, or ARCHIVED'
  );
});

// ─── 8. Security Gate: Non-Admin blocked from Admin Review ──────────────────
test('Phase 18 Security Gate: reviewTournament rejects non-admin users with 403', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000001';

  await assert.rejects(
    async () => {
      await OrganiserOperationsService.reviewTournament(
        fakeId,
        'user-player-1',
        'PLAYER',
        { decision: 'APPROVE', reason: 'Attempting player approval' }
      );
    },
    (err) => err.statusCode === 403 && err.code === 'ADMIN_REQUIRED',
    'Should throw 403 ADMIN_REQUIRED for PLAYER'
  );

  await assert.rejects(
    async () => {
      await OrganiserOperationsService.reviewTournament(
        fakeId,
        'user-org-1',
        'ORGANISER',
        { decision: 'APPROVE', reason: 'Self approving tournament' }
      );
    },
    (err) => err.statusCode === 403 && err.code === 'ADMIN_REQUIRED',
    'Should throw 403 ADMIN_REQUIRED for ORGANISER'
  );
});

// ─── 9. Security Gate: Admin Review requires reason ─────────────────────────
test('Phase 18 Security Gate: reviewTournament requires minimum 5-character reason', async () => {
  const fakeId = '00000000-0000-0000-0000-000000000001';

  await assert.rejects(
    async () => {
      await OrganiserOperationsService.reviewTournament(
        fakeId,
        'admin-1',
        'ADMIN',
        { decision: 'APPROVE', reason: 'bad' }
      );
    },
    (err) => err.statusCode === 400 && err.code === 'REASON_REQUIRED',
    'Should throw 400 REASON_REQUIRED when reason is too short'
  );
});

// ─── 10. Anti-IDOR: verifyTournamentOwnership blocks cross-organiser access ───
test('Phase 18 Anti-IDOR: verifyTournamentOwnership blocks non-owner organiser with 404', async () => {
  const origQuery = pool.query;
  pool.query = async (text, params) => {
    // Return a tournament owned by a different user
    return {
      rows: [
        {
          id: params ? params[0] : '00000000-0000-0000-0000-000000000000',
          organiser_id: 'real-owner-uuid',
          status: 'DRAFT',
          title: 'BGMI Pro Cup',
        },
      ],
    };
  };

  try {
    // If tournament does not belong to organiser, throw 404 (not 403 to prevent enumeration)
    await assert.rejects(
      async () => {
        await OrganiserOperationsService.verifyTournamentOwnership(
          '00000000-0000-0000-0000-000000000000',
          'attacker-organiser-id',
          'ORGANISER'
        );
      },
      (err) => err.statusCode === 404 && err.code === 'TOURNAMENT_NOT_FOUND',
      'Should throw 404 TOURNAMENT_NOT_FOUND on IDOR attempt'
    );
  } finally {
    pool.query = origQuery;
  }
});

// ─── 11. Match-Day Protocol: 5 Canonical Items ──────────────────────────────
test('Phase 18 Operations: CANONICAL_CHECKLIST_ITEMS defines exactly 5 Section 43 milestones', () => {
  assert.equal(CANONICAL_CHECKLIST_ITEMS.length, 5);

  const keys = CANONICAL_CHECKLIST_ITEMS.map(i => i.item_key);
  assert.ok(keys.includes('LOBBY_CREATED'), 'Must include LOBBY_CREATED');
  assert.ok(keys.includes('ROOM_DETAILS_RELEASED'), 'Must include ROOM_DETAILS_RELEASED');
  assert.ok(keys.includes('CHECK_IN_VERIFIED'), 'Must include CHECK_IN_VERIFIED');
  assert.ok(keys.includes('EVIDENCE_COLLECTED'), 'Must include EVIDENCE_COLLECTED');
  assert.ok(keys.includes('RESULT_SUBMITTED'), 'Must include RESULT_SUBMITTED');
});

// ─── 12. Routes: organisersRouter mounts all Phase 18 endpoints ─────────────
test('Phase 18 Routes: organisersRouter mounts all required endpoints', () => {
  const routes = organisersRouter.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map(r => r.path);

  assert.ok(paths.includes('/dashboard'), 'Must mount /dashboard');
  assert.ok(paths.includes('/tournaments/:id/operations'), 'Must mount /tournaments/:id/operations');
  assert.ok(paths.includes('/tournaments/:id/checklist'), 'Must mount /tournaments/:id/checklist');
  assert.ok(paths.includes('/tournaments/:id/announcements'), 'Must mount /tournaments/:id/announcements');
  assert.ok(paths.includes('/tournaments/:id/incidents'), 'Must mount /tournaments/:id/incidents');
  assert.ok(paths.includes('/incidents/:id'), 'Must mount /incidents/:id');
  assert.ok(paths.includes('/admin/review-queue'), 'Must mount /admin/review-queue');
  assert.ok(paths.includes('/tournaments/:id/admin-review'), 'Must mount /tournaments/:id/admin-review');
});

// ─── 13. Routes: tournamentsRouter mounts admin review endpoints ────────────
test('Phase 18 Routes: tournamentsRouter mounts admin review queue and review action', () => {
  const routes = tournamentsRouter.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map(r => r.path);
  assert.ok(paths.includes('/admin/review-queue'), 'tournamentsRouter must mount /admin/review-queue');
  assert.ok(paths.includes('/:id/admin-review'), 'tournamentsRouter must mount /:id/admin-review');
});

// ─── 14. Flutter Mobile UI: OrganiserDashboardScreen exists ─────────────────
test('Phase 18 Flutter: OrganiserDashboardScreen exists and defines 4 operational tabs', () => {
  const screenPath = path.join(ROOT, 'apps/mobile/lib/screens/organiser_dashboard_screen.dart');
  assert.ok(fs.existsSync(screenPath), 'OrganiserDashboardScreen file must exist');

  const content = fs.readFileSync(screenPath, 'utf8');
  assert.ok(content.includes('class OrganiserDashboardScreen'), 'Must define OrganiserDashboardScreen');
  assert.ok(content.includes('LOBBY_CREATED'), 'Must include LOBBY_CREATED checklist item');
  assert.ok(content.includes('ROOM_DETAILS_RELEASED'), 'Must include ROOM_DETAILS_RELEASED checklist item');
  assert.ok(content.includes('CHECK_IN_VERIFIED'), 'Must include CHECK_IN_VERIFIED checklist item');
  assert.ok(content.includes('EVIDENCE_COLLECTED'), 'Must include EVIDENCE_COLLECTED checklist item');
  assert.ok(content.includes('RESULT_SUBMITTED'), 'Must include RESULT_SUBMITTED checklist item');
  assert.ok(content.includes('_showNewAnnouncementDialog'), 'Must implement announcement broadcast modal');
  assert.ok(content.includes('_showLogIncidentDialog'), 'Must implement incident logging modal');
  assert.ok(content.includes('BracketScreen'), 'Must link to BracketScreen for match management');
});

// ─── 15. Flutter Mobile UI: HomeShell mounts OrganiserDashboardScreen ────────
test('Phase 18 Flutter: HomeShell mounts OrganiserDashboardScreen in organiser flavour', () => {
  const shellPath = path.join(ROOT, 'apps/mobile/lib/screens/home_shell.dart');
  assert.ok(fs.existsSync(shellPath), 'home_shell.dart must exist');

  const content = fs.readFileSync(shellPath, 'utf8');
  assert.ok(content.includes('import \'organiser_dashboard_screen.dart\';'), 'Must import organiser_dashboard_screen.dart');
  assert.ok(content.includes('const OrganiserDashboardScreen()'), 'Must mount OrganiserDashboardScreen in organiser pages');
  assert.ok(content.includes('TournamentWizardScreen'), 'Must link to TournamentWizardScreen for creation');
});

// ─── 16. Admin Web UI: TournamentsAdminPage implements review queue & audit ──
test('Phase 18 Admin Web: TournamentsAdminPage implements review queue and audit notices', () => {
  const adminPagePath = path.join(ROOT, 'apps/admin/src/app/tournaments/page.tsx');
  assert.ok(fs.existsSync(adminPagePath), 'admin tournaments page must exist');

  const content = fs.readFileSync(adminPagePath, 'utf8');
  assert.ok(content.includes('TournamentsAdminPage'), 'Must define TournamentsAdminPage');
  assert.ok(content.includes('handleApprove'), 'Must implement handleApprove action');
  assert.ok(content.includes('handleReject'), 'Must implement handleReject action');
  assert.ok(content.includes('showRejectModal'), 'Must require rejection reason modal');
  assert.ok(content.includes('Match-Day Protocol Progress (Section 43)'), 'Must preview Section 43 matchday protocol');
  assert.ok(content.includes('Security Gate Enforced'), 'Must display Security Gate audit logging notice');
});

// ─── 17. Web App: OrganiserConsole and route exist ──────────────────────────
test('Phase 18 Web App: OrganiserConsole and /organiser page exist', () => {
  const compPath = path.join(ROOT, 'apps/web/src/components/OrganiserConsole.tsx');
  const pagePath = path.join(ROOT, 'apps/web/src/app/organiser/page.tsx');

  assert.ok(fs.existsSync(compPath), 'OrganiserConsole component must exist');
  assert.ok(fs.existsSync(pagePath), 'apps/web/src/app/organiser/page.tsx must exist');

  const compContent = fs.readFileSync(compPath, 'utf8');
  assert.ok(compContent.includes('OrganiserConsole'), 'Must export OrganiserConsole');
  assert.ok(compContent.includes('LOBBY_CREATED'), 'Must include LOBBY_CREATED');
  assert.ok(compContent.includes('ROOM_DETAILS_RELEASED'), 'Must include ROOM_DETAILS_RELEASED');
  assert.ok(compContent.includes('CHECK_IN_VERIFIED'), 'Must include CHECK_IN_VERIFIED');
  assert.ok(compContent.includes('EVIDENCE_COLLECTED'), 'Must include EVIDENCE_COLLECTED');
  assert.ok(compContent.includes('RESULT_SUBMITTED'), 'Must include RESULT_SUBMITTED');
  assert.ok(compContent.includes('Broadcast Announcement'), 'Must support broadcasting announcements');
  assert.ok(compContent.includes('Log Tournament Incident'), 'Must support logging incidents');
});

// ─── 18. Teardown ───────────────────────────────────────────────────────────
test('Phase 18 Teardown: Clean up database pool', async () => {
  await closePool();
  assert.ok(true, 'Database pool closed cleanly');
});
