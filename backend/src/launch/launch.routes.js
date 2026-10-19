import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { LaunchService } from './launch.service.js';
import {
  RegionalRolloutUpdateSchema,
  EnablePaidFeaturesSchema,
  TransparencyReportPublishSchema,
  DoDItemCertifySchema,
} from '../../../packages/validation/src/index.ts';

export const launchRouter = Router();

// ─── 1. Public Transparency Reports (Open to All Players & Public) ───────────

// GET /api/v1/launch/transparency/latest
launchRouter.get('/transparency/latest', async (_req, res, next) => {
  try {
    const report = await LaunchService.getLatestTransparencyReport();
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/launch/transparency
launchRouter.get('/transparency', async (_req, res, next) => {
  try {
    const reports = await LaunchService.listTransparencyReports();
    res.json({ success: true, count: reports.length, data: reports });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/launch/transparency (Admin Only)
launchRouter.post(
  '/transparency',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN']),
  async (req, res, next) => {
    try {
      const data = TransparencyReportPublishSchema.parse(req.body);
      const report = await LaunchService.publishTransparencyReport(
        data,
        req.user?.username || req.user?.id || 'Vexora Trust & Safety Board'
      );
      res.status(201).json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  }
);

// ─── 2. Section 52 Final Definition of Done (DoD) Certification ─────────────

// GET /api/v1/launch/dod
launchRouter.get('/dod', async (_req, res, next) => {
  try {
    const status = await LaunchService.getFinalDefinitionOfDoneStatus();
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/launch/dod/:key/certify (Admin Only)
launchRouter.post(
  '/dod/:key/certify',
  authenticate,
  authorize(['SUPER_ADMIN']),
  async (req, res, next) => {
    try {
      const data = DoDItemCertifySchema.parse({
        ...req.body,
        item_key: req.params.key,
      });
      const item = await LaunchService.certifyDoDItem(
        req.params.key,
        data,
        req.user?.username || req.user?.id || 'SUPER_ADMIN'
      );
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }
);

// ─── 3. Regional Gating & Staged Rollout ─────────────────────────────────────

// GET /api/v1/launch/regions
launchRouter.get('/regions', async (_req, res, next) => {
  try {
    const configs = await LaunchService.listRegionalConfigs();
    res.json({ success: true, count: configs.length, data: configs });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/launch/regions/:code
launchRouter.get('/regions/:code', async (req, res, next) => {
  try {
    const config = await LaunchService.getRegionalConfig(req.params.code);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/launch/regions/:code/rollout (Admin Only)
launchRouter.post(
  '/regions/:code/rollout',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN']),
  async (req, res, next) => {
    try {
      const data = RegionalRolloutUpdateSchema.parse(req.body);
      const updated = await LaunchService.updateRegionalRollout(
        req.params.code,
        data,
        req.user?.username || req.user?.id || 'ADMIN'
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/launch/regions/:code/enable-paid (Security Gate: Super Admin & Legal Sign-off)
launchRouter.post(
  '/regions/:code/enable-paid',
  authenticate,
  authorize(['SUPER_ADMIN']),
  async (req, res, next) => {
    try {
      const data = EnablePaidFeaturesSchema.parse(req.body);
      const updated = await LaunchService.enablePaidFeaturesForRegion(
        req.params.code,
        data,
        req.user?.username || req.user?.id || 'SUPER_ADMIN'
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/launch/regions/:code/disable-paid (Emergency Regional Kill-switch)
launchRouter.post(
  '/regions/:code/disable-paid',
  authenticate,
  authorize(['SUPER_ADMIN', 'ADMIN']),
  async (req, res, next) => {
    try {
      const { reason } = req.body;
      const updated = await LaunchService.disablePaidFeaturesForRegion(
        req.params.code,
        reason || 'Emergency regional kill-switch triggered',
        req.user?.username || req.user?.id || 'ADMIN'
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);
