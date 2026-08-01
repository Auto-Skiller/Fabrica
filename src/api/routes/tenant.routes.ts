import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  getTenantProfile,
  updateTenantProfile,
  getTenantTelemetry,
  getTenantAuditLogs,
  appendTenantAuditLog
} from '../../core/tenant.js';

const router = Router();

// GET /api/tenant/profile — Get tenant profile
router.get('/profile', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const profile = getTenantProfile(tenantId);
  res.json({ ok: true, profile });
});

// POST /api/tenant/profile — Update tenant profile
router.post('/profile', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const updates = req.body || {};
  const updated = updateTenantProfile(tenantId, updates);
  res.json({ ok: true, profile: updated });
});

// GET /api/tenant/telemetry — Get system usage telemetry
router.get('/telemetry', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const telemetry = getTenantTelemetry(tenantId);
  res.json({ ok: true, telemetry });
});

// GET /api/tenant/logs — Get audit event logs
router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const logs = getTenantAuditLogs(tenantId);
  res.json({ ok: true, events: logs });
});

// POST /api/tenant/logs/event — Append audit log event
router.post('/logs/event', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { type, event, details, mission_id } = req.body || {};
  if (!event) {
    res.status(400).json({ ok: false, error: 'Event title is required.' });
    return;
  }
  const entry = appendTenantAuditLog(tenantId, {
    type: type || 'system',
    event,
    details,
    mission_id
  });
  res.json({ ok: true, entry });
});

export default router;
