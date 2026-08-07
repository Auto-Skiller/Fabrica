import express from 'express';
import { runPiAgent, runPiAgentStream } from '../core/harness.js';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const TENANT_ID = process.env.TENANT_ID || 'default_user';

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', tenantId: TENANT_ID }));

// Agent Turn Streaming Execution Handler (SSE)
app.post('/api/runner/turn-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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

// Agent Turn Execution Handler (Synchronous JSON)
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

app.listen(PORT, () => {
  console.log(`[User Runner Container] Dedicated runner active for tenant ${TENANT_ID} on port ${PORT}`);
});

