/**
 * Vexora Esports Tournament Platform — Webhook Routes (Enhanced)
 *
 * Phase 27: Payments, Prize Escrow & Paid Tournament Flow
 * PDF refs: Sections 9, 26, 39 (Phase 6)
 *
 * Implements:
 * - Signed webhooks with timestamp + event-ID deduplication (webhook_events table)
 * - Client NEVER confirms payment; only signed webhooks do
 * - Idempotency keys on webhook processing
 * - Razorpay and Cashfree webhook signature verification
 */

import express, { Router } from 'express';
import crypto from 'crypto';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';
import { PaymentService } from '../payments/payment.service.js';

export const webhooksRouter = Router();

// ─── POST /razorpay — Razorpay payment webhook ──────────────────────────
webhooksRouter.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (!secret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR' } });
    }

    // 1. Verify HMAC-SHA256 signature
    if (!PaymentService.verifyWebhookSignature(rawBody, signature, secret)) {
      logger.warn('Razorpay webhook signature verification failed', {
        ip: req.ip,
        signature: signature?.substring(0, 8) + '...',
      });

      // Record invalid signature attempt
      await PaymentService.recordWebhookEvent({
        provider: 'RAZORPAY',
        eventId: `invalid-${Date.now()}`,
        eventType: 'INVALID_SIGNATURE',
        payload: {},
        signature,
        ipAddress: req.ip,
      }).catch(() => {});

      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE' } });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 2. Timestamp replay check
    if (event.created_at && !PaymentService.isWebhookTimestampValid(event.created_at)) {
      logger.warn('Razorpay webhook replay detected (stale timestamp)', { eventId: event.event });
      return res.status(400).json({ success: false, error: { code: 'REPLAY_DETECTED' } });
    }

    // 3. Event-ID deduplication
    const eventId = event.payload?.payment?.entity?.id || event.event || `rp-${Date.now()}`;
    const { isDuplicate, webhookEvent } = await PaymentService.recordWebhookEvent({
      provider: 'RAZORPAY',
      eventId: `${event.event}-${eventId}`,
      eventType: event.event,
      payload: event,
      signature,
      ipAddress: req.ip,
    });

    if (isDuplicate) {
      logger.info(`Razorpay webhook duplicate skipped: ${event.event}/${eventId}`);
      return res.json({ success: true, received: true, duplicate: true });
    }

    // 4. Process event
    try {
      switch (event.event) {
        case 'payment.captured': {
          const paymentEntity = event.payload?.payment?.entity;
          if (paymentEntity) {
            const order = await PaymentService.findOrderByProviderOrderId(
              'RAZORPAY',
              paymentEntity.order_id
            );
            if (order) {
              await PaymentService.confirmPayment(order.id, paymentEntity.id, webhookEvent.id);
            } else {
              logger.warn('Razorpay payment.captured: no matching order', { orderId: paymentEntity.order_id });
            }
          }
          break;
        }

        case 'payment.failed': {
          const paymentEntity = event.payload?.payment?.entity;
          if (paymentEntity) {
            const order = await PaymentService.findOrderByProviderOrderId(
              'RAZORPAY',
              paymentEntity.order_id
            );
            if (order) {
              await PaymentService.failPayment(
                order.id,
                paymentEntity.error_description || 'Payment failed',
                webhookEvent.id
              );
            }
          }
          break;
        }

        case 'refund.processed': {
          const refundEntity = event.payload?.refund?.entity;
          if (refundEntity) {
            const order = await PaymentService.findOrderByProviderOrderId(
              'RAZORPAY',
              refundEntity.payment_id
            );
            if (order) {
              await PaymentService.processRefund(
                order.id,
                Number(refundEntity.amount) / 100, // Razorpay amounts in paise
                'Razorpay refund processed',
                'SYSTEM',
                `rp-refund-${refundEntity.id}`
              );
            }
          }
          break;
        }

        default:
          logger.info(`Unhandled Razorpay event: ${event.event}`);
      }

      await PaymentService.updateWebhookStatus(webhookEvent.id, 'PROCESSED');
    } catch (processErr) {
      logger.error('Razorpay webhook processing error', { error: processErr.message, eventId });
      await PaymentService.updateWebhookStatus(webhookEvent.id, 'FAILED', processErr.message);
    }

    res.json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /cashfree — Cashfree payout webhook ───────────────────────────
webhooksRouter.post('/cashfree', async (req, res, next) => {
  try {
    const signature = req.headers['x-cashfree-signature'];
    const secret = process.env.CASHFREE_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('CASHFREE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR' } });
    }

    if (!PaymentService.verifyWebhookSignature(req.body, signature, secret)) {
      logger.warn('Cashfree webhook signature verification failed');
      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE' } });
    }

    // Event-ID deduplication
    const eventId = req.body.transferId || req.body.event_id || `cf-${Date.now()}`;
    const { isDuplicate, webhookEvent } = await PaymentService.recordWebhookEvent({
      provider: 'CASHFREE',
      eventId: `${req.body.type}-${eventId}`,
      eventType: req.body.type,
      payload: req.body,
      signature,
      ipAddress: req.ip,
    });

    if (isDuplicate) {
      return res.json({ success: true, received: true, duplicate: true });
    }

    try {
      switch (req.body.type) {
        case 'TRANSFER_SUCCESS':
          // Payout settled — mark in payout queue
          logger.info('Cashfree payout success', { transferId: eventId });
          break;

        case 'TRANSFER_FAILED':
          logger.warn('Cashfree payout failed', { transferId: eventId });
          break;

        case 'TRANSFER_REVERSED':
          logger.warn('Cashfree payout reversed', { transferId: eventId });
          break;

        default:
          logger.info(`Unhandled Cashfree event: ${req.body.type}`);
      }

      await PaymentService.updateWebhookStatus(webhookEvent.id, 'PROCESSED');
    } catch (processErr) {
      await PaymentService.updateWebhookStatus(webhookEvent.id, 'FAILED', processErr.message);
    }

    res.json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /firebase — Firebase webhook (FCM delivery receipts, etc.) ────
webhooksRouter.post('/firebase', async (req, res, next) => {
  try {
    logger.info('Firebase webhook received', { type: req.body.type });

    await PaymentService.recordWebhookEvent({
      provider: 'FIREBASE',
      eventId: req.body.event_id || `fb-${Date.now()}`,
      eventType: req.body.type || 'UNKNOWN',
      payload: req.body,
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
});
