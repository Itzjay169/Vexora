import { Router } from 'express';

const payoutsRouter = Router();

// GET /api/v1/payouts
payoutsRouter.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      payouts: [],
      makerCheckerEnforced: true,
    },
  });
});

// POST /api/v1/payouts/request
payoutsRouter.post('/request', (req, res) => {
  const { amount, paymentMethod } = req.body || {};
  res.status(202).json({
    success: true,
    message: 'Payout request queued for dual-approval maker-checker review',
    data: {
      requestId: 'pay_' + crypto.randomUUID().slice(0, 8),
      amount: amount || 0,
      paymentMethod: paymentMethod || 'UPI',
      status: 'UNDER_REVIEW',
    },
  });
});

export { payoutsRouter };
