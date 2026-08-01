import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  getMissions,
  createMission,
  updateMission,
  deleteMission,
  getMissionSchema,
  orchestrator
} from '../../core/missions.js';

const router = Router();

// GET /api/missions — List all missions
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const missions = getMissions(tenantId);
  res.json({ ok: true, missions });
});

// POST /api/missions/create — Create new mission
router.post('/create', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { title, objective, type } = req.body || {};
  if (!title || !objective) {
    res.status(400).json({ ok: false, error: 'Title and objective are required.' });
    return;
  }
  const mission = createMission(tenantId, { title, objective, type });
  res.json({ ok: true, mission });
});

// POST /api/missions/update — Update mission
router.post('/update', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { id, ...updates } = req.body || {};
  if (!id) {
    res.status(400).json({ ok: false, error: 'Mission ID is required.' });
    return;
  }
  const updated = updateMission(tenantId, id, updates);
  if (!updated) {
    res.status(404).json({ ok: false, error: 'Mission not found.' });
    return;
  }
  res.json({ ok: true, mission: updated });
});

// POST /api/missions/delete — Delete mission
router.post('/delete', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ ok: false, error: 'Mission ID is required.' });
    return;
  }
  const deleted = deleteMission(tenantId, id);
  res.json({ ok: deleted });
});

// GET /api/missions/schema — Get mission schema definition
router.get('/schema', (req: AuthenticatedRequest, res: Response) => {
  const type = (req.query.type as string) || 'standard';
  const schema = getMissionSchema(type);
  res.json({ ok: true, schema });
});

// GET /api/missions/orchestrator/status — Get pipeline orchestrator queue status
router.get('/orchestrator/status', (req: AuthenticatedRequest, res: Response) => {
  const report = orchestrator.getStatusReport();
  res.json({ ok: true, orchestrator: report });
});

export default router;
