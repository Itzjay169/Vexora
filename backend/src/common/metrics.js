/**
 * Phase 37: Observability, Metrics & Telemetry
 * Blueprint Ref: Section 46 (Observability, SLOs & Incident Response)
 */

class MetricsRegistry {
  constructor() {
    this.httpRequests = new Map(); // key: `${method}:${route}:${status}` -> count
    this.httpDurations = []; // { route, method, durationMs, timestamp }
    this.activeWebSockets = 0;
    this.ledgerImbalances = 0;
    this.reconciliationDiscrepancies = 0;
    this.redeemFailures = 0;
    this.disputeSpikes = 0;
    this.payoutBacklog = 0;
    this.maxDurationSamples = 5000;
  }

  recordHttpRequest(method, route, statusCode, durationMs) {
    const key = `${method.toUpperCase()}:${route}:${statusCode}`;
    this.httpRequests.set(key, (this.httpRequests.get(key) || 0) + 1);

    this.httpDurations.push({
      method: method.toUpperCase(),
      route,
      statusCode,
      durationMs,
      timestamp: Date.now(),
    });

    if (this.httpDurations.length > this.maxDurationSamples) {
      this.httpDurations.shift();
    }
  }

  setActiveWebSockets(count) {
    this.activeWebSockets = Math.max(0, count);
  }

  incrementWebSockets() {
    this.activeWebSockets += 1;
  }

  decrementWebSockets() {
    this.activeWebSockets = Math.max(0, this.activeWebSockets - 1);
  }

  recordLedgerImbalance() {
    this.ledgerImbalances += 1;
  }

  setReconciliationDiscrepancies(amount) {
    this.reconciliationDiscrepancies = amount;
  }

  recordRedeemFailure() {
    this.redeemFailures += 1;
  }

  setDisputeSpike(active) {
    this.disputeSpikes = active ? 1 : 0;
  }

  setPayoutBacklog(count) {
    this.payoutBacklog = count;
  }

  getQuantiles(durations) {
    if (durations.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };
    const sorted = [...durations].sort((a, b) => a - b);
    const getIndex = (q) => Math.min(Math.floor(sorted.length * q), sorted.length - 1);
    return {
      p50: sorted[getIndex(0.50)],
      p90: sorted[getIndex(0.90)],
      p95: sorted[getIndex(0.95)],
      p99: sorted[getIndex(0.99)],
    };
  }

  getSummary() {
    const allDurations = this.httpDurations.map(d => d.durationMs);
    const quantiles = this.getQuantiles(allDurations);
    let totalRequests = 0;
    const requestsByRoute = {};

    for (const [key, count] of this.httpRequests.entries()) {
      totalRequests += count;
      const [method, route, status] = key.split(':');
      if (!requestsByRoute[route]) requestsByRoute[route] = { total: 0, statuses: {} };
      requestsByRoute[route].total += count;
      requestsByRoute[route].statuses[`${method}_${status}`] = count;
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      http: {
        totalRequests,
        p50LatencyMs: quantiles.p50,
        p90LatencyMs: quantiles.p90,
        p95LatencyMs: quantiles.p95,
        p99LatencyMs: quantiles.p99,
        routes: requestsByRoute,
      },
      websockets: {
        activeConnections: this.activeWebSockets,
      },
      businessSLOs: {
        ledgerImbalances: this.ledgerImbalances,
        reconciliationDiscrepancyAmount: this.reconciliationDiscrepancies,
        redeemFailuresTotal: this.redeemFailures,
        disputeSpikeActive: this.disputeSpikes === 1,
        payoutBacklogCount: this.payoutBacklog,
      },
    };
  }

  toPrometheusFormat() {
    const lines = [
      '# HELP vexora_http_requests_total Total number of HTTP requests processed',
      '# TYPE vexora_http_requests_total counter',
    ];

    for (const [key, count] of this.httpRequests.entries()) {
      const [method, route, status] = key.split(':');
      lines.push(`vexora_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }

    const summary = this.getSummary();
    lines.push(
      '# HELP vexora_http_request_duration_seconds HTTP request latencies',
      '# TYPE vexora_http_request_duration_seconds summary',
      `vexora_http_request_duration_seconds{quantile="0.5"} ${(summary.http.p50LatencyMs / 1000).toFixed(4)}`,
      `vexora_http_request_duration_seconds{quantile="0.9"} ${(summary.http.p90LatencyMs / 1000).toFixed(4)}`,
      `vexora_http_request_duration_seconds{quantile="0.95"} ${(summary.http.p95LatencyMs / 1000).toFixed(4)}`,
      `vexora_http_request_duration_seconds{quantile="0.99"} ${(summary.http.p99LatencyMs / 1000).toFixed(4)}`,
      '# HELP vexora_active_websockets Current active WebSocket client connections',
      '# TYPE vexora_active_websockets gauge',
      `vexora_active_websockets ${this.activeWebSockets}`,
      '# HELP vexora_ledger_imbalance_total Critical ledger imbalance alert count',
      '# TYPE vexora_ledger_imbalance_total counter',
      `vexora_ledger_imbalance_total ${this.ledgerImbalances}`,
      '# HELP vexora_reconciliation_discrepancy Current reconciliation variance',
      '# TYPE vexora_reconciliation_discrepancy gauge',
      `vexora_reconciliation_discrepancy ${this.reconciliationDiscrepancies}`,
      '# HELP vexora_redeem_failures_total Total failed redeem code attempts',
      '# TYPE vexora_redeem_failures_total counter',
      `vexora_redeem_failures_total ${this.redeemFailures}`,
      '# HELP vexora_dispute_spike_active Active dispute spike flag (1=active)',
      '# TYPE vexora_dispute_spike_active gauge',
      `vexora_dispute_spike_active ${this.disputeSpikes}`,
      '# HELP vexora_payout_backlog_total Pending payout requests waiting over 24h',
      '# TYPE vexora_payout_backlog_total gauge',
      `vexora_payout_backlog_total ${this.payoutBacklog}`,
    );

    return lines.join('\n') + '\n';
  }

  reset() {
    this.httpRequests.clear();
    this.httpDurations = [];
    this.activeWebSockets = 0;
    this.ledgerImbalances = 0;
    this.reconciliationDiscrepancies = 0;
    this.redeemFailures = 0;
    this.disputeSpikes = 0;
    this.payoutBacklog = 0;
  }
}

export const metricsRegistry = new MetricsRegistry();

/**
 * Express Middleware to track latency and response status codes
 */
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  const route = req.route?.path || req.path || '/unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    metricsRegistry.recordHttpRequest(req.method, route, res.statusCode, duration);
  });

  next();
}
