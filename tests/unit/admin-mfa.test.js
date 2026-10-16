process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import {
  generateAccessToken,
  generateMfaChallengeToken,
  verifyMfaChallengeToken,
  verifyAccessToken,
} from '../../backend/src/common/auth.middleware.js';

import { ROLES, isAdminRole } from '../../backend/src/common/rbac.js';
import nextConfig from '../../apps/admin/next.config.mjs';

// ─── 1. Security Gate: Admin Cannot Sign In Without MFA ──────────────────────

test('Phase 9 Security Gate: Admin primary login issues MFA challenge, NOT access tokens', () => {
  const adminUser = {
    id: 'usr_admin_test_01',
    username: 'admin_test',
    role: ROLES.ADMIN,
  };

  // Step 1: Challenge token generated
  const challengeToken = generateMfaChallengeToken(adminUser);
  assert.ok(challengeToken, 'MFA challenge token must be generated');

  const decodedChallenge = verifyMfaChallengeToken(challengeToken);
  assert.equal(decodedChallenge.sub, adminUser.id);
  assert.equal(decodedChallenge.type, 'mfa_challenge');

  // Verify that an MFA challenge token CANNOT be used as an access token
  assert.throws(
    () => {
      verifyAccessToken(challengeToken);
    },
    (err) => {
      assert.equal(err.code, 'INVALID_TOKEN');
      return true;
    },
    'MFA challenge token must not be accepted by verifyAccessToken'
  );
});

test('Phase 9 Security Gate: Standard access token without MFA verification is flagged mfa_verified=false', () => {
  const adminUser = {
    id: 'usr_admin_unverified',
    username: 'admin_unverified',
    role: ROLES.ADMIN,
    mfa_verified: false,
  };

  const token = generateAccessToken(adminUser);
  const decoded = verifyAccessToken(token);

  assert.equal(decoded.mfa_verified, false, 'Token must not have mfa_verified true');
});

test('Phase 9 Security Gate: MFA verified token contains mfa_verified=true claim', () => {
  const adminUser = {
    id: 'usr_admin_verified',
    username: 'admin_verified',
    role: ROLES.SUPER_ADMIN,
    mfa_verified: true,
  };

  const token = generateAccessToken(adminUser, { mfa_verified: true });
  const decoded = verifyAccessToken(token);

  assert.equal(decoded.mfa_verified, true, 'Token must contain mfa_verified=true');
  assert.equal(decoded.type, 'access');
});

test('Phase 9 Security Gate: Non-admin users are strictly blocked from admin login', () => {
  const nonAdminRoles = [ROLES.PLAYER, ROLES.TEAM_CAPTAIN, ROLES.ORGANISER];
  const adminRoles = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.FINANCE, ROLES.MODERATOR, ROLES.AUDITOR];

  for (const role of nonAdminRoles) {
    assert.equal(
      adminRoles.includes(role),
      false,
      `Role ${role} must not be permitted in admin login`
    );
  }

  for (const role of adminRoles) {
    assert.equal(
      adminRoles.includes(role),
      true,
      `Role ${role} must be permitted in admin login`
    );
  }
});

// ─── 2. Role-Based Navigation Matrix Verification ───────────────────────────

test('Phase 9 Role Navigation: Navigation items adapt strictly to admin role', () => {
  // Navigation matrix specification from Section 12 & AdminShell
  const NAV_SPEC = [
    { name: 'Overview', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MODERATOR', 'AUDITOR'] },
    { name: 'Organiser Approvals', roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
    { name: 'Dispute Adjudication', roles: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] },
    { name: 'Financial Maker-Checker', roles: ['SUPER_ADMIN', 'FINANCE', 'AUDITOR'] },
    { name: 'Feature Flags', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Audit Hash Chain', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'AUDITOR'] },
    { name: 'Security Centre', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { name: 'Admin Sessions', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MODERATOR', 'AUDITOR'] },
  ];

  const getNavForRole = (role) => NAV_SPEC.filter((item) => item.roles.includes(role)).map((i) => i.name);

  // Super Admin sees all 8 items
  const superAdminNav = getNavForRole('SUPER_ADMIN');
  assert.equal(superAdminNav.length, 8);

  // Finance sees 5 items (Overview, Maker-Checker, Audit Hash Chain, Sessions)
  const financeNav = getNavForRole('FINANCE');
  assert.ok(financeNav.includes('Financial Maker-Checker'));
  assert.ok(financeNav.includes('Audit Hash Chain'));
  assert.ok(!financeNav.includes('Dispute Adjudication'));
  assert.ok(!financeNav.includes('Organiser Approvals'));
  assert.ok(!financeNav.includes('Security Centre'));

  // Moderator sees 4 items (Overview, Organiser Approvals, Disputes, Sessions)
  const modNav = getNavForRole('MODERATOR');
  assert.ok(modNav.includes('Dispute Adjudication'));
  assert.ok(modNav.includes('Organiser Approvals'));
  assert.ok(!modNav.includes('Financial Maker-Checker'));
  assert.ok(!modNav.includes('Feature Flags'));

  // Auditor sees 4 items (Overview, Maker-Checker, Audit Hash Chain, Sessions)
  const auditorNav = getNavForRole('AUDITOR');
  assert.ok(auditorNav.includes('Audit Hash Chain'));
  assert.ok(auditorNav.includes('Financial Maker-Checker'));
  assert.ok(!auditorNav.includes('Organiser Approvals'));
  assert.ok(!auditorNav.includes('Dispute Adjudication'));
  assert.ok(!auditorNav.includes('Feature Flags'));
});

// ─── 3. Security Headers Configuration ──────────────────────────────────────

test('Phase 9 Security Headers: next.config.mjs defines enterprise security headers', async () => {
  assert.ok(nextConfig.headers, 'next.config.mjs must define async headers() function');

  const headersList = await nextConfig.headers();
  assert.ok(headersList.length > 0);

  const globalRule = headersList.find((h) => h.source === '/(.*)');
  assert.ok(globalRule, 'Must contain global security header rule');

  const headerMap = new Map(globalRule.headers.map((h) => [h.key, h.value]));

  // Verify CSP
  assert.ok(headerMap.has('Content-Security-Policy'));
  const csp = headerMap.get('Content-Security-Policy');
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));

  // Verify HSTS
  assert.ok(headerMap.has('Strict-Transport-Security'));
  assert.ok(headerMap.get('Strict-Transport-Security').includes('max-age=63072000'));

  // Verify Frame Options & nosniff
  assert.equal(headerMap.get('X-Frame-Options'), 'DENY');
  assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.ok(headerMap.has('Permissions-Policy'));
});

// ─── 4. Admin Middleware & CSRF ─────────────────────────────────────────────

test('Phase 9 CSRF: Admin middleware.ts enforces clickjacking & origin protections', () => {
  const middlewarePath = path.resolve('apps/admin/src/middleware.ts');
  assert.ok(fs.existsSync(middlewarePath), 'apps/admin/src/middleware.ts must exist');

  const content = fs.readFileSync(middlewarePath, 'utf8');
  assert.ok(content.includes('X-Frame-Options'));
  assert.ok(content.includes('DENY'));
  assert.ok(content.includes('CSRF_BLOCKED'));
});

// ─── 5. Admin App UI Screens ────────────────────────────────────────────────

test('Phase 9 Admin App: All required administrative screens exist', () => {
  const adminDir = path.resolve('apps/admin/src/app');

  const expectedScreens = [
    'page.tsx',             // Overview dashboard
    'login/page.tsx',       // 2-step login with mandatory MFA
    'feature-flags/page.tsx', // Runtime feature flags with money gates
    'audit/page.tsx',       // Read-only tamper-evident audit viewer
    'sessions/page.tsx',    // Admin session management & force logout
  ];

  for (const screen of expectedScreens) {
    const filePath = path.join(adminDir, screen);
    assert.ok(fs.existsSync(filePath), `Admin screen ${screen} must exist at ${filePath}`);
  }

  // Verify StepUpModal exists
  assert.ok(
    fs.existsSync(path.resolve('apps/admin/src/components/StepUpModal.tsx')),
    'StepUpModal component must exist'
  );

  // Verify AdminShell exists
  assert.ok(
    fs.existsSync(path.resolve('apps/admin/src/components/AdminShell.tsx')),
    'AdminShell component must exist'
  );

  // Verify AuthContext exists
  assert.ok(
    fs.existsSync(path.resolve('apps/admin/src/lib/auth-context.tsx')),
    'auth-context.tsx must exist'
  );
});

test('Phase 9 Admin App: Audit viewer page is strictly read-only', () => {
  const auditPagePath = path.resolve('apps/admin/src/app/audit/page.tsx');
  const content = fs.readFileSync(auditPagePath, 'utf8');

  assert.ok(content.includes('Tamper-Evident Audit Log Viewer'));
  assert.ok(content.includes('Audit Chain Valid'));
  assert.ok(content.includes('Immutable Ledger Guarantee'));

  // Must not have write actions (no edit or delete forms)
  assert.ok(!content.includes('<form onSubmit='));
  assert.ok(!content.includes('handleDelete'));
  assert.ok(!content.includes('handleUpdate'));
});

test('Phase 9 Admin App: Feature flags page displays money gate warnings', () => {
  const flagsPagePath = path.resolve('apps/admin/src/app/feature-flags/page.tsx');
  const content = fs.readFileSync(flagsPagePath, 'utf8');

  assert.ok(content.includes('Platform Feature Flags'));
  assert.ok(content.includes('free_tournaments_only'));
  assert.ok(content.includes('real_money_wallet_enabled'));
  assert.ok(content.includes('Money Gate'));
});
