import express from 'express';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from './src/api/middlewares/auth.middleware.js';
import { errorMiddleware } from './src/api/middlewares/error.middleware.js';

import authRouter from './src/api/routes/auth.routes.js';
import tenantRouter from './src/api/routes/tenant.routes.js';
import workspaceRouter from './src/api/routes/workspace.routes.js';
import missionsRouter from './src/api/routes/missions.routes.js';
import harnessRouter from './src/api/routes/harness.routes.js';

import { ensureUserHarness } from './src/core/harness.js';
import { syncMissionsJson } from './src/core/missions.js';
import { syncTenantWorkspace } from './src/core/workspace.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ── Global Body Parsers ────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Tenant Auth Context Middleware ──────────────────────────────────────────────
app.use(authMiddleware);

// ── Primary Express API Router Mounts ───────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/tenant', tenantRouter);
app.use('/api/workspace', workspaceRouter);
app.use('/api/missions', missionsRouter);
app.use('/api/harness', harnessRouter);

// ── Legacy Route Aliases for Backward Compatibility ──────────────────────────────
app.use('/api/key-pool', authRouter);
app.use('/api/pi', harnessRouter);
app.use('/api/storage', workspaceRouter);
app.use('/api/mission', missionsRouter);

// ── Serve Next.js Frontend Static Exports ────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const outDir = path.join(process.cwd(), 'frontend-next', 'out');
  if (!fs.existsSync(outDir)) {
    return res.status(503).send('<html><head><meta http-equiv="refresh" content="3"></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Frontend is building...</h2><p>This page will automatically refresh once the build completes.</p></body></html>');
  }
  express.static(outDir, { extensions: ['html'] })(req, res, () => {
    const indexPath = path.join(outDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
});

// ── Error Handling Middleware ──────────────────────────────────────────────────
app.use(errorMiddleware);

// ── Daemon Workspace Sync Cycle Interval ───────────────────────────────────────
setInterval(() => {
  try {
    syncTenantWorkspace('default_user');
    syncMissionsJson('default_user');
  } catch (err: any) {
    console.error(`[Daemon Sync] Error in background sync cycle: ${err.message}`);
  }
}, 5000);

// ── Server Listener Startup ────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Fabrica Engine] Modular core harness active. Listening on http://0.0.0.0:${PORT}`);
  try {
    ensureUserHarness('default_user');
    syncTenantWorkspace('default_user');
    syncMissionsJson('default_user');
  } catch (err: any) {
    console.error(`[Daemon Sync] Error in initial setup: ${err.message}`);
  }
});
