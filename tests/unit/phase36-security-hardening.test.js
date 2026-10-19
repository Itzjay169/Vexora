import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isMaliciousPayload, isAutomatedScanner, wafMiddleware } from '../../backend/src/common/wafMiddleware.js';

/**
 * Phase 36: Security Hardening & Penetration Testing Test Suite
 * Blueprint Ref: Sections 18, 19, 47, 39 (Phase 9)
 */

test('Phase 36 WAF: Blocks SQL Injection signatures in input payloads', () => {
  const sqliPayloads = [
    "admin' OR '1'='1",
    '1 UNION SELECT null, username, password FROM users',
    '1; DROP TABLE tournaments; --',
    "'; WAITFOR DELAY '0:0:5'--",
    "1; SELECT pg_sleep(5);",
  ];

  for (const payload of sqliPayloads) {
    const violation = isMaliciousPayload(payload);
    assert.ok(violation !== null, `Payload "${payload}" must be detected as malicious`);
    assert.equal(violation.category, 'SQL_INJECTION');
  }
});

test('Phase 36 WAF: Blocks Cross-Site Scripting (XSS) exploit signatures', () => {
  const xssPayloads = [
    '<script>alert(document.cookie)</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:stealTokens()',
    '<iframe src="data:text/html,<script>alert(1)</script>">',
  ];

  for (const payload of xssPayloads) {
    const violation = isMaliciousPayload(payload);
    assert.ok(violation !== null, `Payload "${payload}" must be detected as malicious`);
    assert.equal(violation.category, 'XSS_ATTACK');
  }
});

test('Phase 36 WAF: Blocks Path Traversal probe patterns', () => {
  const pathPayloads = [
    '../../etc/passwd',
    '..\\..\\windows\\system32',
    '%2e%2e%2f%2e%2e%2fsecret.key',
  ];

  for (const payload of pathPayloads) {
    const violation = isMaliciousPayload(payload);
    assert.ok(violation !== null, `Payload "${payload}" must be detected as malicious`);
    assert.equal(violation.category, 'PATH_TRAVERSAL');
  }
});

test('Phase 36 WAF: Blocks prototype pollution attempts in JSON payloads', () => {
  const pollutionPayload = {
    __proto__: { admin: true },
    username: 'attacker',
  };

  const violation = isMaliciousPayload(pollutionPayload);
  assert.ok(violation !== null, 'Prototype pollution payload must be detected');
  assert.equal(violation.category, 'PROTOTYPE_POLLUTION');
});

test('Phase 36 WAF: Detects known automated vulnerability scanner User-Agents', () => {
  const scannerAgents = [
    'sqlmap/1.7#stable',
    'Mozilla/5.0 (compatible; Nikto/2.1.6;)',
    'Acunetix-Vulnerability-Scanner',
    'dirbuster/1.0-RC1',
    'Nessus Vulnerability Scanner',
  ];

  for (const ua of scannerAgents) {
    assert.ok(isAutomatedScanner(ua), `User-Agent "${ua}" must be identified as automated scanner`);
  }

  // Legitimate client User-Agents must pass cleanly
  assert.equal(isAutomatedScanner('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'), false);
  assert.equal(isAutomatedScanner('VexoraMobile/1.0.0 (Android; Dart 3.13)'), false);
});

test('Phase 36 WAF: Permitted payloads and legitimate requests pass inspection cleanly', () => {
  const legitimatePayloads = [
    { title: 'BGMI Pro Ignition Championship', game: 'BGMI', maxTeams: 64 },
    { comment: 'Great match today! Well played team Phoenix.' },
    { amount: 1500, idempotencyKey: 'idemp_pay_998124' },
  ];

  for (const payload of legitimatePayloads) {
    const violation = isMaliciousPayload(payload);
    assert.equal(violation, null, 'Legitimate payload must pass WAF clean');
  }
});

test('Phase 36 Risk Engine: Evaluates mobile device integrity & root detection signals', async () => {
  // 1. Rooted device simulation
  const rootedPayload = {
    is_rooted: true,
    is_emulator: false,
    app_check_valid: true,
    anomalies: ['ROOT_BINARY_DETECTED: /system/xbin/su'],
  };

  let resData;
  const req = { body: rootedPayload };
  const res = {
    json: (data) => { resData = data; },
  };

  // Dynamically import routes for direct unit evaluation
  const { riskRouter } = await import('../../backend/src/risk/risk.routes.js');
  const routeLayer = riskRouter.stack.find(s => s.route?.path === '/device-integrity');
  assert.ok(routeLayer, 'Route /device-integrity must exist in riskRouter');

  routeLayer.route.stack[0].handle(req, res);

  assert.equal(resData.success, true);
  assert.ok(resData.data.riskScore >= 50, 'Rooted device must receive risk score >= 50');
  assert.equal(resData.data.requireStepUpAuth, true, 'Rooted device must mandate step-up MFA');
  assert.ok(resData.data.flags.includes('DEVICE_ROOT_DETECTED'));

  // 2. Clean device simulation
  const cleanPayload = {
    is_rooted: false,
    is_emulator: false,
    app_check_valid: true,
    anomalies: [],
  };

  const cleanReq = { body: cleanPayload };
  const cleanRes = { json: (data) => { resData = data; } };

  routeLayer.route.stack[0].handle(cleanReq, cleanRes);

  assert.equal(resData.data.riskScore, 0);
  assert.equal(resData.data.requireStepUpAuth, false);
  assert.equal(resData.data.recommendation, 'STANDARD_ACCESS');
});

test('Phase 36 RFC 9116: Security.txt file and endpoint are correctly configured', () => {
  const securityTxtPath = path.resolve('apps/web/public/.well-known/security.txt');
  assert.ok(fs.existsSync(securityTxtPath), 'apps/web/public/.well-known/security.txt must exist');

  const content = fs.readFileSync(securityTxtPath, 'utf8');
  assert.ok(content.includes('Contact: mailto:security@vexora.gg'), 'Must declare security contact');
  assert.ok(content.includes('Contact: mailto:grievance-officer@vexora.gg'), 'Must declare grievance officer');
  assert.ok(content.includes('Expires:'), 'Must specify expiration date per RFC 9116');
  assert.ok(content.includes('Canonical: https://vexora.gg/.well-known/security.txt'), 'Must declare canonical URL');
  assert.ok(content.includes('Policy: https://vexora.gg/security'), 'Must link to disclosure policy');
});

test('Phase 36 Security Audit: OWASP ASVS and MASVS checklist is fully documented', () => {
  const checklistPath = path.resolve('docs/security/OWASP-ASVS-MASVS-checklist.md');
  assert.ok(fs.existsSync(checklistPath), 'docs/security/OWASP-ASVS-MASVS-checklist.md must exist');

  const content = fs.readFileSync(checklistPath, 'utf8');
  assert.ok(content.includes('OWASP ASVS'), 'Must cover ASVS standard');
  assert.ok(content.includes('OWASP MASVS'), 'Must cover MASVS mobile standard');
  assert.ok(content.includes('V1: Architecture'), 'Must document architecture controls');
  assert.ok(content.includes('V4: Access Control'), 'Must document RBAC & anti-IDOR controls');
  assert.ok(content.includes('MASVS-STORAGE'), 'Must document mobile Keystore controls');
  assert.ok(content.includes('MASVS-NETWORK'), 'Must document Certificate Pinning');
  assert.ok(content.includes('MASVS-RESILIENCE'), 'Must document device integrity & anti-tamper');
});

test('Phase 36 Pen-Test: Comprehensive report confirms zero open critical/high vulnerabilities', () => {
  const reportPath = path.resolve('docs/security/penetration-test-report.md');
  assert.ok(fs.existsSync(reportPath), 'docs/security/penetration-test-report.md must exist');

  const content = fs.readFileSync(reportPath, 'utf8');
  assert.ok(content.includes('ZERO OPEN CRITICAL / HIGH VULNERABILITIES'), 'Must verify zero critical/high');
  assert.ok(content.includes('Vector 1: Broken Access Control'), 'Must cover BOLA & anti-IDOR tests');
  assert.ok(content.includes('Vector 2: Financial Ledger Race Conditions'), 'Must cover double-entry concurrency');
  assert.ok(content.includes('Vector 3: Webhook Replay'), 'Must cover HMAC & replay defenses');
  assert.ok(content.includes('Vector 6: Mobile Client & Device Integrity'), 'Must cover MASVS mobile checks');
});

test('Phase 36 Least-Privilege: Signed least-privilege database & IAM audit is documented', () => {
  const iamPath = path.resolve('docs/security/least-privilege-audit.md');
  assert.ok(fs.existsSync(iamPath), 'docs/security/least-privilege-audit.md must exist');

  const content = fs.readFileSync(iamPath, 'utf8');
  assert.ok(content.includes('vexora_app'), 'Must define application DB role');
  assert.ok(content.includes('vexora_readonly'), 'Must define readonly DB role');
  assert.ok(content.includes('vexora_migrator'), 'Must define migrator DB role');
  assert.ok(content.includes('Maker-Checker Payout Invariant'), 'Must enforce dual-approval invariant');
  assert.ok(content.includes('Break-Glass Emergency Access'), 'Must document emergency access rules');
});

test('Phase 36 Mobile Integrity: Flutter IntegrityService assesses device security and cert pinning', () => {
  const servicePath = path.resolve('apps/mobile/lib/services/integrity_service.dart');
  assert.ok(fs.existsSync(servicePath), 'apps/mobile/lib/services/integrity_service.dart must exist');

  const content = fs.readFileSync(servicePath, 'utf8');
  assert.ok(content.includes('class IntegrityService'), 'Must define IntegrityService');
  assert.ok(content.includes('primaryCertFingerprint'), 'Must define primary certificate pinning fingerprint');
  assert.ok(content.includes('backupCertFingerprint'), 'Must define backup rotation certificate fingerprint');
  assert.ok(content.includes('_knownRootPaths'), 'Must check known root and jailbreak paths');
  assert.ok(content.includes('DeviceIntegrityReport'), 'Must return structured DeviceIntegrityReport');
});

test('Phase 36 Web Portal: Responsible disclosure page exists and links RFC 9116 security.txt', () => {
  const pagePath = path.resolve('apps/web/src/app/security/page.tsx');
  assert.ok(fs.existsSync(pagePath), 'apps/web/src/app/security/page.tsx must exist');

  const content = fs.readFileSync(pagePath, 'utf8');
  assert.ok(content.includes('Vulnerability Disclosure'), 'Must define Vulnerability Disclosure page');
  assert.ok(content.includes('RFC 9116'), 'Must reference RFC 9116 standard');
  assert.ok(content.includes('security@vexora.gg'), 'Must provide security team contact');
  assert.ok(content.includes('Safe Harbor'), 'Must state safe harbor protection for researchers');
});
