import { Queue, Worker } from 'bullmq';
import { logger } from './logger.js';

/**
 * Redis connection config for BullMQ.
 * Uses the same REDIS_URL as the rest of the stack.
 */
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    if (times > 2) return null; // Stop reconnecting when Redis is offline to prevent hanging processes
    return Math.min(times * 200, 1000);
  },
};

// Parse REDIS_URL if provided
if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    redisConnection.host = url.hostname;
    redisConnection.port = parseInt(url.port || '6379', 10);
    if (url.password) redisConnection.password = url.password;
  } catch {
    // fallback to defaults
  }
}

// ─── Queue Definitions ──────────────────────────────────────────────────

/**
 * Notification delivery queue (FCM push, in-app inbox writes).
 */
export const notificationQueue = new Queue('vexora-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

/**
 * Tournament lifecycle processing queue (bracket generation, result finalization).
 */
export const tournamentQueue = new Queue('vexora-tournaments', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
  },
});

/**
 * Payout settlement processing queue (maker-checker async approval pipeline).
 */
export const payoutQueue = new Queue('vexora-payouts', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 5000,
  },
});

/**
 * Audit chain verification queue (daily Merkle root checkpoint job).
 */
export const auditQueue = new Queue('vexora-audit', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 30000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

// Suppress unhandled connection errors when Redis is temporarily offline
[notificationQueue, tournamentQueue, payoutQueue, auditQueue].forEach((q) => {
  q.on('error', (err) => {
    logger.warn(`BullMQ queue ${q.name} connection warning: ${err.message}`);
  });
});

// ─── Worker Definitions ─────────────────────────────────────────────────

/**
 * Notification worker — processes FCM delivery and in-app inbox writes.
 */
export function startNotificationWorker() {
  const worker = new Worker('vexora-notifications', async (job) => {
    logger.info(`📬 Processing notification job ${job.id}`, {
      type: job.data.type,
      userId: job.data.userId,
    });
    // TODO: Implement FCM push delivery and inbox write
    return { delivered: true };
  }, { connection: redisConnection, concurrency: 5 });

  worker.on('completed', (job) => {
    logger.info(`✅ Notification job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Notification job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

/**
 * Tournament worker — handles bracket generation, auto-adjudication timeouts.
 */
export function startTournamentWorker() {
  const worker = new Worker('vexora-tournaments', async (job) => {
    logger.info(`🏆 Processing tournament job ${job.id}: ${job.name}`, {
      tournamentId: job.data.tournamentId,
    });
    // TODO: Implement bracket gen, state transitions, result finalization
    return { processed: true };
  }, { connection: redisConnection, concurrency: 3 });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Tournament job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

/**
 * Payout worker — processes settlement requests through maker-checker pipeline.
 */
export function startPayoutWorker() {
  const worker = new Worker('vexora-payouts', async (job) => {
    logger.info(`💸 Processing payout job ${job.id}`, {
      payoutId: job.data.payoutId,
      amount: job.data.amount,
    });
    // TODO: Integrate with payment gateway (Razorpay/Cashfree)
    return { settled: true };
  }, { connection: redisConnection, concurrency: 2 });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Payout job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

/**
 * Audit worker — runs daily Merkle root checkpoint verification.
 */
export function startAuditWorker() {
  const worker = new Worker('vexora-audit', async (job) => {
    logger.info(`🔐 Running audit chain verification job ${job.id}`);
    // TODO: Compute Merkle root from audit_logs, compare with last checkpoint
    return { verified: true, brokenLinks: 0 };
  }, { connection: redisConnection, concurrency: 1 });

  worker.on('failed', (job, err) => {
    logger.error(`❌ Audit verification job ${job?.id} failed: ${err.message}`);
  });

  return worker;
}

/**
 * Initialize all background workers.
 * Call this from server startup when workers are enabled.
 */
export function startAllWorkers() {
  logger.info('🔧 Starting BullMQ background workers...');
  const workers = {
    notification: startNotificationWorker(),
    tournament: startTournamentWorker(),
    payout: startPayoutWorker(),
    audit: startAuditWorker(),
  };
  logger.info('✅ All BullMQ workers started');
  return workers;
}

/**
 * Cleanly close all queue client connections.
 */
export async function closeAllQueues() {
  await Promise.allSettled([
    notificationQueue.close(),
    tournamentQueue.close(),
    payoutQueue.close(),
    auditQueue.close(),
  ]);
}

