import { Router } from 'express';
import { authenticate, authorize } from '../common/auth.middleware.js';
import { AppError } from '../common/errorHandler.js';
import { ComplianceService } from './compliance.service.js';
import {
  UserConsentUpdateSchema,
  GuardianConsentSubmitSchema,
  DataSubjectRequestCreateSchema,
  StatutoryTakedownCreateSchema,
} from '../../../packages/validation/src/index.ts';
import { z } from 'zod';

export const complianceRouter = Router();

// ─── 1. Data Processing Register & Vendors (Public / Transparent) ─────────────

// GET /api/v1/compliance/register
complianceRouter.get('/register', async (req, res, next) => {
  try {
    const register = await ComplianceService.getProcessingRegister();
    res.json({ success: true, count: register.length, data: register });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/compliance/vendors
complianceRouter.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await ComplianceService.listVendors();
    res.json({ success: true, count: vendors.length, data: vendors });
  } catch (err) {
    next(err);
  }
});

// ─── 2. Granular User Consents (Authenticated) ───────────────────────────────

// GET /api/v1/compliance/consents
complianceRouter.get('/consents', authenticate, async (req, res, next) => {
  try {
    const consents = await ComplianceService.getUserConsents(req.user.id);
    res.json({ success: true, data: consents });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/compliance/consents
complianceRouter.post('/consents', authenticate, async (req, res, next) => {
  try {
    const data = UserConsentUpdateSchema.parse(req.body);
    const updated = await ComplianceService.updateUserConsent({
      userId: req.user.id,
      consentType: data.consent_type,
      isGranted: data.is_granted,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── 3. Guardian Consent for Minors (DPDP Act Sec 9) ─────────────────────────

// POST /api/v1/compliance/guardian-consent
complianceRouter.post('/guardian-consent', authenticate, async (req, res, next) => {
  try {
    const data = GuardianConsentSubmitSchema.parse(req.body);
    const record = await ComplianceService.submitGuardianConsent({
      minorUserId: req.user.id,
      guardianName: data.guardian_name,
      guardianEmail: data.guardian_email,
      guardianPhone: data.guardian_phone,
      relationship: data.relationship,
    });
    res.status(201).json({
      success: true,
      message: 'Guardian consent request initiated. A verification link has been sent.',
      data: record,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/compliance/guardian-consent/verify/:token
complianceRouter.get('/guardian-consent/verify/:token', async (req, res, next) => {
  try {
    const verified = await ComplianceService.verifyGuardianConsent(req.params.token);
    res.json({
      success: true,
      message: 'Guardian consent verified successfully.',
      data: verified,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 4. Data Subject Rights (DSR) Workflows ─────────────────────────────────

// POST /api/v1/compliance/dsr
complianceRouter.post('/dsr', authenticate, async (req, res, next) => {
  try {
    const data = DataSubjectRequestCreateSchema.parse(req.body);
    const dsr = await ComplianceService.createDataSubjectRequest({
      userId: req.user.id,
      requestType: data.request_type,
      reason: data.reason,
      requestedChanges: data.requested_changes,
    });
    res.status(201).json({
      success: true,
      message: 'Data Subject Request submitted. SLA acknowledgement generated.',
      data: dsr,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/compliance/dsr/export
complianceRouter.get('/dsr/export', authenticate, async (req, res, next) => {
  try {
    const exportPackage = await ComplianceService.exportUserData(req.user.id);
    res.json({ success: true, data: exportPackage });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/compliance/dsr/erasure
complianceRouter.post('/dsr/erasure', authenticate, async (req, res, next) => {
  try {
    const result = await ComplianceService.executeAccountErasure(req.user.id);
    res.json({
      success: true,
      message: 'Account erasure completed. PII scrubbed; statutory ledger/audit records preserved for mandatory legal periods.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 5. Retention Schedule Disposal Runner (Admin Only) ─────────────────────

// POST /api/v1/compliance/retention/purge
complianceRouter.post('/retention/purge', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req, res, next) => {
  try {
    const report = await ComplianceService.runRetentionDisposalJob();
    res.json({
      success: true,
      message: 'Automated retention disposal purge completed successfully.',
      data: report,
    });
  } catch (err) {
    next(err);
  }
});

// ─── 6. Statutory Grievance & IT Rules 2021 Takedown ─────────────────────────

// GET /api/v1/compliance/grievance
complianceRouter.get('/grievance', (req, res) => {
  const details = ComplianceService.getGrievanceOfficerDetails();
  res.json({ success: true, data: details });
});

// POST /api/v1/compliance/takedown (Public / Any aggrieved party)
complianceRouter.post('/takedown', async (req, res, next) => {
  try {
    const data = StatutoryTakedownCreateSchema.parse(req.body);
    const takedown = await ComplianceService.submitStatutoryTakedown(data);
    res.status(201).json({
      success: true,
      message: 'Statutory takedown complaint recorded. Acknowledged within 24h SLA.',
      data: takedown,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/compliance/takedown/:id/resolve (Admin/Moderator Only)
complianceRouter.post('/takedown/:id/resolve', authenticate, authorize(['SUPER_ADMIN', 'ADMIN', 'MODERATOR']), async (req, res, next) => {
  try {
    const ResolveSchema = z.object({
      action: z.enum(['REMOVED', 'REJECTED']),
      notes: z.string().optional(),
    });
    const parsed = ResolveSchema.parse(req.body);
    const resolved = await ComplianceService.resolveTakedown({
      takedownId: req.params.id,
      adminActorId: req.user.id,
      action: parsed.action,
      notes: parsed.notes,
    });
    res.json({ success: true, data: resolved });
  } catch (err) {
    next(err);
  }
});

// ─── 7. Localisation Catalogs ───────────────────────────────────────────────

// GET /api/v1/compliance/translations/:locale
complianceRouter.get('/translations/:locale', (req, res) => {
  const catalog = ComplianceService.getTranslations(req.params.locale);
  res.json({ success: true, data: catalog });
});
