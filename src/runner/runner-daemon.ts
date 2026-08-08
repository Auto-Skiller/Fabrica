import express, { Express } from 'express';
import {
  runPiAgent,
  runPiAgentStream,
  stopPiAgent,
  listPiDaemons,
  getPiProcessLogs
} from '../core/harness.js';

export interface RunnerDaemonConfig {
  port?: number;
  tenantId?: string;
  storagePath?: string;
}

export function createRunnerApp(config: RunnerDaemonConfig = {}): Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const PORT = config.port || Number(process.env.PORT) || 3000;
  const TENANT_ID = config.tenantId || process.env.TENANT_ID || 'default_user';
  const STORAGE_PATH = config.storagePath || process.env.WORKSPACES_STORAGE_PATH || '/mnt';

  // 1. Basic Health Check Endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      tenantId: TENANT_ID,
      storagePath: STORAGE_PATH,
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // 2. Runner Container Detailed Status Endpoint
  app.get('/api/runner/status', (_req, res) => {
    const daemons = listPiDaemons(TENANT_ID);
    res.json({
      ok: true,
      tenantId: TENANT_ID,
      storagePath: STORAGE_PATH,
      activeDaemonsCount: daemons.length,
      daemons,
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      uptimeSeconds: process.uptime()
    });
  });

  // 3. Agent Turn Streaming Execution Handler (SSE)
  app.post('/api/runner/turn-stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    try {
      await runPiAgentStream({
        ...req.body,
        tenantId: TENANT_ID
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

  // 4. Agent Turn Execution Handler (Synchronous JSON)
  app.post('/api/runner/turn', async (req, res) => {
    try {
      const result = await runPiAgent({
        ...req.body,
        tenantId: TENANT_ID
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 5. List Active Daemons in Container
  app.get('/api/runner/daemons', (_req, res) => {
    const daemons = listPiDaemons(TENANT_ID);
    res.json({ ok: true, daemons });
  });

  // 6. Stop Active Agent Process in Container
  app.post('/api/runner/stop', (req, res) => {
    const { sessionId } = req.body || {};
    const stopped = stopPiAgent(TENANT_ID, sessionId);
    res.json({ ok: stopped, tenantId: TENANT_ID });
  });

  // 7. Get Process Execution Logs in Container
  app.get('/api/runner/logs', (_req, res) => {
    const logs = getPiProcessLogs(TENANT_ID);
    res.json({ ok: true, logs });
  });

  return app;
}

export function startRunnerDaemon(config: RunnerDaemonConfig = {}): void {
  const PORT = config.port || Number(process.env.PORT) || 3000;
  const TENANT_ID = config.tenantId || process.env.TENANT_ID || 'default_user';

  const app = createRunnerApp(config);
  app.listen(PORT, () => {
    console.log(`[Runner Daemon] Dedicated runner container daemon active for tenant ${TENANT_ID} on port ${PORT}`);
  });
}
