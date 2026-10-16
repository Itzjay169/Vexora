/**
 * Vexora Esports Tournament Platform — Payment Service
 *
 * Phase 27: Payments, Prize Escrow & Paid Tournament Flow
 * PDF refs: Sections 9, 26, 39 (Phase 6)
 *
 * Implements:
 * - Payment provider integration (Razorpay / Cashfree)
 * - Signed webhook processing with timestamp + event-ID deduplication
 * - Client NEVER confirms payment — only signed webhooks do
 * - Idempotency keys on all payment mutations
 * - Feature flag gating (real_money_wallet_enabled)
 * - Regional kill-switches via Remote Config + admin
 */

import crypto from 'crypto';
import { query, withTransaction } from '../common/database.js';
import { appendAuditLog } from '../audit/audit.service.js';
import { logger } from '../common/logger.js';
import {
  WalletLedgerService,
  PLATFORM_REVENUE_WALLET_ID,
  PLATFORM_ESCROW_WALLET_ID,
} from '../wallet/walletLedger.service.js';

// ─── Constants ──────────────────────────────────────────────────────────
export const PAYMENT_PROVIDERS = ['RAZORPAY', 'CASHFREE'];
export const WEBHOOK_REPLAY_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
export const ORDER_EXPIRY_MINUTES = 30;

export class PaymentService {

  // ─── Feature Flag Gate ──────────────────────────────────────────────
  /**
   * Checks if real-money payments are enabled.
   * If the feature flag `real_money_wallet_enabled` is FALSE, all
   * paid operations are blocked at the service layer.
   *
   * @returns {Promise<boolean>}
   */
  static async isPaymentsEnabled() {
    const res = await query(
      `SELECT is_enabled FROM feature_flags WHERE flag_key = 'real_money_wallet_enabled'`
    );
    return res.rows.length > 0 && res.rows[0].is_enabled === true;
  }

  /**
   * Checks regional kill-switch for a specific region/country.
   *
   * @param {string} regionCode - e.g. 'IN-ALL', 'IN-KA'
   * @param {string} countryCode - e.g. 'IN'
   * @returns {Promise<{ allowed: boolean, reason?: string }>}
   */
  static async checkRegionalKillSwitch(regionCode = 'IN-ALL', countryCode = 'IN') {
    const res = await query(
      `SELECT is_enabled, kill_switch_on, kill_switch_reason, max_entry_fee, max_prize_pool, allowed_providers
       FROM regional_payment_config
       WHERE region_code = $1 AND country_code = $2`,
      [regionCode, countryCode]
    );

    if (res.rows.length === 0) {
      return { allowed: false, reason: 'Region not configured for payments' };
    }

    const config = res.rows[0];
    if (config.kill_switch_on || !config.is_enabled) {
      return { allowed: false, reason: config.kill_switch_reason || 'Payments disabled for this region' };
    }

    return {
      allowed: true,
      maxEntryFee: Number(config.max_entry_fee),
      maxPrizePool: Number(config.max_prize_pool),
      allowedProviders: config.allowed_providers,
    };
  }

  // ─── Webhook Signature Verification ─────────────────────────────────
  /**
   * Verify HMAC-SHA256 webhook signature from payment provider.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * @param {string|Buffer} rawBody - Raw request body
   * @param {string} signature - Provider signature header
   * @param {string} secret - Webhook secret
   * @returns {boolean}
   */
  static verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature || !secret) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Check webhook timestamp to prevent replay attacks.
   * Rejects events older than WEBHOOK_REPLAY_TOLERANCE_MS.
   *
   * @param {number|string} timestamp - Event timestamp (epoch seconds or ISO)
   * @returns {boolean}
   */
  static isWebhookTimestampValid(timestamp) {
    if (!timestamp) return true; // If no timestamp provided, skip check
    const eventTime = typeof timestamp === 'number'
      ? timestamp * 1000
      : new Date(timestamp).getTime();
    const now = Date.now();
    return Math.abs(now - eventTime) <= WEBHOOK_REPLAY_TOLERANCE_MS;
  }

  // ─── Webhook Event Deduplication ───────────────────────────────────
  /**
   * Record and deduplicate incoming webhook events.
   * Uses (provider, event_id) unique constraint for deduplication.
   *
   * @param {Object} params
   * @param {string} params.provider - 'RAZORPAY' or 'CASHFREE'
   * @param {string} params.eventId - Provider event ID
   * @param {string} params.eventType - Event type string
   * @param {Object} params.payload - Full webhook payload
   * @param {string} [params.signature] - Webhook signature
   * @param {string} [params.ipAddress] - Sender IP
   * @returns {Promise<{ isDuplicate: boolean, webhookEvent: Object }>}
   */
  static async recordWebhookEvent({ provider, eventId, eventType, payload, signature, ipAddress }) {
    try {
      const res = await query(
        `INSERT INTO webhook_events (provider, event_id, event_type, payload, signature, ip_address, processing_status)
         VALUES ($1, $2, $3, $4, $5, $6, 'RECEIVED')
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING *`,
        [provider, eventId, eventType, JSON.stringify(payload), signature, ipAddress]
      );

      if (res.rows.length === 0) {
        // Duplicate — already processed
        logger.warn(`Duplicate webhook event detected: ${provider}/${eventId}`);
        return { isDuplicate: true, webhookEvent: null };
      }

      return { isDuplicate: false, webhookEvent: res.rows[0] };
    } catch (err) {
      logger.error('Failed to record webhook event', { provider, eventId, error: err.message });
      throw err;
    }
  }

  /**
   * Mark a webhook event as processed.
   *
   * @param {string} webhookEventId - Webhook event UUID
   * @param {string} status - 'PROCESSED' or 'FAILED'
   * @param {string} [errorMessage] - Error details if failed
   */
  static async updateWebhookStatus(webhookEventId, status, errorMessage = null) {
    await query(
      `UPDATE webhook_events
       SET processing_status = $1, processed_at = NOW(), error_message = $2
       WHERE id = $3 AND processing_status NOT IN ('PROCESSED', 'DUPLICATE')`,
      [status, errorMessage, webhookEventId]
    );
  }

  // ─── Payment Order Management ─────────────────────────────────────
  /**
   * Create a payment order for a deposit or tournament entry.
   * The client receives order details to initiate checkout, but
   * NEVER confirms payment — only the webhook does.
   *
   * @param {Object} params
   * @param {string} params.userId - Payer user ID
   * @param {string} params.provider - 'RAZORPAY' or 'CASHFREE'
   * @param {number} params.amount - Amount in INR
   * @param {string} params.purpose - 'DEPOSIT', 'TOURNAMENT_ENTRY', 'PRIZE_ESCROW'
   * @param {string} [params.referenceType] - e.g. 'TOURNAMENT'
   * @param {string} [params.referenceId] - Associated entity UUID
   * @param {string} params.idempotencyKey - Unique key
   * @returns {Promise<Object>} Created payment order
   */
  static async createPaymentOrder({
    userId,
    provider,
    amount,
    purpose,
    referenceType = null,
    referenceId = null,
    idempotencyKey,
  }) {
    // 1. Feature flag gate
    const paymentsEnabled = await PaymentService.isPaymentsEnabled();
    if (!paymentsEnabled) {
      const err = new Error('Real-money payments are disabled. v1 launch = FREE tournaments only.');
      err.code = 'PAYMENTS_DISABLED';
      err.status = 403;
      throw err;
    }

    // 2. Regional kill-switch check
    const regional = await PaymentService.checkRegionalKillSwitch();
    if (!regional.allowed) {
      const err = new Error(regional.reason);
      err.code = 'REGION_PAYMENTS_DISABLED';
      err.status = 403;
      throw err;
    }

    // 3. Validate amount
    const orderAmount = Number(amount);
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      const err = new Error('Payment amount must be a positive number');
      err.code = 'INVALID_AMOUNT';
      err.status = 400;
      throw err;
    }

    // 4. Idempotency check
    if (idempotencyKey) {
      const existing = await query(
        `SELECT * FROM payment_orders WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      if (existing.rows.length > 0) {
        logger.info(`Payment order idempotency replay: ${idempotencyKey}`);
        return { order: existing.rows[0], isReplay: true };
      }
    }

    // 5. Create order in DB
    const expiresAt = new Date(Date.now() + ORDER_EXPIRY_MINUTES * 60 * 1000);

    const res = await query(
      `INSERT INTO payment_orders (
         user_id, provider, amount, currency, purpose,
         reference_type, reference_id, idempotency_key, status, expires_at
       )
       VALUES ($1, $2, $3, 'INR', $4, $5, $6, $7, 'CREATED', $8)
       RETURNING *`,
      [userId, provider, orderAmount, purpose, referenceType, referenceId, idempotencyKey, expiresAt]
    );

    const order = res.rows[0];

    // 6. In production, this would call the Razorpay/Cashfree SDK to
    // create a gateway order. For now, we simulate the provider order ID.
    const providerOrderId = `${provider.toLowerCase()}_order_${order.id.substring(0, 8)}`;
    await query(
      `UPDATE payment_orders SET provider_order_id = $1 WHERE id = $2`,
      [providerOrderId, order.id]
    );
    order.provider_order_id = providerOrderId;

    // 7. Audit log
    await appendAuditLog({
      actorId: userId,
      actorRole: 'USER',
      action: 'PAYMENT_ORDER_CREATED',
      entityType: 'PAYMENT_ORDER',
      entityId: order.id,
      payload: { provider, amount: orderAmount, purpose, referenceType, referenceId },
      reason: `Payment order created: ${purpose}`,
    });

    logger.info('Payment order created', { orderId: order.id, provider, amount: orderAmount, purpose });

    return { order, isReplay: false };
  }

  /**
   * Process a confirmed payment webhook (payment.captured).
   * This is the ONLY path through which a payment is confirmed.
   * Client-side confirmations are never trusted.
   *
   * @param {string} orderId - Internal payment order UUID
   * @param {string} providerPaymentId - Provider's payment ID
   * @param {string} webhookEventId - Webhook event UUID
   * @returns {Promise<Object>} Updated order + ledger transaction
   */
  static async confirmPayment(orderId, providerPaymentId, webhookEventId) {
    return withTransaction(async (client) => {
      // 1. Lock the order
      const orderRes = await client.query(
        `SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        const err = new Error('Payment order not found');
        err.code = 'ORDER_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const order = orderRes.rows[0];

      // Already confirmed? Return idempotently
      if (order.status === 'CAPTURED') {
        return { order, isAlreadyConfirmed: true };
      }

      if (!['CREATED', 'PENDING', 'AUTHORIZED'].includes(order.status)) {
        const err = new Error(`Cannot confirm payment in status: ${order.status}`);
        err.code = 'INVALID_ORDER_STATUS';
        err.status = 400;
        throw err;
      }

      // 2. Credit user's wallet via double-entry ledger
      const userWallet = await WalletLedgerService.getOrCreateUserWallet(order.user_id, client);

      const transferResult = await WalletLedgerService.executeLedgerTransfer({
        entryType: 'DEPOSIT',
        debitAccountId: PLATFORM_REVENUE_WALLET_ID,
        creditAccountId: userWallet.id,
        amount: Number(order.amount),
        description: `Payment deposit via ${order.provider}: ${providerPaymentId}`,
        referenceType: 'PAYMENT_ORDER',
        referenceId: order.id,
        initiatedBy: order.user_id,
        idempotencyKey: `deposit-${order.id}`,
        client,
      });

      // 3. Update order status
      await client.query(
        `UPDATE payment_orders
         SET status = 'CAPTURED',
             provider_payment_id = $1,
             webhook_event_id = $2,
             ledger_tx_id = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [providerPaymentId, webhookEventId, transferResult.transaction.id, orderId]
      );

      // 4. Audit log
      await appendAuditLog({
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        action: 'PAYMENT_CONFIRMED',
        entityType: 'PAYMENT_ORDER',
        entityId: orderId,
        payload: { providerPaymentId, webhookEventId, amount: Number(order.amount) },
        reason: 'Payment confirmed via signed webhook',
        client,
      });

      logger.info('Payment confirmed', {
        orderId,
        providerPaymentId,
        amount: Number(order.amount),
        userId: order.user_id,
      });

      return { order: { ...order, status: 'CAPTURED' }, transaction: transferResult.transaction, isAlreadyConfirmed: false };
    });
  }

  /**
   * Process a failed payment webhook (payment.failed).
   *
   * @param {string} orderId - Internal payment order UUID
   * @param {string} failureReason - Why the payment failed
   * @param {string} webhookEventId - Webhook event UUID
   */
  static async failPayment(orderId, failureReason, webhookEventId) {
    await query(
      `UPDATE payment_orders
       SET status = 'FAILED',
           failure_reason = $1,
           webhook_event_id = $2,
           updated_at = NOW()
       WHERE id = $3 AND status IN ('CREATED', 'PENDING', 'AUTHORIZED')`,
      [failureReason, webhookEventId, orderId]
    );

    await appendAuditLog({
      actorId: 'SYSTEM',
      actorRole: 'SYSTEM',
      action: 'PAYMENT_FAILED',
      entityType: 'PAYMENT_ORDER',
      entityId: orderId,
      payload: { failureReason },
      reason: `Payment failed: ${failureReason}`,
    });

    logger.warn('Payment failed', { orderId, failureReason });
  }

  /**
   * Process a refund via webhook or admin action.
   *
   * @param {string} orderId - Internal payment order UUID
   * @param {number} refundAmount - Amount to refund
   * @param {string} reason - Refund reason
   * @param {string} [initiatedBy] - Admin or system ID
   * @param {string} [idempotencyKey] - Unique key
   * @returns {Promise<Object>} Refund result with ledger transaction
   */
  static async processRefund(orderId, refundAmount, reason, initiatedBy = 'SYSTEM', idempotencyKey = null) {
    return withTransaction(async (client) => {
      const orderRes = await client.query(
        `SELECT * FROM payment_orders WHERE id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        const err = new Error('Payment order not found');
        err.code = 'ORDER_NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const order = orderRes.rows[0];
      if (order.status !== 'CAPTURED') {
        const err = new Error('Can only refund captured payments');
        err.code = 'INVALID_REFUND_STATUS';
        err.status = 400;
        throw err;
      }

      const amount = Number(refundAmount);
      const alreadyRefunded = Number(order.refund_amount || 0);
      if (amount + alreadyRefunded > Number(order.amount)) {
        const err = new Error('Refund amount exceeds original payment');
        err.code = 'REFUND_EXCEEDS_PAYMENT';
        err.status = 400;
        throw err;
      }

      // Debit user's wallet back to platform
      const userWallet = await WalletLedgerService.getOrCreateUserWallet(order.user_id, client);

      const transferResult = await WalletLedgerService.executeLedgerTransfer({
        entryType: 'REFUND',
        debitAccountId: userWallet.id,
        creditAccountId: PLATFORM_REVENUE_WALLET_ID,
        amount,
        description: `Refund for order ${orderId}: ${reason}`,
        referenceType: 'PAYMENT_ORDER',
        referenceId: orderId,
        initiatedBy,
        idempotencyKey: idempotencyKey || `refund-${orderId}-${Date.now()}`,
        client,
      });

      const isFullRefund = (amount + alreadyRefunded) === Number(order.amount);
      await client.query(
        `UPDATE payment_orders
         SET status = $1,
             refund_amount = refund_amount + $2,
             refund_reason = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED', amount, reason, orderId]
      );

      await appendAuditLog({
        actorId: initiatedBy,
        actorRole: initiatedBy === 'SYSTEM' ? 'SYSTEM' : 'ADMIN',
        action: 'PAYMENT_REFUNDED',
        entityType: 'PAYMENT_ORDER',
        entityId: orderId,
        payload: { refundAmount: amount, reason, isFullRefund },
        reason,
        client,
      });

      return { refundAmount: amount, transaction: transferResult.transaction, isFullRefund };
    });
  }

  // ─── Payment Order Queries ────────────────────────────────────────
  /**
   * Get payment orders for a user.
   */
  static async getUserPaymentOrders(userId, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const offset = Math.max(Number(options.offset) || 0, 0);

    const result = await query(
      `SELECT id, provider, provider_order_id, amount, currency, purpose, status,
              reference_type, reference_id, failure_reason, refund_amount, refund_reason,
              created_at, updated_at
       FROM payment_orders
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return { orders: result.rows, limit, offset };
  }

  /**
   * Find payment order by provider order ID for webhook processing.
   */
  static async findOrderByProviderOrderId(provider, providerOrderId) {
    const res = await query(
      `SELECT * FROM payment_orders WHERE provider = $1 AND provider_order_id = $2`,
      [provider, providerOrderId]
    );
    return res.rows[0] || null;
  }

  // ─── Admin: Webhook Event History ─────────────────────────────────
  /**
   * Get webhook event history for admin monitoring.
   */
  static async getWebhookEvents(options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
    const offset = Math.max(Number(options.offset) || 0, 0);

    let whereClause = '';
    const params = [];

    if (options.provider) {
      params.push(options.provider);
      whereClause = `WHERE provider = $${params.length}`;
    }

    if (options.status) {
      params.push(options.status);
      whereClause += whereClause ? ` AND processing_status = $${params.length}` : `WHERE processing_status = $${params.length}`;
    }

    params.push(limit, offset);

    const result = await query(
      `SELECT id, provider, event_id, event_type, processing_status, error_message,
              received_at, processed_at, created_at
       FROM webhook_events
       ${whereClause}
       ORDER BY received_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { events: result.rows, limit, offset };
  }

  // ─── Admin: Regional Payment Config ───────────────────────────────
  /**
   * Update regional payment configuration (admin only).
   */
  static async updateRegionalConfig(adminId, regionCode, countryCode, updates) {
    const res = await query(
      `UPDATE regional_payment_config
       SET is_enabled = COALESCE($1, is_enabled),
           kill_switch_on = COALESCE($2, kill_switch_on),
           kill_switch_reason = COALESCE($3, kill_switch_reason),
           max_entry_fee = COALESCE($4, max_entry_fee),
           max_prize_pool = COALESCE($5, max_prize_pool),
           allowed_providers = COALESCE($6, allowed_providers),
           updated_by = $7,
           updated_at = NOW()
       WHERE region_code = $8 AND country_code = $9
       RETURNING *`,
      [
        updates.isEnabled,
        updates.killSwitchOn,
        updates.killSwitchReason,
        updates.maxEntryFee,
        updates.maxPrizePool,
        updates.allowedProviders,
        adminId,
        regionCode,
        countryCode,
      ]
    );

    if (res.rows.length === 0) {
      const err = new Error('Regional config not found');
      err.code = 'REGION_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    await appendAuditLog({
      actorId: adminId,
      actorRole: 'ADMIN',
      action: 'REGIONAL_PAYMENT_CONFIG_UPDATED',
      entityType: 'REGIONAL_PAYMENT_CONFIG',
      entityId: res.rows[0].id,
      payload: { regionCode, countryCode, updates },
      reason: `Regional payment config updated by admin`,
    });

    return res.rows[0];
  }
}
