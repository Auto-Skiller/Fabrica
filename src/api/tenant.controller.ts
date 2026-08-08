import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  getTenantProfile,
  updateTenantProfile,
  getTenantTelemetry,
  getTenantAuditLogs,
  appendTenantAuditLog,
  isTenantInitialized,
  initializeUserTenant,
  isAgentInitialized,
  startUserAgent
} from '../core/tenant.js';

const router = Router();

// GET /api/tenant/init-status — Get tenant workspace & agent initialization status
router.get('/init-status', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || (req.query?.tenantId as string);
  const initialized = isTenantInitialized(tenantId!);
  const agentInitialized = isAgentInitialized(tenantId!);
  res.json({ ok: true, initialized, agentInitialized, tenantId });
});

// POST /api/tenant/initialize — First time Directory Creation
router.post('/initialize', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || req.body?.tenantId;
  try {
    const result = initializeUserTenant(tenantId!);
    res.json({ initialized: true, message: 'Directory Creation completed', ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'Failed to initialize user directory' });
  }
});

// POST /api/tenant/start-agent — Trigger agent targeting tenant directory (cwd: userRoot), then check .pi/ and create skills/
router.post('/start-agent', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || req.body?.tenantId;
  try {
    const result = await startUserAgent(tenantId!);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, agentInitialized: false, error: err.message || 'Failed to start agent' });
  }
});

// GET /api/tenant/profile — Get tenant profile
router.get('/profile', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const profile = getTenantProfile(tenantId);
  res.json({ ok: true, profile });
});

// POST /api/tenant/profile — Update tenant profile
router.post('/profile', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const updates = req.body || {};
  const updated = updateTenantProfile(tenantId, updates);
  res.json({ ok: true, profile: updated });
});

// GET /api/tenant/telemetry — Get system usage telemetry
router.get('/telemetry', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const telemetry = getTenantTelemetry(tenantId);
  res.json({ ok: true, telemetry });
});

// GET /api/tenant/logs — Get audit event logs
router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
  const logs = getTenantAuditLogs(tenantId);
  res.json({ ok: true, events: logs });
});

// POST /api/tenant/logs/event — Append audit log event
router.post('/logs/event', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId!;
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
