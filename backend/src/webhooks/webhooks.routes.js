import express, { Router } from 'express';
import crypto from 'crypto';
import { AppError } from '../common/errorHandler.js';
import { logger } from '../common/logger.js';

export const webhooksRouter = Router();

/**
 * Webhook signature verification for payment gateway callbacks.
 * Supports Razorpay and Cashfree HMAC-SHA256 signatures.
 */
function verifyWebhookSignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''));
}

// ─── POST /razorpay — Razorpay payment webhook ──────────────────────────
webhooksRouter.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('RAZORPAY_WEBHOOK_SECRET not configured');
      return res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR' } });
    }

    if (!verifyWebhookSignature(req.body, signature, secret)) {
      logger.warn('Razorpay webhook signature verification failed');
      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE' } });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    logger.info('Razorpay webhook received', { event: event.event, paymentId: event.payload?.payment?.entity?.id });

    switch (event.event) {
      case 'payment.captured':
        // TODO: Process deposit confirmation
        break;
      case 'payment.failed':
        // TODO: Handle failed payment
        break;
      case 'refund.processed':
        // TODO: Process refund
        break;
      default:
        logger.info(`Unhandled Razorpay event: ${event.event}`);
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

    if (!verifyWebhookSignature(req.body, signature, secret)) {
      logger.warn('Cashfree webhook signature verification failed');
      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE' } });
    }

    logger.info('Cashfree webhook received', { event: req.body.type });

    switch (req.body.type) {
      case 'TRANSFER_SUCCESS':
        // TODO: Mark payout as settled
        break;
      case 'TRANSFER_FAILED':
        // TODO: Handle failed payout, trigger retry or manual review
        break;
      case 'TRANSFER_REVERSED':
        // TODO: Handle reversed payout
        break;
      default:
        logger.info(`Unhandled Cashfree event: ${req.body.type}`);
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
    // TODO: Process Firebase webhook events
    res.json({ success: true, received: true });
  } catch (err) {
    next(err);
  }
});
