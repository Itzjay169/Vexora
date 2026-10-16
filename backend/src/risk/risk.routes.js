import { Router } from 'express';

const riskRouter = Router();

// GET /api/v1/risk/signals
riskRouter.get('/signals', (req, res) => {
  res.json({
    success: true,
    data: {
      signals: [
        'COLLUSION_PATTERN',
        'RAPID_ACCOUNT_CREATION',
        'DEVICE_FINGERPRINT_CLUSTERING',
        'IMPOSSIBLE_SCORE_VELOCITY',
      ],
      autoBanEnforced: false, // Per Section 19: Never auto-ban; flag for human review
    },
  });
});

// POST /api/v1/risk/evaluate
riskRouter.post('/evaluate', (req, res) => {
  const { userId, signal } = req.body || {};
  res.json({
    success: true,
    data: {
      userId,
      signal,
      riskScore: 35, // 0-100 scale
      recommendation: 'REVIEW_QUEUE',
    },
  });
});

export { riskRouter };
