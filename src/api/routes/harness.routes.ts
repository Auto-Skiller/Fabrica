import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
  runPiAgent,
  runPiAgentStream,
  stopPiAgent,
  listPiDaemons,
  listPiSessions,
  createPiSession,
  deletePiSession,
  listPiModels,
  getPiProcessLogs,
  ensureUserHarness,
  getHarnessState,
  updateHarnessState,
  appendUserAction,
  removeReviewItem,
  setReviewItemFeedback
} from '../../core/harness.js';

const router = Router();

// POST /api/harness/run-stream — Stream prompt execution via SSE
router.post('/run-stream', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { prompt, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel } = req.body || {};

  if (!prompt) {
    res.status(400).json({ ok: false, error: 'Prompt is required.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof (res as any).flushHeaders === 'function') {
    (res as any).flushHeaders();
  }

  try {
    await runPiAgentStream({
      prompt,
      tenantId,
      sessionId,
      model,
      customKey,
      agentLang,
      webSearchEnabled,
      thinkingLevel
    }, (chunkData: string) => {
      res.write(chunkData);
    });
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ ok: false, error: err.message, text: err.message })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// POST /api/harness/run — Run prompt with Pi agent
router.post('/run', async (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { prompt, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel } = req.body || {};

  if (!prompt) {
    res.status(400).json({ ok: false, error: 'Prompt is required.' });
    return;
  }

  try {
    const response = await runPiAgent({
      prompt,
      tenantId,
      sessionId,
      model,
      customKey,
      agentLang,
      webSearchEnabled,
      thinkingLevel
    });

    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      ok: false,
      text: `Execution failed: ${err.message}`,
      error: err.message
    });
  }
});

// GET /api/harness/daemons — List active daemon process(es)
router.get('/daemons', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const daemons = listPiDaemons(tenantId);
  res.json({ ok: true, daemons });
});

// POST /api/harness/stop — Stop active agent process
router.post('/stop', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { sessionId } = req.body || {};
  const stopped = stopPiAgent(tenantId, sessionId);
  res.json({ ok: stopped });
});

// GET /api/harness/sessions — List sessions
router.get('/sessions', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const sessions = listPiSessions(tenantId);
  res.json({ ok: true, sessions });
});

// POST /api/harness/sessions/create — Create new session
router.post('/sessions/create', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { name } = req.body || {};
  const session = createPiSession(tenantId, name);
  res.json({ ok: true, session });
});

// POST /api/harness/sessions/delete — Delete session
router.post('/sessions/delete', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { sessionId } = req.body || {};
  if (!sessionId) {
    res.status(400).json({ ok: false, error: 'sessionId is required.' });
    return;
  }
  const deleted = deletePiSession(tenantId, sessionId);
  res.json({ ok: deleted });
});

// GET /api/harness/models — List available LLM models
router.get('/models', (req: AuthenticatedRequest, res: Response) => {
  const models = listPiModels();
  res.json({ ok: true, models });
});

// GET /api/harness/logs — Get process execution logs
router.get('/logs', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const logs = getPiProcessLogs(tenantId);
  res.json({ ok: true, logs });
});

// GET /api/harness/config — Get harness config
router.get('/config', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const info = ensureUserHarness(tenantId);
  res.json({ ok: true, config: info.config });
});

// GET /api/harness/state — Get harness realtime json state
router.get('/state', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const state = getHarnessState(tenantId);
  res.json({ ok: true, harness: state });
});

// POST /api/harness/state — Update harness realtime json state
router.post('/state', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const updates = req.body || {};
  const updated = updateHarnessState(tenantId, updates);
  res.json({ ok: true, harness: updated });
});

// POST /api/harness/user-action — Append a user action to new_user_actions in harness.json
router.post('/user-action', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { category, action } = req.body || {};
  if (!category || !action) {
    res.status(400).json({ ok: false, error: 'category and action are required.' });
    return;
  }
  appendUserAction(tenantId, category, action);
  res.json({ ok: true });
});

// POST /api/harness/reviews/ignore — Remove a pending review item
router.post('/reviews/ignore', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { itemId } = req.body || {};
  if (!itemId) { res.status(400).json({ ok: false, error: 'itemId is required.' }); return; }
  removeReviewItem(tenantId, itemId);
  res.json({ ok: true });
});

// POST /api/harness/reviews/feedback — Set feedback on review item (marks as reviewed)
router.post('/reviews/feedback', (req: AuthenticatedRequest, res: Response) => {
  const tenantId = req.tenantId || 'default_user';
  const { itemId, feedback } = req.body || {};
  if (!itemId) { res.status(400).json({ ok: false, error: 'itemId is required.' }); return; }
  setReviewItemFeedback(tenantId, itemId, feedback || '');
  res.json({ ok: true });
});

export default router;
