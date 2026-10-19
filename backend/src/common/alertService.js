import { logger } from './logger.js';
import { metricsRegistry } from './metrics.js';

/**
 * Phase 37: Business Alerting Engine & Incident Management
 * Blueprint Ref: Section 46 (Observability, SLOs & Incident Response)
 */

export const IncidentSeverity = {
  SEV1: 'SEV1_CRITICAL', // Money/safety/data loss, ledger invariant breach, broken audit chain
  SEV2: 'SEV2_HIGH',     // Live tournament impact, dispute spike, payment webhook down
  SEV3: 'SEV3_MEDIUM',   // Non-blocking degradation, slow reporting query
};

class AlertService {
  constructor() {
    this.activeIncidents = new Map(); // id -> incident details
    this.incidentHistory = [];
    this.alertSubscribers = [];
    this.recentRedeemFailures = []; // timestamps
    this.recentDisputes = [];       // timestamps
    this.spikeModeActive = false;
  }

  subscribe(callback) {
    this.alertSubscribers.push(callback);
  }

  notifySubscribers(incident) {
    for (const sub of this.alertSubscribers) {
      try {
        sub(incident);
      } catch (err) {
        logger.error('Error invoking alert subscriber callback', { error: err.message });
      }
    }
  }

  createIncident({ severity, title, details, component }) {
    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const incident = {
      id: incidentId,
      severity,
      title,
      details,
      component,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaMinutes: severity === IncidentSeverity.SEV1 ? 15 : severity === IncidentSeverity.SEV2 ? 60 : 240,
    };

    this.activeIncidents.set(incidentId, incident);
    this.incidentHistory.unshift(incident);

    logger.error(`🚨 [INCIDENT ${severity}] ${title}`, {
      incidentId,
      component,
      details,
      slaMinutes: incident.slaMinutes,
    });

    this.notifySubscribers(incident);
    return incident;
  }

  resolveIncident(incidentId, resolutionNotes) {
    const incident = this.activeIncidents.get(incidentId);
    if (!incident) return null;

    incident.status = 'RESOLVED';
    incident.resolutionNotes = resolutionNotes;
    incident.resolvedAt = new Date().toISOString();
    incident.updatedAt = new Date().toISOString();

    this.activeIncidents.delete(incidentId);
    logger.info(`✅ [INCIDENT RESOLVED] ${incident.title}`, { incidentId, resolutionNotes });
    return incident;
  }

  /**
   * SEV-1: Checks ledger invariants. Any discrepancy immediately triggers a SEV-1 alert.
   */
  reportLedgerImbalance(tournamentId, calculatedDiff) {
    metricsRegistry.recordLedgerImbalance();
    return this.createIncident({
      severity: IncidentSeverity.SEV1,
      title: 'Double-Entry Ledger Imbalance Detected: Non-Zero Net Sum',
      details: {
        tournamentId,
        discrepancyAmount: calculatedDiff,
        ruleViolated: 'SUM(amount) == 0 invariant broken',
      },
      component: 'LEDGER_CORE',
    });
  }

  /**
   * SEV-1: Check audit hash chain integrity.
   */
  reportAuditChainBreak(blockId, expectedHash, actualHash) {
    return this.createIncident({
      severity: IncidentSeverity.SEV1,
      title: 'Tamper-Evident SHA-256 Audit Log Chain Break',
      details: { blockId, expectedHash, actualHash },
      component: 'AUDIT_CHAIN',
    });
  }

  /**
   * SEV-2: Monitor redeem code failure rate. Trigger alert if > 10 failures within 60s.
   */
  recordRedeemFailure(userId, codeAttempt) {
    metricsRegistry.recordRedeemFailure();
    const now = Date.now();
    this.recentRedeemFailures.push(now);
    // Keep only last 60 seconds
    this.recentRedeemFailures = this.recentRedeemFailures.filter(ts => now - ts <= 60000);

    if (this.recentRedeemFailures.length >= 10) {
      // Check if an existing open incident for redeem abuse is active
      const hasActive = Array.from(this.activeIncidents.values()).some(
        inc => inc.title.includes('Abnormal Redeem-Code Failures') && inc.status === 'OPEN'
      );
      if (!hasActive) {
        return this.createIncident({
          severity: IncidentSeverity.SEV2,
          title: 'Abnormal Redeem-Code Failures Surge (Potential Brute-Force)',
          details: {
            failureCountLastMinute: this.recentRedeemFailures.length,
            threshold: 10,
            lastUser: userId,
          },
          component: 'REDEEM_CURRENCY',
        });
      }
    }
    return null;
  }

  /**
   * SEV-2: Monitor dispute volume. Trigger alert if > 5 disputes filed within 15 mins.
   */
  recordDisputeOpened(tournamentId, matchId) {
    const now = Date.now();
    this.recentDisputes.push(now);
    this.recentDisputes = this.recentDisputes.filter(ts => now - ts <= 15 * 60 * 1000);

    const isSpike = this.recentDisputes.length >= 5;
    metricsRegistry.setDisputeSpike(isSpike);

    if (isSpike) {
      const hasActive = Array.from(this.activeIncidents.values()).some(
        inc => inc.title.includes('Sudden Dispute Surge') && inc.status === 'OPEN'
      );
      if (!hasActive) {
        return this.createIncident({
          severity: IncidentSeverity.SEV2,
          title: 'Sudden Dispute Surge: Multiple Match Result Contestations',
          details: {
            disputesLast15m: this.recentDisputes.length,
            tournamentId,
            matchId,
          },
          component: 'DISPUTE_ARBITRATION',
        });
      }
    }
    return null;
  }

  /**
   * SEV-2: Payout queue backlog monitor. Trigger alert if backlog > threshold.
   */
  checkPayoutBacklog(backlogCount) {
    metricsRegistry.setPayoutBacklog(backlogCount);
    if (backlogCount > 20) {
      const hasActive = Array.from(this.activeIncidents.values()).some(
        inc => inc.title.includes('Payout Queue Backlog') && inc.status === 'OPEN'
      );
      if (!hasActive) {
        return this.createIncident({
          severity: IncidentSeverity.SEV2,
          title: 'Payout Queue Backlog Exceeding 24h Review SLA',
          details: { pendingCount: backlogCount, threshold: 20 },
          component: 'PAYOUT_QUEUE',
        });
      }
    }
    return null;
  }

  /**
   * Tournament-Start Spike Degradation Mode:
   * Protects critical paths (Registration & Wallet) by shedding expensive analytics and pre-warming caches.
   */
  setSpikeMode(enabled) {
    this.spikeModeActive = enabled;
    logger.warn(`Tournament Spike Management: ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}`, {
      spikeModeActive: enabled,
    });
  }

  isSpikeModeActive() {
    return this.spikeModeActive;
  }

  getActiveIncidents() {
    return Array.from(this.activeIncidents.values());
  }

  getSystemStatusSummary() {
    const openSev1 = Array.from(this.activeIncidents.values()).filter(i => i.severity === IncidentSeverity.SEV1);
    const openSev2 = Array.from(this.activeIncidents.values()).filter(i => i.severity === IncidentSeverity.SEV2);

    let systemState = 'OPERATIONAL';
    if (openSev1.length > 0) systemState = 'MAJOR_OUTAGE';
    else if (openSev2.length > 0) systemState = 'PARTIAL_OUTAGE';
    else if (this.spikeModeActive) systemState = 'DEGRADED_PERFORMANCE';

    return {
      status: systemState,
      activeIncidentsCount: this.activeIncidents.size,
      spikeModeActive: this.spikeModeActive,
      incidents: Array.from(this.activeIncidents.values()),
      components: {
        apiGateway: 'OPERATIONAL',
        databaseCluster: openSev1.length > 0 ? 'INVESTIGATING' : 'OPERATIONAL',
        redisCache: 'OPERATIONAL',
        websocketGateway: 'OPERATIONAL',
        ledgerCore: openSev1.length > 0 ? 'ALERTING' : 'OPERATIONAL',
        storageMinio: 'OPERATIONAL',
        firebasePush: 'OPERATIONAL',
      },
      updatedAt: new Date().toISOString(),
    };
  }

  reset() {
    this.activeIncidents.clear();
    this.incidentHistory = [];
    this.recentRedeemFailures = [];
    this.recentDisputes = [];
    this.spikeModeActive = false;
  }
}

export const alertService = new AlertService();
