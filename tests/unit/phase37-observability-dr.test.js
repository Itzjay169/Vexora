import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { metricsRegistry } from '../../backend/src/common/metrics.js';
import { alertService, IncidentSeverity } from '../../backend/src/common/alertService.js';
import { simulateRegistrationSpike, simulateWebSocketFanout } from '../load/load-benchmark.js';
import { backupRestoreEngine } from '../../scripts/backup-restore.js';
import { healthRouter } from '../../backend/src/common/health.js';

/**
 * Phase 37: Load Testing, Observability, Backup & Disaster Recovery Test Suite
 * Blueprint Ref: Sections 45, 46, 49, 39 (Phase 9)
 */

test('Phase 37 Metrics: Accurately tracks HTTP requests, latency quantiles, and Prometheus format', () => {
  metricsRegistry.reset();

  metricsRegistry.recordHttpRequest('GET', '/api/v1/tournaments', 200, 45);
  metricsRegistry.recordHttpRequest('GET', '/api/v1/tournaments', 200, 80);
  metricsRegistry.recordHttpRequest('GET', '/api/v1/tournaments', 200, 120);
  metricsRegistry.recordHttpRequest('POST', '/api/v1/wallet/balance', 200, 35);
  metricsRegistry.recordHttpRequest('GET', '/api/v1/tournaments', 404, 25);

  metricsRegistry.setActiveWebSockets(42);

  const summary = metricsRegistry.getSummary();
  assert.equal(summary.http.totalRequests, 5);
  assert.ok(summary.http.p95LatencyMs > 0);
  assert.equal(summary.websockets.activeConnections, 42);

  const promOutput = metricsRegistry.toPrometheusFormat();
  assert.ok(promOutput.includes('vexora_http_requests_total{method="GET",route="/api/v1/tournaments",status="200"} 3'));
  assert.ok(promOutput.includes('vexora_active_websockets 42'));
  assert.ok(promOutput.includes('vexora_http_request_duration_seconds{quantile="0.95"}'));
});

test('Phase 37 Alerting: Triggers SEV-1 incident immediately on ledger invariant breach', () => {
  alertService.reset();

  const incident = alertService.reportLedgerImbalance('tourn-123', 500.00);
  assert.equal(incident.severity, IncidentSeverity.SEV1);
  assert.equal(incident.status, 'OPEN');
  assert.equal(incident.slaMinutes, 15);
  assert.ok(incident.title.includes('Double-Entry Ledger Imbalance'));

  const status = alertService.getSystemStatusSummary();
  assert.equal(status.status, 'MAJOR_OUTAGE');
  assert.equal(status.activeIncidentsCount, 1);
});

test('Phase 37 Alerting: Triggers SEV-1 incident on SHA-256 audit hash chain break', () => {
  alertService.reset();

  const incident = alertService.reportAuditChainBreak('block-99', 'expected-sha256', 'corrupt-sha256');
  assert.equal(incident.severity, IncidentSeverity.SEV1);
  assert.ok(incident.title.includes('Tamper-Evident SHA-256 Audit Log Chain Break'));
  assert.equal(incident.component, 'AUDIT_CHAIN');
});

test('Phase 37 Alerting: Triggers SEV-2 incident on abnormal redeem code brute-force surge', () => {
  alertService.reset();

  let triggeredIncident = null;
  // Trigger 10 failures in rapid succession
  for (let i = 0; i < 10; i++) {
    const res = alertService.recordRedeemFailure(`user-${i}`, `INVALID_CODE_${i}`);
    if (res) triggeredIncident = res;
  }

  assert.ok(triggeredIncident !== null, 'Burst of 10 failures must trigger a SEV-2 alert');
  assert.equal(triggeredIncident.severity, IncidentSeverity.SEV2);
  assert.ok(triggeredIncident.title.includes('Abnormal Redeem-Code Failures'));

  const status = alertService.getSystemStatusSummary();
  assert.equal(status.status, 'PARTIAL_OUTAGE');
});

test('Phase 37 Alerting: Triggers SEV-2 incident on sudden dispute surge', () => {
  alertService.reset();

  let incident = null;
  for (let i = 0; i < 5; i++) {
    const res = alertService.recordDisputeOpened('tourn-456', `match-${i}`);
    if (res) incident = res;
  }

  assert.ok(incident !== null, '5 disputes within 15 minutes must trigger a dispute spike alert');
  assert.equal(incident.severity, IncidentSeverity.SEV2);
  assert.ok(incident.title.includes('Sudden Dispute Surge'));
});

test('Phase 37 Alerting: Supports incident lifecycle resolution with notes and audit trail', () => {
  alertService.reset();

  const incident = alertService.reportLedgerImbalance('tourn-999', 10.00);
  assert.equal(alertService.getActiveIncidents().length, 1);

  const resolved = alertService.resolveIncident(incident.id, 'Adjustment transaction applied; ledger sum zeroed');
  assert.equal(resolved.status, 'RESOLVED');
  assert.equal(resolved.resolutionNotes, 'Adjustment transaction applied; ledger sum zeroed');
  assert.equal(alertService.getActiveIncidents().length, 0);

  const status = alertService.getSystemStatusSummary();
  assert.equal(status.status, 'OPERATIONAL');
});

test('Phase 37 Load Benchmark: Simulates tournament-start spike with zero overselling and p95 latency under 300ms', async () => {
  const result = await simulateRegistrationSpike({
    totalRequests: 200,
    maxSlots: 1,
    latencyTargetMs: 300,
  });

  assert.equal(result.acceptedCount, 1, 'Only exactly 1 winner must claim the final slot');
  assert.equal(result.rejectedCount, 199, 'All other contenders must be rejected');
  assert.equal(result.zeroOversold, true, 'Zero oversold slots allowed');
  assert.ok(result.p95Ms <= 300, `p95 latency (${result.p95Ms}ms) must be under 300ms target`);
  assert.equal(result.targetMet, true);
});

test('Phase 37 Load Benchmark: WebSocket fan-out delivers high broadcast throughput', async () => {
  const fanout = await simulateWebSocketFanout({ clientCount: 500, messageCount: 4 });
  assert.equal(fanout.totalMessagesBroadcast, 2000);
  assert.ok(fanout.durationMs >= 0);
  assert.ok(fanout.throughputMsgPerSec >= 1000);
});

test('Phase 37 Backup & PITR: Creates verifiable backup manifest and validates checksum', () => {
  const manifest = backupRestoreEngine.createBackupSnapshot('vexora_prod', ['ledger_entries', 'audit_logs']);
  assert.ok(manifest.snapshotId.includes('vexora-snap-vexora_prod'));
  assert.ok(manifest.checksum.length === 64, 'Checksum must be valid SHA-256');

  const verification = backupRestoreEngine.verifyBackupIntegrity(manifest);
  assert.equal(verification.valid, true);
  assert.equal(verification.integrityPassed, true);

  // Tampering detection test
  const tamperedManifest = { ...manifest, payload: manifest.payload + ' ' };
  const tamperedVerification = backupRestoreEngine.verifyBackupIntegrity(tamperedManifest);
  assert.equal(tamperedVerification.valid, false, 'Tampered backup must be rejected');
});

test('Phase 37 Backup & PITR: Simulates Point-In-Time Recovery drill meeting RPO and RTO targets', () => {
  const manifest = backupRestoreEngine.createBackupSnapshot('vexora_prod');
  const targetTime = new Date().toISOString();

  const pitrResult = backupRestoreEngine.simulatePitRestore(manifest, targetTime);
  assert.equal(pitrResult.success, true);
  assert.ok(pitrResult.rtoMinutes <= 60, 'RTO must be under 60 minutes');
  assert.ok(pitrResult.rpoMinutes <= 15, 'RPO must be under 15 minutes');
  assert.equal(pitrResult.rtoTargetMet, true);
  assert.equal(pitrResult.rpoTargetMet, true);
});

test('Phase 37 Database Partitioning & PgBouncer: Configuration files exist and meet specifications', () => {
  const sqlPath = path.resolve('infra/database/partitioning.sql');
  assert.ok(fs.existsSync(sqlPath), 'infra/database/partitioning.sql must exist');

  const sqlContent = fs.readFileSync(sqlPath, 'utf8');
  assert.ok(sqlContent.includes('ledger_entries_partitioned'), 'Must partition ledger_entries');
  assert.ok(sqlContent.includes('audit_logs_partitioned'), 'Must partition audit_logs');
  assert.ok(sqlContent.includes('PARTITION BY RANGE (created_at)'), 'Must use time-based range partitioning');

  const pgbouncerPath = path.resolve('infra/docker/pgbouncer/pgbouncer.ini');
  assert.ok(fs.existsSync(pgbouncerPath), 'infra/docker/pgbouncer/pgbouncer.ini must exist');

  const iniContent = fs.readFileSync(pgbouncerPath, 'utf8');
  assert.ok(iniContent.includes('pool_mode = transaction'), 'Must enforce transaction pooling');
  assert.ok(iniContent.includes('max_client_conn = 5000'), 'Must handle 5000 client connections');
});

test('Phase 37 Incident Runbooks & DR Report: All 9 runbooks and drill report are documented', () => {
  const runbooks = [
    'database-failover.md',
    'stuck-payouts.md',
    'webhook-outage.md',
    'leaked-secret.md',
    'compromised-admin.md',
    'evidence-storage-outage.md',
    'ddos-mitigation.md',
    'data-breach-notification.md',
    'dr-drill-report.md',
  ];

  for (const rb of runbooks) {
    const rbPath = path.resolve('docs/runbooks', rb);
    assert.ok(fs.existsSync(rbPath), `docs/runbooks/${rb} must exist`);
    const content = fs.readFileSync(rbPath, 'utf8');
    assert.ok(content.length > 200, `Runbook ${rb} must contain detailed operational procedures`);
  }
});

test('Phase 37 Status Page & Health Endpoint: Route is accessible and renders component telemetry', () => {
  const statusPagePath = path.resolve('apps/web/src/app/status/page.tsx');
  assert.ok(fs.existsSync(statusPagePath), 'apps/web/src/app/status/page.tsx must exist');

  const content = fs.readFileSync(statusPagePath, 'utf8');
  assert.ok(content.includes('ALL SYSTEMS OPERATIONAL'));
  assert.ok(content.includes('Service Level Objectives'));
  assert.ok(content.includes('Core API Gateway'));
  assert.ok(content.includes('Double-Entry Ledger Engine'));

  // Test /system-status handler directly on router
  const statusRoute = healthRouter.stack.find(s => s.route?.path === '/system-status');
  assert.ok(statusRoute, 'Route /system-status must exist on healthRouter');

  let resData;
  const req = {};
  const res = {
    json: (d) => { resData = d; },
  };

  statusRoute.route.stack[0].handle(req, res);
  assert.equal(resData.success, true);
  assert.equal(resData.data.components.apiGateway, 'OPERATIONAL');
  assert.equal(resData.data.components.ledgerCore, 'OPERATIONAL');
});
