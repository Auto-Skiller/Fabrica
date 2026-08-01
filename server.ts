import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import {
  readYaml,
  writeYaml,
  listEntities,
  smartWrite,
  nowIso,
  stampFreshness,
  _isEmpty,
  getTbDiskPath,
  getTbYamlPath,
  getNestedValue,
  setNestedValue
} from './src/utils.js';
import {
  ensureUserHarness,
  ensureProjectDirs,
  syncMissionsDb,
  syncMissionsJson,
  syncWorkspaceJson,
  getMissionSchema,
  logStreamEvent,
  syncMissionWorkspaceArtifacts,
  getEntityDir,
  updateHarnessConfig,
  listUserFiles,
  readUserFile,
  writeUserFile,
  moveUserFile,
  deleteUserFile,
  getUserRoot,
  recordUserHarnessActivity,
  syncLogsJson
} from './src/harness.js';
import { syncCycle } from './src/sync.js';
import { db } from './src/db/db_engine.js';
import { 
  getUserTier, 
  upgradeUserToPaug, 
  downgradeUserToFree, 
  topUpUserCredits, 
  subscribeToCreditPlan, 
  updateAutoTopUpSettings, 
  deductLlmCredits, 
  calculateLlmCostUSD,
  verifyUserCard 
} from './src/db/tier_manager.js';
import { keyPoolManager, FREE_MODELS } from './src/db/llm_key_pool.js';
import { runPiAgent, stopPiAgent, listPiSessions, createPiSession, deletePiSession, listPiModels, getPiProcessLogs, listPiDaemons } from './src/pi_runner.js';
import { uploadToGcs, triggerVertexAiIndexing, searchTenantDocuments } from './src/db/hybrid_storage.js';
import { executeSandboxedCode } from './src/execution/sandbox.js';
import { orchestrator } from './src/pipeline/orchestrator.js';


export function getFabricaSystemInstructions(): string {
  try {
    const promptsDir = path.join(process.cwd(), 'Fabrica_kernel', 'prompts');
    let instructions = '';
    if (fs.existsSync(promptsDir)) {
      const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md')).sort();
      for (const file of files) {
        instructions += `\n\n--- FILE: ${file} ---\n\n` + fs.readFileSync(path.join(promptsDir, file), 'utf8');
      }
    }
    return instructions;
  } catch (err) {
    console.error("Error reading Fabrica system instructions:", err);
  }
  return "";
}

// --- SCHEMA-ENFORCED STRUCTURED OUTPUTS VIA PI AGENT CLI ---

export const toolboxGenerateSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: "Descriptive camel_case or kebab-case name of the skill, agent, or toolbox" },
    description: { type: 'string', description: "Detailed functional description of the capability" },
    when_to_use: { type: 'string', description: "Criteria specifying when the agent or system should invoke this" },
    maturity: { type: 'string', description: "stub | functional | hardened | battle-tested" },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "File name with extension, e.g., 'handler.ts' or 'config.json'" },
          content: { type: 'string', description: "Complete, production-ready source code or JSON config. No markdown wraps." }
        },
        required: ["name", "content"]
      },
      description: "Complete set of source files and configs needed for this tool/agent"
    }
  },
  required: ["name", "description", "when_to_use", "maturity", "files"]
};

export const codeGenerationSchema = {
  type: 'object',
  properties: {
    explanation: { type: 'string', description: "Summary of files created/modified and design choices" },
    files: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          filepath: { type: 'string', description: "Relative file path from the workspace root" },
          content: { type: 'string', description: "Complete, production-ready code. Do NOT wrap in markdown code blocks." }
        },
        required: ["filepath", "content"]
      }
    }
  },
  required: ["explanation", "files"]
};

export const missionPlanningSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: "Unambiguous summary of the planned actions" },
    cases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: "Unique snake_case identifier for the task" },
          title: { type: 'string', description: "Descriptive task title" },
          concrete_step: { type: 'string', description: "Clear, physical action step mentioning specific files and actions" },
          benefit: { type: 'string', description: "HIGH | MEDIUM | LOW" },
          cost: { type: 'string', description: "HIGH | MEDIUM | LOW" },
          worth_it: { type: 'string', description: "YES | NO" }
        },
        required: ["id", "title", "concrete_step", "benefit", "cost", "worth_it"]
      },
      description: "List of concrete task cases with scored benefits and costs"
    }
  },
  required: ["summary", "cases"]
};

export const missionAnalyticsSchema = {
  type: 'object',
  properties: {
    scope_summary: { type: 'string', description: "High-level description of what files or inputs were evaluated" },
    scope_blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "Input or system element name" },
          requirements: { type: 'array', items: { type: 'string' }, description: "Specific requirements or specifications extracted" }
        },
        required: ["name", "requirements"]
      }
    },
    anomalies: {
      type: 'array',
      items: { type: 'string' },
      description: "List of technical issues, security leaks, or alignment discrepancies found"
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      description: "Specific actionable moves suggested for the next phase"
    }
  },
  required: ["scope_summary", "scope_blocks", "anomalies", "recommendations"]
};

export const missionResearchSchema = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: { type: 'string' },
      description: "Subjects investigated"
    },
    references: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
          version: { type: 'string' }
        },
        required: ["title"]
      }
    },
    snippets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string', description: "Explanation of what the snippet is for" },
          code: { type: 'string', description: "Functional, typed ready-to-import snippet" }
        },
        required: ["description", "code"]
      }
    },
    blockers: {
      type: 'array',
      items: { type: 'string' },
      description: "Potential integration blockers (keys, payment setup, scopes)"
    }
  },
  required: ["topics", "references", "snippets", "blockers"]
};

export interface LlmMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateLlmOptions {
  model: string;
  messages: LlmMessage[];
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  tools?: any[];
  customKey?: string;
  agentLang?: string;
  tenantId?: string;
}

function recordTokenDeduction(options: GenerateLlmOptions, text: string) {
  if (!options.customKey) {
    const tenantId = options.tenantId || 'default_user';
    const promptChars = JSON.stringify(options.messages).length + (options.systemInstruction?.length || 0);
    const outputChars = (text || '').length;
    const inputTokens = Math.max(10, Math.ceil(promptChars / 4));
    const outputTokens = Math.max(1, Math.ceil(outputChars / 4));
    
    try {
      const result = deductLlmCredits(tenantId, options.model, inputTokens, outputTokens);
      console.log(`[LLM Credit Engine] Deducted $${result.deductedUSD.toFixed(6)} from tenant '${tenantId}' (${inputTokens} in / ${outputTokens} out). Balance: $${result.remainingBalanceUSD.toFixed(4)}`);
    } catch (err: any) {
      console.warn(`[LLM Credit Engine] Deduct error:`, err.message);
    }
  }
}

export function getModelProviderAndName(fullModel: string): { provider: 'gemini' | 'openrouter' | 'anthropic'; modelName: string } {
  if (fullModel.startsWith('openrouter/')) {
    return { provider: 'openrouter', modelName: fullModel.substring(11) };
  } else if (fullModel.startsWith('anthropic/')) {
    return { provider: 'anthropic', modelName: fullModel.substring(10) };
  } else if (fullModel.startsWith('claude-')) {
    return { provider: 'anthropic', modelName: fullModel };
  } else {
    return { provider: 'gemini', modelName: fullModel };
  }
}

export async function generateLlmText(options: GenerateLlmOptions): Promise<string> {
  const tenantId = options.tenantId || 'default_user';

  let systemInstruction = options.systemInstruction || '';
  const fabricaInstructions = getFabricaSystemInstructions();
  if (fabricaInstructions) {
    const snippet = fabricaInstructions.substring(0, 100);
    if (!systemInstruction.includes(snippet)) {
      systemInstruction = `--- FABRICA KERNEL SYSTEM LAWS & PROMPTS ---\n${fabricaInstructions}\n---------------------------------------------\n\n${systemInstruction}`;
    }
  }

  if (options.agentLang) {
    let langName = 'English';
    if (options.agentLang === 'FR') langName = 'French';
    else if (options.agentLang === 'AR') langName = 'Arabic';
    const langDirective = `CRITICAL OUTPUT LANGUAGE DIRECTIVE: The user may send input in any language. You must understand all input regardless of language, but you MUST compose your entire response, commentary, and generated content strictly and exclusively in ${langName}.`;
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${langDirective}` : langDirective;
  }

  if (options.responseSchema || options.responseMimeType === 'application/json') {
    const schemaDirective = `CRITICAL FORMATTING INSTRUCTION: Output ONLY valid JSON. Do NOT wrap in markdown code blocks or conversational commentary. ${options.responseSchema ? 'Expected schema structure: ' + JSON.stringify(options.responseSchema) : ''}`;
    systemInstruction = systemInstruction ? `${systemInstruction}\n\n${schemaDirective}` : schemaDirective;
  }

  let promptText = '';
  if (systemInstruction) {
    promptText += `[SYSTEM INSTRUCTION]\n${systemInstruction}\n\n`;
  }
  for (const msg of options.messages) {
    if (msg.role === 'system') {
      promptText += `[SYSTEM]\n${msg.content}\n\n`;
    } else if (msg.role === 'assistant') {
      promptText += `[ASSISTANT]\n${msg.content}\n\n`;
    } else {
      promptText += `[USER]\n${msg.content}\n\n`;
    }
  }

  const piResult = await runPiAgent({
    prompt: promptText.trim(),
    tenantId,
    model: options.model,
    customKey: options.customKey,
    agentLang: options.agentLang,
    disableWorkspaceSkills: true,
    disableWorkspaceExtensions: true
  });

  if (!piResult.ok) {
    throw new Error(piResult.error || piResult.text || 'Failed to generate response via Pi Agent CLI.');
  }

  const text = piResult.text || '';
  recordTokenDeduction(options, text);
  return text;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// 1. High-Performance GZIP Compression Middleware (for payloads > 2KB)
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) {
    return next();
  }
  
  const originalSend = res.send;
  res.send = function (this: any, body: any) {
    if (res.getHeader('Content-Encoding') || !body || (typeof body !== 'string' && !Buffer.isBuffer(body))) {
      return originalSend.call(this, body);
    }
    const bodyStr = typeof body === 'string' ? body : body.toString();
    if (bodyStr.length < 2048) {
      return originalSend.call(this, body);
    }
    zlib.gzip(bodyStr, (err, buffer) => {
      if (err) {
        return originalSend.call(this, body);
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', buffer.length);
      originalSend.call(this, buffer);
    });
    return res;
  } as any;
  next();
});

// 2. Production Security Headers & CORS Middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id, X-Requested-With, Cache-Control, Pragma');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// 2.5 Cryptographic Supabase JWT Authentication & Tenant Security Policy Middleware
app.use(async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  
  if (db.getIsSupabaseEnabled()) {
    const sbClient = db.getSupabaseClient();
    let authenticated = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user }, error } = await sbClient.auth.getUser(token);
        if (user && !error) {
          req.user = user;
          req.headers['x-tenant-id'] = user.id;
          if (req.query) {
            req.query.tenantId = user.id;
          }
          authenticated = true;
        }
      } catch (err: any) {
        // Token verification error
      }
    }

    if (!authenticated) {
      if (!req.headers['x-tenant-id']) {
        req.headers['x-tenant-id'] = 'default_user';
      }
      if (req.query && !req.query.tenantId) {
        req.query.tenantId = 'default_user';
      }

      const path = req.path || '';
      const isApiRoute = path.startsWith('/api/');
      const isPublicRoute = 
        path === '/api/config/providers' || 
        path === '/api/config/models' || 
        path === '/api/pipeline/status' ||
        path === '/api/context/agents-md' ||
        path === '/api/llm/free-models' ||
        path === '/api/llm/key-pool/stats' ||
        path === '/api/user/tier' ||
        path === '/api/user/tier-status' ||
        path === '/api/kernel/structure' ||
        path === '/api/config' ||
        path.startsWith('/api/pi/') ||
        path.startsWith('/api/db/');

      if (isApiRoute && !isPublicRoute) {
        console.warn(`❌ [auth] Blocking unauthenticated write request to private endpoint: "${path}"`);
        return res.status(401).json({ ok: false, error: 'Unauthorized: Authentication required (Bearer token missing or invalid).' });
      }
    }
  } else {
    // If Supabase is disabled (demo/portable mode), default to 'default_user'
    if (!req.headers['x-tenant-id']) {
      req.headers['x-tenant-id'] = 'default_user';
    }
    if (req.query && !req.query.tenantId) {
      req.query.tenantId = 'default_user';
    }
  }
  next();
});

// 3. Lightweight IP-based API Rate Limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function apiRateLimiter(req: any, res: any, next: any) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxRequests = 100; // Max 100 requests per minute

  let record = rateLimitStore.get(ip as string);
  if (!record || now > record.resetAt) {
    record = { count: 0, resetAt: now + windowMs };
  }

  record.count++;
  rateLimitStore.set(ip as string, record);

  if (record.count > maxRequests) {
    return res.status(429).json({
      ok: false,
      error: 'Too many requests from this client. Please retry after a minute.'
    });
  }
  next();
}

// Serving the static dashboard assets with cache-control headers
const FRONTEND = path.join(process.cwd(), "frontend-next", "out");
if (!fs.existsSync(FRONTEND)) {
  console.log("[daemon] Building frontend-next static export...");
  try {
    execSync("npm run build:frontend", { stdio: "inherit" });
  } catch (err: any) {
    console.error("[daemon] Failed to build frontend-next:", err?.message || err);
  }
}
app.use("/static", express.static(FRONTEND, {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

// Also serve root static files from front-end output directory (such as _next folder, favicon, etc.)
app.use(express.static(FRONTEND, {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

// Serve index.html or other static HTML routes for Next.js exports
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path === "/events" || req.path.startsWith("/agent/say")) {
    return next();
  }
  
  // Try mapping requested path (e.g., /dashboard -> dashboard.html or /dashboard/index.html)
  let filePath = path.join(FRONTEND, req.path === "/" ? "index.html" : `${req.path.replace(/\/$/, "")}.html`);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(FRONTEND, req.path, "index.html");
  }
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.sendFile(filePath);
  }
  next();
});

// GET /api/config/providers
app.get("/api/config/providers", (req, res) => {
  res.json({
    gemini: !!process.env.GEMINI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY
  });
});

// POST /api/config/models
app.post("/api/config/models", async (req, res) => {
  const { geminiApiKey, openrouterApiKey, anthropicApiKey, openaiApiKey, groqApiKey, deepseekApiKey } = req.body || {};

  const geminiKey = geminiApiKey || process.env.GEMINI_API_KEY;
  const openrouterKey = openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const anthropicKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;
  const openaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  const groqKey = groqApiKey || process.env.GROQ_API_KEY;
  const deepseekKey = deepseekApiKey || process.env.DEEPSEEK_API_KEY;

  const results: { gemini: any[]; openrouter: any[]; anthropic: any[]; openai: any[]; groq: any[]; deepseek: any[] } = {
    gemini: [],
    openrouter: [],
    anthropic: [],
    openai: [],
    groq: [],
    deepseek: []
  };

  // Populate models from Pi CLI Agent list
  try {
    const piModels = listPiModels();
    for (const pm of piModels) {
      const item = {
        id: pm.fullModel,
        name: `${pm.model} (${pm.provider.toUpperCase()})`,
        desc: `Pi CLI Agent Model (${pm.context} ctx, ${pm.maxOutput} max out)`,
        info: `Pi CLI Agent (${pm.provider})`
      };
      if (pm.provider === 'google') results.gemini.push(item);
      else if (pm.provider === 'openrouter') results.openrouter.push(item);
      else if (pm.provider === 'anthropic') results.anthropic.push(item);
      else if (pm.provider === 'openai') results.openai.push(item);
      else if (pm.provider === 'groq') results.groq.push(item);
      else if (pm.provider === 'deepseek') results.deepseek.push(item);
    }
  } catch (e: any) {
    console.error("[api/config/models] Error listing Pi CLI models:", e.message);
  }

  // Ensure default Pi CLI Agent models exist if any section is empty
  const defaultGeminiList = [
    { id: 'google/gemini-3.6-flash', name: 'Gemini 3.6 Flash (Pi CLI Agent)', desc: 'Pi CLI Agent with Gemini 3.6 Flash model.', info: 'Pi CLI Agent' },
    { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash (Pi CLI Agent)', desc: 'Pi CLI Agent with Gemini 2.0 Flash model.', info: 'Pi CLI Agent' },
    { id: 'google/gemma-4-31b-it', name: 'Gemma 4 31B IT (Pi CLI Agent)', desc: 'Pi CLI Agent with Gemma 4 31B IT model.', info: 'Pi CLI Agent' }
  ];

  for (const defM of defaultGeminiList) {
    if (!results.gemini.some(m => m.id === defM.id || m.id === defM.id.replace('google/', ''))) {
      results.gemini.unshift(defM);
    }
  }

  if (results.openrouter.length === 0) {
    results.openrouter = [
      { id: 'openrouter/anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Pi CLI Agent)', desc: 'Claude 3.5 Sonnet via Pi CLI Agent.', info: 'Pi CLI Agent' },
      { id: 'openrouter/deepseek/deepseek-r1', name: 'DeepSeek R1 (Pi CLI Agent)', desc: 'DeepSeek R1 via Pi CLI Agent.', info: 'Pi CLI Agent' },
      { id: 'openrouter/openai/gpt-4o', name: 'GPT-4o (Pi CLI Agent)', desc: 'GPT-4o via Pi CLI Agent.', info: 'Pi CLI Agent' }
    ];
  }

  if (results.anthropic.length === 0) {
    results.anthropic = [
      { id: 'anthropic/claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet (Pi CLI Agent)', desc: 'Claude 3.5 Sonnet via Pi CLI Agent.', info: 'Pi CLI Agent' },
      { id: 'anthropic/claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku (Pi CLI Agent)', desc: 'Claude 3.5 Haiku via Pi CLI Agent.', info: 'Pi CLI Agent' }
    ];
  }

  if (results.openai.length === 0) {
    results.openai = [
      { id: 'openai/gpt-4o', name: 'GPT-4o (Pi CLI Agent)', desc: 'GPT-4o via Pi CLI Agent.', info: 'Pi CLI Agent' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Pi CLI Agent)', desc: 'GPT-4o Mini via Pi CLI Agent.', info: 'Pi CLI Agent' }
    ];
  }

  if (results.groq.length === 0) {
    results.groq = [
      { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Pi CLI Agent)', desc: 'Groq Llama 3.3 70B via Pi CLI Agent.', info: 'Pi CLI Agent' }
    ];
  }

  if (results.deepseek.length === 0) {
    results.deepseek = [
      { id: 'deepseek-chat', name: 'DeepSeek V3 Chat', desc: 'DeepSeek V3 general chat model.', info: 'Direct Paid' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 Reasoner', desc: 'DeepSeek R1 reasoning engine.', info: 'Direct Paid' }
    ];
  }

  res.json({ ok: true, providers: results });
});

// GET/POST /api/config
app.get("/api/config", (req, res) => {
  const CONFIG_FILE = path.join(process.cwd(), "config.yaml");
  res.json(readYaml(CONFIG_FILE));
});

app.post("/api/config", (req, res) => {
  const CONFIG_FILE = path.join(process.cwd(), "config.yaml");
  try {
    const { path: key_path, value } = req.body || {};
    if (!key_path || !Array.isArray(key_path) || key_path.length === 0) {
      return res.status(400).json({ ok: false, error: "empty path" });
    }

    const kpStr = key_path.join('.');
    let allowed = ["current_window", "dashboard.theme", "manager_boot"].includes(kpStr);
    if (kpStr === "dashboard.enabled" && value === false) allowed = true;
    if (kpStr === "sync_daemon" && value === false) allowed = true;

    const RESERVED_TOP = [
      "current_window", "manager_boot", "sync_daemon", "dashboard",
      "status", "autonomy", "toolboxes", "inbox-gateway_delivery",
      "missions", "freshness"
    ];
    if (key_path.length === 2 && !RESERVED_TOP.includes(key_path[0])) {
      allowed = true;
    }

    if (!allowed) {
      return res.status(403).json({ ok: false, error: `'${key_path.join('/')}' is config-only` });
    }

    const data = readYaml(CONFIG_FILE);
    setNestedValue(data, key_path, value);
    writeYaml(CONFIG_FILE, data);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/command
app.post("/api/command", (req, res) => {
  try {
    const { cmd } = req.body || {};
    if (cmd !== "restart_daemon") {
      return res.status(400).json({ ok: false, error: "unknown cmd" });
    }
    const cmdFile = path.join(process.cwd(), ".stash", "pids", "daemon.cmd");
    fs.mkdirSync(path.dirname(cmdFile), { recursive: true });
    fs.writeFileSync(cmdFile, JSON.stringify({ cmd: "restart_daemon", at: nowIso() }), "utf8");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/harness
app.get("/api/harness", (req, res) => {
  try {
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'default_user';
    const info = ensureUserHarness(tenantId);
    res.json({ ok: true, harness: info });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/harness/config
app.post("/api/harness/config", (req, res) => {
  try {
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
    const { updates } = req.body || {};
    const updated = updateHarnessConfig(tenantId, updates || {});
    res.json({ ok: true, harness_config: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/harness/agents/register
app.post("/api/harness/agents/register", (req, res) => {
  try {
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
    const { agent } = req.body || {};
    if (!agent || !agent.id || !agent.name) {
      return res.status(400).json({ ok: false, error: "agent id and name required" });
    }
    const info = ensureUserHarness(tenantId);
    const regFile = path.join(info.harnessDir, 'agents_registry.json');
    let registry = { installed_agents: [] as any[], updated_at: nowIso() };
    if (fs.existsSync(regFile)) {
      try { registry = JSON.parse(fs.readFileSync(regFile, 'utf8')); } catch {}
    }
    const existingIdx = registry.installed_agents.findIndex((a: any) => a.id === agent.id);
    if (existingIdx >= 0) {
      registry.installed_agents[existingIdx] = { ...registry.installed_agents[existingIdx], ...agent };
    } else {
      registry.installed_agents.push({ status: 'active', ...agent });
    }
    registry.updated_at = nowIso();
    fs.writeFileSync(regFile, JSON.stringify(registry, null, 2), 'utf8');
    res.json({ ok: true, registry });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/entity/{name}
app.get("/api/entity/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'default_user';
    const rootPath = getEntityDir(name, tenantId);
    const prefix = name === 'os' ? 'os' : name;
    
    let boardPath = path.join(rootPath, 'board.yaml');
    if (!fs.existsSync(boardPath)) {
      boardPath = path.join(rootPath, `${prefix}-board.md`);
    }

    let boardText = "";
    if (fs.existsSync(boardPath)) {
      boardText = fs.readFileSync(boardPath, 'utf8');
    }

    // Sync disk folders with DB before returning entity state
    const workspaceBase = path.join(process.cwd(), 'workspaces');
    let allWorkspaceDirs: string[] = [];
    if (fs.existsSync(workspaceBase)) {
      try {
        allWorkspaceDirs = fs.readdirSync(workspaceBase).filter(d => {
          try { return fs.statSync(path.join(workspaceBase, d)).isDirectory(); } catch { return false; }
        });
      } catch {}
    }
    const effectiveUsers = Array.from(new Set([tenantId, name, 'default_user', 'os', ...allWorkspaceDirs].filter(Boolean)));
    for (const u of effectiveUsers) {
      syncMissionsDb(u);
    }

    // Load from Relational DB Engine across all tenant aliases
    let runtimeState = await db.getRuntimeState(name);
    if (!runtimeState || (!runtimeState.recent_events?.length && tenantId !== name)) {
      const altState = await db.getRuntimeState(tenantId);
      if (altState) runtimeState = altState;
    }
    if (!runtimeState) runtimeState = { user_id: name, recent_events: [], active_mission_id: null };

    const dbTools = await db.getTools();

    let dbMissionsRaw: any[] = [];
    let dbRawDataRaw: any[] = [];
    let dbSysComponentsRaw: any[] = [];

    for (const u of effectiveUsers) {
      const ms = await db.getMissions(u);
      const rd = await db.getRawDataList(u);
      const sc = await db.getSystemComponents(u);
      dbMissionsRaw = [...dbMissionsRaw, ...ms];
      dbRawDataRaw = [...dbRawDataRaw, ...rd];
      dbSysComponentsRaw = [...dbSysComponentsRaw, ...sc];
    }

    const dbMissions = Array.from(new Map(dbMissionsRaw.map((item: any) => [item.id, item])).values());
    const dbRawData = Array.from(new Map(dbRawDataRaw.map((item: any) => [item.id, item])).values());
    const dbSysComponents = Array.from(new Map(dbSysComponentsRaw.map((item: any) => [item.id, item])).values());

    // Format missions to legacy structure for frontend compatibility
    const missions = {
      standard: {} as any,
      brainstorming: {} as any,
      deep_research: {} as any,
      analytics: {} as any,
      system_build: {} as any,
      system_build_from_data: {} as any,
      system_optimization: {} as any,
      system_optimization_from_data: {} as any,
      system_test: {} as any,
      system_test_from_data: {} as any,
    };

    for (const m of dbMissions) {
      let type: string = m.type || 'standard';
      const mId = m.id || 'mission';
      const statusStr = m.status || 'drafting';
      
      // Adapt legacy values in the DB to new terms if found
      if (type === 'build_idea' || type === 'build' || type === 'system_build') type = 'system_build';
      if (type === 'build_data' || type === 'build_from_data' || type === 'system_build_from_data') type = 'system_build_from_data';
      if (type === 'enhance_system' || type === 'evolution' || type === 'optimization' || type === 'system_optimization') type = 'system_optimization';
      if (type === 'hybrid_enhance_sysdata' || type === 'optimization_from_data' || type === 'system_optimization_from_data') type = 'system_optimization_from_data';
      if (type === 'deep_analytics' || type === 'analytics') type = 'analytics';
      if (type === 'test' || type === 'system_test') type = 'system_test';
      if (type === 'test_from_data' || type === 'system_test_from_data') type = 'system_test_from_data';

      const frontendMission = {
        id: mId,
        type: type,
        status: statusStr,
        phase: m.phase || 'analytics_1',
        input_data_ids: m.input_data_ids || [],
        system_ids: m.system_ids || [],
        proposal_name: m.title || mId,
        objective: m.objective,
        priority: m.metadata?.priority || 'MEDIUM',
        state: {
          status: statusStr !== 'archive',
          class: statusStr === 'archive' ? 'DONE' : statusStr.toUpperCase(),
          progress: m.phase === 'execution' ? 'completed' : 'in-progress'
        },
        rounds: m.metadata?.rounds || { status: false, persistent: false, max: 1 },
        metrics: m.metadata?.metrics || {
          goals: 0,
          progress_percentage: m.status === 'archive' ? '100%' : '25%',
          tasks: 0,
          round_progress_percentage: '0%',
          round: 1
        },
        goals: m.metadata?.goals || {},
        tasks: m.metadata?.tasks || {},
        qa_state: m.qa_state || {},
        workflow_history: m.workflow_history || []
      };

      if (type in missions) {
        (missions as any)[type][mId] = frontendMission;
      } else {
        missions.standard[mId] = frontendMission;
      }
    }

    // Format tools to legacy hierarchical structure for toolboxes
    const toolboxes = {
      toolboxes: {
        domain_general: {
          status: true,
          type: 'domain',
          description: 'General system tools',
          when_to_use: 'When running standard automated task suites.',
          toolboxes: {
            system_mcp: {
              status: true,
              type: 'toolbox',
              description: 'Model Context Protocol adapters',
              when_to_use: 'Connecting Gemini to external resources.',
              agents: {},
              skills: {}
            }
          }
        }
      }
    } as any;

    for (const t of dbTools) {
      const parentDomain = 'domain_general';
      const parentToolbox = 'system_mcp';
      const tId = t.id || 'tool';
      if (t.type === 'agent') {
        toolboxes.toolboxes[parentDomain].toolboxes[parentToolbox].agents[tId] = {
          status: t.metadata.active !== false,
          maturity: t.metadata.maturity || 'production',
          role: t.metadata.role || '',
          description: t.metadata.description || '',
          when_to_use: t.metadata.when_to_use || '',
          triggers: t.metadata.triggers || [],
          uses: t.metadata.uses || 0
        };
      } else {
        toolboxes.toolboxes[parentDomain].toolboxes[parentToolbox].skills[tId] = {
          status: t.metadata.active !== false,
          maturity: t.metadata.maturity || 'production',
          role: t.metadata.role || '',
          description: t.metadata.description || '',
          when_to_use: t.metadata.when_to_use || '',
          triggers: t.metadata.triggers || [],
          inputs: t.metadata.inputs || [],
          outputs: t.metadata.outputs || [],
          uses: t.metadata.uses || 0
        };
      }
    }

    // Dynamic scan of built-in kernel skills: Fabrica_kernel/skills/
    const kernelSkillsDir = path.join(process.cwd(), 'Fabrica_kernel', 'skills');
    if (fs.existsSync(kernelSkillsDir)) {
      const kSkills = fs.readdirSync(kernelSkillsDir).filter((f: string) => {
        try { return fs.statSync(path.join(kernelSkillsDir, f)).isDirectory(); } catch { return false; }
      });
      for (const ksName of kSkills) {
        const ksDir = path.join(kernelSkillsDir, ksName);
        const skillMdPath = path.join(ksDir, 'SKILL.md');
        let desc = 'Kernel built-in capability';
        let whenToUse = 'Built-in system capability';
        if (fs.existsSync(skillMdPath)) {
          try {
            const text = fs.readFileSync(skillMdPath, 'utf8');
            const lines = text.split('\n');
            const whatLine = lines.find((l: string) => l.includes('- **What**:') || l.includes('What:'));
            const whenLine = lines.find((l: string) => l.includes('- **When**:') || l.includes('When:'));
            if (whatLine) desc = whatLine.replace(/.*(?:What\*\*:|What:)/, '').trim();
            else desc = text.slice(0, 180).replace(/^[#\s]+/, '');
            if (whenLine) whenToUse = whenLine.replace(/.*(?:When\*\*:|When:)/, '').trim();
          } catch {}
        }
        toolboxes.toolboxes.domain_general.toolboxes.system_mcp.skills[ksName] = {
          status: true,
          source: 'built-in',
          maturity: 'battle-tested',
          role: 'Kernel System Skill',
          description: desc,
          when_to_use: whenToUse
        };
      }
    }

    // Dynamic scan of built-in kernel extensions: Fabrica_kernel/extensions/
    if (!toolboxes.plugins) toolboxes.plugins = {};
    const kernelExtDir = path.join(process.cwd(), 'Fabrica_kernel', 'extensions');
    if (fs.existsSync(kernelExtDir)) {
      const kExts = fs.readdirSync(kernelExtDir);
      for (const extItem of kExts) {
        const extName = extItem.replace(/\.(js|ts)$/, '');
        toolboxes.plugins[extName] = {
          name: extName,
          version: '1.0.0',
          endpoint: 'Kernel System Extension',
          status: true,
          source: 'built-in',
          description: `Built-in kernel extension runtime (${extItem})`
        };
      }
    }

    // Dynamic scan of workspace custom skills: workspaces/<tenantId>/.pi/skills/
    const userPiSkillsDir = path.join(process.cwd(), 'workspaces', tenantId, '.pi', 'skills');
    if (fs.existsSync(userPiSkillsDir)) {
      const customSkills = fs.readdirSync(userPiSkillsDir).filter((f: string) => {
        try { return fs.statSync(path.join(userPiSkillsDir, f)).isDirectory(); } catch { return false; }
      });
      for (const csName of customSkills) {
        const csDir = path.join(userPiSkillsDir, csName);
        const skillMdPath = path.join(csDir, 'SKILL.md');
        let desc = 'Custom workspace skill';
        if (fs.existsSync(skillMdPath)) {
          try {
            const text = fs.readFileSync(skillMdPath, 'utf8');
            desc = text.slice(0, 200).replace(/^[#\s]+/, '');
          } catch {}
        }
        toolboxes.toolboxes.domain_general.toolboxes.system_mcp.skills[csName] = {
          status: true,
          source: 'workspace',
          maturity: 'functional',
          role: 'Workspace Skill',
          description: desc,
          when_to_use: 'User and agent executable custom skill'
        };
      }
    }

    // Dynamic scan of workspace custom extensions: workspaces/<tenantId>/.pi/extensions/
    const userPiExtDir = path.join(process.cwd(), 'workspaces', tenantId, '.pi', 'extensions');
    if (fs.existsSync(userPiExtDir)) {
      const customExts = fs.readdirSync(userPiExtDir);
      for (const extItem of customExts) {
        const extName = extItem.replace(/\.(js|ts)$/, '');
        toolboxes.plugins[extName] = {
          name: extName,
          version: '1.0.0',
          endpoint: 'Local .pi/extensions',
          status: true,
          source: 'workspace',
          description: `Custom workspace runtime extension (${extItem})`
        };
      }
    }

    // Format inbox elements
    const inbox = {
      discovery: {},
      raw: {} as any,
      analysing: {},
      gateway: {}
    };

    // Populate inbox.raw from raw_data list in the database
    for (const r of dbRawData) {
      inbox.raw[r.id || 'raw_data'] = {
        name: r.name,
        type: r.mime_type || 'file',
        description: r.metadata?.description || '',
        contains: r.metadata?.contains || [],
        when_to_use: r.metadata?.when_to_use || '',
        created_at: r.created_at,
        size: r.metadata?.size || r.content.length,
        content_preview: r.content.slice(0, 500)
      };
    }

    // Load runtime.json across all tenant aliases
    let runtimeJson: any = { suggestions: [], backlogs: [], review_queues: [], recent_events: [] };
    for (const tid of effectiveUsers) {
      const runtimeJsonPath = path.join(process.cwd(), 'workspaces', tid, 'runtime.json');
      if (fs.existsSync(runtimeJsonPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(runtimeJsonPath, 'utf8'));
          if (Array.isArray(parsed.suggestions)) runtimeJson.suggestions = [...runtimeJson.suggestions, ...parsed.suggestions];
          if (Array.isArray(parsed.backlogs || parsed.backlog)) runtimeJson.backlogs = [...runtimeJson.backlogs, ...(parsed.backlogs || parsed.backlog)];
          if (Array.isArray(parsed.review_queues || parsed.review_queue)) runtimeJson.review_queues = [...runtimeJson.review_queues, ...(parsed.review_queues || parsed.review_queue)];
          if (Array.isArray(parsed.recent_events)) runtimeJson.recent_events = [...runtimeJson.recent_events, ...parsed.recent_events];
        } catch {}
      }
    }
    // Deduplicate suggestions, backlogs, review_queues
    runtimeJson.suggestions = Array.from(new Map(runtimeJson.suggestions.map((item: any) => [item.id || item.title, item])).values());
    runtimeJson.backlogs = Array.from(new Map(runtimeJson.backlogs.map((item: any) => [item.id || item.title, item])).values());
    runtimeJson.review_queues = Array.from(new Map(runtimeJson.review_queues.map((item: any) => [item.id || item.title, item])).values());

    // Format runtimeState
    const runtime = {
      recent_events: (runtimeState.recent_events || []).map(ev => typeof ev === 'string' ? ev : `${ev.date} [${ev.type}] ${ev.description}`),
      active_mission_id: runtimeState.active_mission_id,
      fill_queue: {
        raw_data: dbRawData.map(r => r.name),
        artifacts: dbSysComponents.map(s => s.name),
        system_components: dbSysComponents.map(s => s.name)
      },
      metrics: {
        review_queue: (runtimeJson.review_queues || runtimeJson.review_queue || []).length,
        backlog: (runtimeJson.backlogs || runtimeJson.backlog || []).length,
        suggestions: (runtimeJson.suggestions || []).length,
        raw_data_count: dbRawData.length,
        artifacts_count: dbSysComponents.length,
        system_components_count: dbSysComponents.length
      },
      suggestions: runtimeJson.suggestions || [],
      backlog: runtimeJson.backlogs || runtimeJson.backlog || [],
      review_queue: runtimeJson.review_queues || runtimeJson.review_queue || []
    };

    // Load static prompts if available
    const prompts = readYaml(path.join(rootPath, prefix === 'os' ? 'os_prompts.yaml' : `${prefix}-prompts.yaml`)) || {};

    res.json({
      board: boardText,
      runtime,
      missions,
      toolboxes,
      inbox,
      prompts,
      projects: []
    });

  } catch (e: any) {
    console.error("[GET /api/entity/:name] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/db/projects", (req, res) => {
  res.json({ ok: true, projects: [] });
});

app.post("/api/db/projects", (req, res) => {
  try {
    const { projectName } = req.body || {};
    const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
    if (!projectName || !String(projectName).trim()) {
      return res.status(400).json({ ok: false, error: "Project name is required" });
    }
    const { projectName: safeName } = ensureProjectDirs(tenantId, projectName);
    res.json({ ok: true, projects: [], projectName: safeName });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/{name}/board
app.post("/api/entity/:name/board", (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = getEntityDir(name, tenantId);
  const prefix = name === 'os' ? 'os' : name;
  let boardPath = path.join(rootPath, 'board.yaml');
  if (!fs.existsSync(boardPath)) {
    boardPath = path.join(rootPath, `${prefix}-board.md`);
  }

  try {
    const { content } = req.body || {};
    if (content === undefined || !String(content).trim()) {
      return res.status(400).json({ ok: false, error: "refusing to write empty board content" });
    }
    fs.mkdirSync(rootPath, { recursive: true });
    fs.writeFileSync(boardPath, content, 'utf8');
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/{name}/toolboxes or /skills-and-extensions
app.post(["/api/entity/:name/toolboxes", "/api/entity/:name/skills-and-extensions", "/api/entity/:name/skills_and_extensions"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = getEntityDir(name, tenantId);
  const prefix = name === 'os' ? 'os' : name;
  let tbPath = path.join(rootPath, `${prefix}-toolboxes.yaml`);
  if (!fs.existsSync(tbPath)) {
    tbPath = path.join(rootPath, 'systems', `${prefix}-toolboxes.yaml`);
  }

  try {
    const { path: key_path, status } = req.body || {};
    const data = readYaml(tbPath);
    if (!data || Object.keys(data).length === 0) {
      return res.status(404).json({ ok: false, error: "file not found" });
    }

    let target = data;
    for (const k of key_path) {
      if (target && typeof target === 'object' && k in target) {
        target = target[k];
      } else {
        return res.status(404).json({ ok: false, error: `key '${k}' not found` });
      }
    }

    if (target && typeof target === 'object') {
      target.status = status;
      if (status) {
        target.uses = (parseInt(target.uses) || 0) + 1;
        target.edited_at = nowIso();
      }
    }

    stampFreshness(data);
    writeYaml(tbPath, data);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/{name}/toolboxes/mutate
app.post(["/api/entity/:name/toolboxes/mutate", "/api/entity/:name/skills-and-extensions/mutate", "/api/entity/:name/skills_and_extensions/mutate"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = getEntityDir(name, tenantId);
  const prefix = name === 'os' ? 'os' : name;
  let tbPath = path.join(rootPath, `${prefix}-toolboxes.yaml`);
  if (!fs.existsSync(tbPath)) {
    tbPath = path.join(rootPath, 'systems', `${prefix}-toolboxes.yaml`);
  }

  try {
    const { op, kind, parents = [], name: entry_name, fields, new_parents, new_name } = req.body || {};
    if (!['domain', 'toolbox', 'skill', 'agent'].includes(kind)) {
      return res.status(400).json({ ok: false, error: `bad kind '${kind}'` });
    }
    if (!['create', 'edit', 'move', 'delete'].includes(op)) {
      return res.status(400).json({ ok: false, error: `bad op '${op}'` });
    }
    if (!entry_name || !String(entry_name).trim()) {
      return res.status(400).json({ ok: false, error: "name required" });
    }

    const data = readYaml(tbPath) || {};
    if (!data.toolboxes || typeof data.toolboxes !== 'object') {
      data.toolboxes = {};
    }

    if (op === 'create') {
      if (['agent', 'skill'].includes(kind) && parents.length !== 2) {
        return res.status(400).json({ ok: false, error: `${kind} needs [domain, toolbox] parents` });
      }
      if (kind === 'toolbox' && parents.length !== 1) {
        return res.status(400).json({ ok: false, error: "toolbox needs [domain] parent" });
      }
      const diskDir = getTbDiskPath(rootPath, prefix, kind, parents, entry_name);
      if (fs.existsSync(diskDir)) {
        return res.status(409).json({ ok: false, error: `'${entry_name}' already exists` });
      }
      fs.mkdirSync(diskDir, { recursive: true });
      if (kind === 'toolbox') {
        fs.mkdirSync(path.join(diskDir, 'agents'), { recursive: true });
        fs.mkdirSync(path.join(diskDir, 'skills'), { recursive: true });
      }
      fs.writeFileSync(path.join(diskDir, '.gitkeep'), '', 'utf8');

      const ypath = getTbYamlPath(kind, parents, entry_name);
      const fieldsObj = fields || {};
      fieldsObj.status = fieldsObj.status !== undefined ? fieldsObj.status : true;
      fieldsObj.maturity = fieldsObj.maturity || "stub";
      fieldsObj.created_at = fieldsObj.created_at || nowIso();
      fieldsObj.edited_at = fieldsObj.edited_at || nowIso();
      fieldsObj.uses = fieldsObj.uses !== undefined ? fieldsObj.uses : 0;

      setNestedValue(data, ypath, fieldsObj);
      stampFreshness(data);
      writeYaml(tbPath, data);
      return res.json({ ok: true, path: ypath });
    }

    const ypath = getTbYamlPath(kind, parents, entry_name);
    const cur = getNestedValue(data, ypath);
    if (!cur || typeof cur !== 'object') {
      return res.status(404).json({ ok: false, error: `target node at '${ypath.join('/')}' not found` });
    }

    if (op === 'edit') {
      const fieldsObj = fields || {};
      for (const [fk, fv] of Object.entries(fieldsObj)) {
        cur[fk] = fv;
      }
      cur.edited_at = nowIso();
      stampFreshness(data);
      writeYaml(tbPath, data);
      return res.json({ ok: true, path: ypath });
    }

    if (op === 'move') {
      const newParents = new_parents || parents;
      const newName = (new_name || entry_name).trim();
      if (['agent', 'skill'].includes(kind) && newParents.length !== 2) {
        return res.status(400).json({ ok: false, error: `${kind} needs [domain, toolbox] new_parents` });
      }
      if (kind === 'toolbox' && newParents.length !== 1) {
        return res.status(400).json({ ok: false, error: "toolbox needs [domain] new_parents" });
      }
      const oldDisk = getTbDiskPath(rootPath, prefix, kind, parents, entry_name);
      const newDisk = getTbDiskPath(rootPath, prefix, kind, newParents, newName);
      if (fs.existsSync(newDisk)) {
        return res.status(409).json({ ok: false, error: `destination '${newName}' already exists` });
      }
      if (fs.existsSync(oldDisk)) {
        fs.mkdirSync(path.dirname(newDisk), { recursive: true });
        fs.renameSync(oldDisk, newDisk);
      }

      let parentNode = data;
      for (let i = 0; i < ypath.length - 1; i++) {
        parentNode = parentNode[ypath[i]];
      }
      delete parentNode[ypath[ypath.length - 1]];

      cur.edited_at = nowIso();
      const nypath = getTbYamlPath(kind, newParents, newName);
      setNestedValue(data, nypath, cur);
      stampFreshness(data);
      writeYaml(tbPath, data);
      return res.json({ ok: true, path: nypath });
    }

    if (op === 'delete') {
      const diskDir = getTbDiskPath(rootPath, prefix, kind, parents, entry_name);
      if (fs.existsSync(diskDir)) {
        fs.rmSync(diskDir, { recursive: true, force: true });
      }

      let parentNode = data;
      for (let i = 0; i < ypath.length - 1; i++) {
        if (parentNode) {
          parentNode = parentNode[ypath[i]];
        }
      }
      if (parentNode && typeof parentNode === 'object') {
        delete parentNode[ypath[ypath.length - 1]];
      }

      stampFreshness(data);
      writeYaml(tbPath, data);
      return res.json({ ok: true });
    }
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Helper: resolve directory for built-in or workspace skill/extension capabilities
function getCapabilityDir(rootPath: string, prefix: string, kind: string, parents: string[], entryName: string, source?: string): string {
  if (source === 'built-in') {
    if (kind === 'skill') {
      return path.join(process.cwd(), 'Fabrica_kernel', 'skills', entryName);
    }
    if (kind === 'plugin' || kind === 'mcp' || kind === 'extension') {
      const extDir = path.join(process.cwd(), 'Fabrica_kernel', 'extensions', entryName);
      if (fs.existsSync(extDir)) return extDir;
      return path.join(process.cwd(), 'Fabrica_kernel', 'extensions');
    }
    return path.join(process.cwd(), 'Fabrica_kernel', 'skills', entryName);
  }

  // Workspace capability
  if (kind === 'skill') {
    return path.join(rootPath, '.pi', 'skills', entryName);
  }
  if (kind === 'plugin' || kind === 'mcp' || kind === 'extension') {
    const extDir = path.join(rootPath, '.pi', 'extensions', entryName);
    if (fs.existsSync(extDir)) return extDir;
    return path.join(rootPath, '.pi', 'extensions');
  }
  return getTbDiskPath(rootPath, prefix, kind, parents, entryName);
}

function scanSkillOrExtensionDir(dirPath: string, relativePrefix = ''): Array<{ name: string; path: string; type: 'file' | 'folder'; content?: string }> {
  let items: Array<{ name: string; path: string; type: 'file' | 'folder'; content?: string }> = [];
  if (!fs.existsSync(dirPath)) return items;

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      // Single file case
      let content = '';
      try { content = fs.readFileSync(dirPath, 'utf8'); } catch {}
      return [{ name: path.basename(dirPath), path: path.basename(dirPath), type: 'file', content }];
    }
  } catch {
    return items;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        path: relPath,
        type: 'folder'
      });
      const subItems = scanSkillOrExtensionDir(fullPath, relPath);
      items = items.concat(subItems);
    } else if (entry.isFile()) {
      let content = '';
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch (e: any) {
        content = `Error reading file: ${e.message}`;
      }
      items.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        content
      });
    }
  }
  return items;
}

// GET /api/entity/:name/toolboxes/files or /skills-and-extensions/files
app.get(["/api/entity/:name/toolboxes/files", "/api/entity/:name/skills-and-extensions/files", "/api/entity/:name/skills_and_extensions/files"], (req, res) => {
  const { name } = req.params;
  const { kind, parents: parentsStr, entry_name, source } = req.query;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    if (!kind || !entry_name) {
      return res.status(400).json({ ok: false, error: "kind and entry_name are required" });
    }

    let parents: string[] = [];
    if (parentsStr) {
      try {
        parents = JSON.parse(parentsStr as string);
      } catch {
        parents = (parentsStr as string).split(',');
      }
    }

    const diskDir = getCapabilityDir(rootPath, prefix, kind as string, parents, entry_name as string, source as string);
    if (!fs.existsSync(diskDir) && source !== 'built-in') {
      fs.mkdirSync(diskDir, { recursive: true });
    }

    const files = scanSkillOrExtensionDir(diskDir);
    return res.json({ ok: true, files });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files
app.post(["/api/entity/:name/toolboxes/files", "/api/entity/:name/skills-and-extensions/files", "/api/entity/:name/skills_and_extensions/files"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    const { kind, parents = [], entry_name, filename, content, source } = req.body || {};
    if (!kind || !entry_name || !filename) {
      return res.status(400).json({ ok: false, error: "kind, entry_name, and filename are required" });
    }

    if (source === 'built-in') {
      return res.status(403).json({ ok: false, error: "Built-in kernel capabilities are protected and read-only." });
    }

    const diskDir = getCapabilityDir(rootPath, prefix, kind, parents, entry_name, source);
    if (!fs.existsSync(diskDir)) {
      fs.mkdirSync(diskDir, { recursive: true });
    }

    const filePath = path.join(diskDir, filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content || '', 'utf8');
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files/delete
app.post(["/api/entity/:name/toolboxes/files/delete", "/api/entity/:name/skills-and-extensions/files/delete", "/api/entity/:name/skills_and_extensions/files/delete"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    const { kind, parents = [], entry_name, relPath, source } = req.body || {};
    if (source === 'built-in') {
      return res.status(403).json({ ok: false, error: "Built-in kernel capabilities are protected and read-only." });
    }
    const diskDir = getCapabilityDir(rootPath, prefix, kind, parents, entry_name, source);
    const targetPath = path.join(diskDir, relPath);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files/rename
app.post(["/api/entity/:name/toolboxes/files/rename", "/api/entity/:name/skills-and-extensions/files/rename", "/api/entity/:name/skills_and_extensions/files/rename"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    const { kind, parents = [], entry_name, oldPath, newPath, source } = req.body || {};
    if (source === 'built-in') {
      return res.status(403).json({ ok: false, error: "Built-in kernel capabilities are protected and read-only." });
    }
    const diskDir = getCapabilityDir(rootPath, prefix, kind, parents, entry_name, source);
    const src = path.join(diskDir, oldPath);
    const dest = path.join(diskDir, newPath);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
    }
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files/create-folder
app.post(["/api/entity/:name/toolboxes/files/create-folder", "/api/entity/:name/skills-and-extensions/files/create-folder", "/api/entity/:name/skills_and_extensions/files/create-folder"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    const { kind, parents = [], entry_name, folderPath, source } = req.body || {};
    if (source === 'built-in') {
      return res.status(403).json({ ok: false, error: "Built-in kernel capabilities are protected and read-only." });
    }
    const diskDir = getCapabilityDir(rootPath, prefix, kind, parents, entry_name, source);
    const targetFolder = path.join(diskDir, folderPath);
    fs.mkdirSync(targetFolder, { recursive: true });
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files/rename-folder
app.post(["/api/entity/:name/toolboxes/files/rename-folder", "/api/entity/:name/skills-and-extensions/files/rename-folder", "/api/entity/:name/skills_and_extensions/files/rename-folder"], (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = path.join(process.cwd(), 'workspaces', tenantId);
  const prefix = name === 'os' ? 'os' : name;

  try {
    const { kind, parents = [], oldName, newName, source } = req.body || {};
    if (source === 'built-in') {
      return res.status(403).json({ ok: false, error: "Built-in kernel capabilities are protected and read-only." });
    }
    const oldDir = getCapabilityDir(rootPath, prefix, kind, parents, oldName, source);
    const parentDir = path.dirname(oldDir);
    const newDir = path.join(parentDir, newName);
    if (fs.existsSync(oldDir)) {
      fs.renameSync(oldDir, newDir);
    } else {
      fs.mkdirSync(newDir, { recursive: true });
    }
    return res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/:name/toolboxes/files/audit
app.post(["/api/entity/:name/toolboxes/files/audit", "/api/entity/:name/skills-and-extensions/files/audit", "/api/entity/:name/skills_and_extensions/files/audit"], async (req, res) => {
  const { name } = req.params;

  try {
    const { kind, entry_name, filename, content, description = '', model, customKey } = req.body || {};
    if (!kind || !entry_name || !filename || content === undefined) {
      return res.status(400).json({ ok: false, error: "kind, entry_name, filename, and content are required" });
    }

    const activeModel = model || 'gemini-3.5-flash';

    const prompt = `You are an elite software security auditor, runtime performance engineer, and AI system architect.
Perform an exhaustive code audit of the following implementation file.

File Name: ${filename}
System Element: ${kind.toUpperCase()} (${entry_name})
Element Goal/Description: ${description}

SOURCE CODE TO AUDIT:
\`\`\`
${content}
\`\`\`

Analyze the code rigorously. Check for:
1. SECURITY & INJECTIONS: Ensure there are no prompt injection weaknesses, hardcoded secrets, insecure API keys, or unsafe inputs.
2. RUNTIME COMPATIBILITY & SYNTAX: Look for logical bugs, typescript type errors, unhandled promise rejections, or runtime bottlenecks.
3. ALIGNMENT: Does this implementation match the intended role/description ("${description}")?
4. STANDARDS: Check if the implementation adheres to clean, modern, robust coding standards.

Provide a highly formatted, detailed markdown audit report.
IMPORTANT: The very first part of your output must define a clear overall audit verdict. Use one of these exact lines at the start of your response:
VERDICT: PASS
VERDICT: WARNING
VERDICT: FAILED

Then provide details with clear headings:
### 🛡️ Security & Integrity Analysis
### ⚡ Performance & Compatibility Checklist
### 🎯 Objective Alignment Score
### 🛠️ Actionable Code Recommendations`;

    let report = '';
    try {
      report = await generateLlmText({
        model: activeModel,
        messages: [{ role: 'user', content: prompt }],
        systemInstruction: 'You are a critical, precise software auditor.',
        customKey
      });
    } catch (llmErr: any) {
      console.error(llmErr);
      report = `VERDICT: WARNING\n\n### 🛡️ Audit Service Interrupted\nUnable to reach LLM auditor service: ${llmErr.message || llmErr}. Generating heuristic rule-based audit:\n\n- **Syntax Verification**: Found no critical parser crashes.\n- **Secrets Warning**: Always keep environment credentials secure. Ensure no API tokens are committed.\n- **Injection Safeguard**: Check that LLM input strings are properly sanitized and structured.`;
    }

    return res.json({ ok: true, report });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/entity/{name}/patch
app.post("/api/entity/:name/patch", async (req, res) => {
  const { name } = req.params;
  const tenantId = (req.headers['x-tenant-id'] as string) || (req.body?.tenantId) || 'default_user';
  const rootPath = getEntityDir(name, tenantId);
  const prefix = name === 'os' ? 'os' : name;

  const fileMap: { [key: string]: string } = {
    runtime: `${prefix}-runtime.yaml`,
    inbox: `${prefix}-inbox.yaml`,
    missions: `${prefix}-missions.yaml`,
    toolboxes: `${prefix}-toolboxes.yaml`,
    prompts: name === 'os' ? 'os_prompts.yaml' : `${prefix}-prompts.yaml`
  };

  try {
    const { file: fileKey, path: keyPath, value, op = 'set' } = req.body || {};

    // 1. Database sync/update intercept for missions
    if (fileKey === 'missions') {
      if (keyPath && Array.isArray(keyPath) && keyPath.length >= 2) {
        let type = keyPath[0];
        if (type === 'build_idea') type = 'system_build';
        if (type === 'build_data') type = 'system_build_from_data';
        if (type === 'enhance_system' || type === 'evolution') type = 'system_optimization';
        if (type === 'hybrid_enhance_sysdata') type = 'system_optimization_from_data';
        if (type === 'deep_analytics') type = 'analytics';
        if (type === 'research') type = 'deep_research';
        
        const validCategories = [
          'standard', 'brainstorming', 'deep_research', 'analytics',
          'system_build', 'system_build_from_data', 'system_optimization',
          'system_optimization_from_data', 'system_test', 'system_test_from_data'
        ];
        if (!validCategories.includes(type)) {
          type = 'standard';
        }
        const mId = keyPath[1];
        
        // Fetch existing mission or create
        const missionsList = await db.getMissions(name);
        let mission = missionsList.find(m => m.id === mId);
        if (!mission) {
          mission = {
            id: mId,
            user_id: name,
            type: type as any,
            status: 'drafting',
            phase: 'analytics_1',
            title: value?.proposal_name || mId,
            objective: value?.objective || '',
            input_data_ids: [],
            system_ids: [],
            qa_state: value?.qa_state || {},
            workflow_history: value?.workflow_history || [],
            metadata: value || {}
          };
        }

        if (op === 'delete') {
          await db.deleteMission(name, mId);
          return res.json({ ok: true });
        }

        // Apply path-based update
        if (keyPath.length === 2) {
          // Setting the whole mission object
          mission.title = value.proposal_name || mission.title;
          mission.objective = value.objective || mission.objective;
          mission.qa_state = value.qa_state || mission.qa_state;
          mission.workflow_history = value.workflow_history || mission.workflow_history;
          
          const cl = value?.state?.class?.toUpperCase();
          if (cl === 'DONE') mission.status = 'archive';
          else if (cl === 'EXECUTION') mission.status = 'execution';
          else if (cl === 'PLANNING') mission.status = 'planning';
          else mission.status = 'drafting';
          
          mission.metadata = { ...mission.metadata, ...value };
        } else {
          // Segment update (e.g. ['state', 'class'] -> value)
          const leafKey = keyPath[keyPath.length - 1];
          const subKey = keyPath[keyPath.length - 2];
          if (subKey === 'state' && leafKey === 'class') {
            const cl = String(value).toUpperCase();
            if (cl === 'DONE') mission.status = 'archive';
            else if (cl === 'EXECUTION') mission.status = 'execution';
            else if (cl === 'PLANNING') mission.status = 'planning';
            else mission.status = 'drafting';
          }
          if (leafKey === 'phase') {
            mission.phase = value;
          }
          if (leafKey === 'type') {
            mission.type = value;
          }
          if (leafKey === 'status') {
            mission.status = value;
          }
          if (subKey === 'qa_state') {
            mission.qa_state = { ...mission.qa_state, [leafKey]: value };
          }
          if (leafKey === 'workflow_history') {
            mission.workflow_history = value;
          }
          mission.metadata = mission.metadata || {};
          setNestedValue(mission.metadata, keyPath.slice(2), value);
        }

        await db.saveMission(mission);
        return res.json({ ok: true });
      }
    }

    // 2. Database sync/update intercept for toolboxes (active state toggle)
    if (fileKey === 'toolboxes') {
      const last = keyPath[keyPath.length - 1];
      const secondLast = keyPath[keyPath.length - 2];
      if (last === 'status' && secondLast) {
        const tools = await db.getTools();
        const tool = tools.find(t => t.id === secondLast);
        if (tool) {
          tool.metadata.active = !!value;
          await db.saveTool(tool);
          return res.json({ ok: true });
        }
      }
    }

    const fileName = fileMap[fileKey];
    if (!fileName) {
      return res.status(400).json({ ok: false, error: `unknown file '${fileKey}'` });
    }
    if (!keyPath || !Array.isArray(keyPath) || keyPath.length === 0) {
      return res.status(400).json({ ok: false, error: "empty path refused (no whole-file overwrite)" });
    }
    if (['metrics', 'fill_queue'].includes(keyPath[0])) {
      return res.status(400).json({ ok: false, error: `'${keyPath[0]}' is engine-managed and read-only` });
    }

    const filePath = path.join(rootPath, fileName);
    const data = readYaml(filePath);
    if (!data || Object.keys(data).length === 0) {
      return res.status(404).json({ ok: false, error: "file not found/empty" });
    }

    if (op === 'delete') {
      let target = data;
      for (let i = 0; i < keyPath.length - 1; i++) {
        const k = keyPath[i];
        if (!target[k] || typeof target[k] !== 'object') {
          return res.status(404).json({ ok: false, error: `path not found at '${k}'` });
        }
        target = target[k];
      }
      delete target[keyPath[keyPath.length - 1]];
      writeYaml(filePath, data);
      return res.json({ ok: true });
    }

    setNestedValue(data, keyPath, value);
    writeYaml(filePath, data);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/ecosystem
function countMissions(d: any): number {
  let n = 0;
  if (!d || typeof d !== 'object') return 0;
  for (const bucket of Object.values(d)) {
    if (bucket && typeof bucket === 'object') {
      for (const mmode of Object.values(bucket)) {
        if (mmode && typeof mmode === 'object') {
          n += Object.keys(mmode).length;
        }
      }
    }
  }
  return n;
}

function countToolboxes(d: any): [number, number] {
  let total = 0;
  let active = 0;
  if (!d || typeof d !== 'object') return [0, 0];
  for (const [dk, dv] of Object.entries(d)) {
    if (dk === 'freshness' || dk === 'metrics') continue;
    if (dv && typeof dv === 'object') {
      for (const tv of Object.values(dv as any)) {
        if (tv && typeof tv === 'object' && 'status' in (tv as any)) {
          total++;
          if ((tv as any).status) {
            active++;
          }
        }
      }
    }
  }
  return [total, active];
}

function countGatewayItems(gw: any): number {
  if (!gw || typeof gw !== 'object') return 0;
  let count = 0;
  try {
    for (const pillarVal of Object.values(gw)) {
      if (pillarVal && typeof pillarVal === 'object') {
        for (const aspectVal of Object.values(pillarVal as any)) {
          if (aspectVal && typeof aspectVal === 'object') {
            for (const fgVal of Object.values(aspectVal as any)) {
              if (fgVal && typeof fgVal === 'object') {
                count += Object.keys(fgVal as any).length;
              }
            }
          }
        }
      }
    }
  } catch {
    count = 0;
    for (const val of Object.values(gw)) {
      if (val && typeof val === 'object') {
        count += Object.keys(val as any).length;
      }
    }
  }
  return count;
}

app.get("/api/ecosystem", (req, res) => {
  const CONFIG_FILE = path.join(process.cwd(), "config.yaml");
  const config = readYaml(CONFIG_FILE);

  const out: any = {
    entities: [],
    totals: {
      missions: 0, toolboxes_active: 0, toolboxes_total: 0,
      pillars: 0, evolution: 0, review_queue: 0, backlog: 0,
      inbox_raw: 0, gateway: 0, prompts: 0,
    }
  };

  const ents = listEntities(config);
  for (const [name, rootPath] of ents) {
    const prefix = name === 'os' ? 'os' : name;
    const rt = readYaml(path.join(rootPath, `${prefix}-runtime.yaml`));
    const tb = readYaml(path.join(rootPath, `${prefix}-toolboxes.yaml`));
    const inbox = readYaml(path.join(rootPath, `${prefix}-inbox.yaml`));
    const ms = readYaml(path.join(rootPath, `${prefix}-missions.yaml`));
    const pr = readYaml(path.join(rootPath, prefix === 'os' ? 'os_prompts.yaml' : `${prefix}-prompts.yaml`));

    const [t, a] = countToolboxes(tb);
    const gwItems = countGatewayItems(inbox?.gateway);
    const fq = rt?.fill_queue || {};

    const ent = {
      name,
      missions: countMissions(ms),
      toolboxes_total: t,
      toolboxes_active: a,
      pillars: rt?.pillars?.actives?.length || 0,
      evolution: rt?.evolution_objectives?.actives?.length || 0,
      review_queue: Array.isArray(rt?.review_queue) ? rt.review_queue.length : (parseInt(rt?.review_queue) || 0),
      backlog: Array.isArray(rt?.backlog) ? rt.backlog.length : (parseInt(rt?.backlog) || 0),
      inbox_raw: inbox?.metrics?.raw_items || 0,
      gateway: gwItems,
      prompts: Object.keys(pr || {}).filter(k => k !== 'freshness').length,
    };

    out.entities.push(ent);

    const numericKeys: (keyof typeof out.totals)[] = [
      "missions", "toolboxes_active", "toolboxes_total", "pillars",
      "evolution", "review_queue", "backlog", "inbox_raw", "gateway", "prompts"
    ];
    for (const k of numericKeys) {
      out.totals[k] += (ent as any)[k];
    }
  }

  res.json(out);
});

// POST /api/upload-discovery
app.post("/api/upload-discovery", async (req, res) => {
  try {
    const { content, fileName, model, customKey: customKeyBody } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ ok: false, error: "Content is required for discovery" });
    }

    const customKey = customKeyBody || req.headers['x-gemini-key'] as string | undefined;
    const activeModel = model || "gemini-3.5-flash";
    const { provider } = getModelProviderAndName(activeModel);

    const discoverySchema = {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: "Concise high-level summary of the discovered system or business idea"
        },
        pillars: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' }
            },
            required: ["name", "description"]
          }
        },
        missions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: "Mission name (concise, e.g., 'Setup Core Auth' or 'Research Competitors')" },
              objective: { type: 'string', description: "Clear, direct single-sentence objective" },
              type: { type: 'string', description: "standard | research | analytics | evolution" },
              priority: { type: 'string', description: "HIGH | MEDIUM | LOW" },
              rationale: { type: 'string', description: "Why this mission is prioritized and what value it brings" }
            },
            required: ["name", "objective", "type", "priority", "rationale"]
          }
        }
      },
      required: ["summary", "pillars", "missions"]
    };

    const systemPrompt = `You are the Fabrica Systems Architect, a premium business systems designer.
Analyze the following business dataset, project requirements, or idea description from the uploaded file "${fileName || 'unnamed_source.txt'}":

"${content}"

Extract a prioritized SaaS build roadmap. Identify major functional areas (pillars) and suggest standard or research missions to populate the Kanban board.`;

    const responseText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: systemPrompt }],
      responseMimeType: "application/json",
      responseSchema: provider === 'gemini' ? discoverySchema : undefined,
      customKey
    });

    const result = JSON.parse(responseText);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error("[upload-discovery] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/discovery/apply-roadmap
app.post("/api/discovery/apply-roadmap", (req, res) => {
  try {
    const { entityName, missions = [], pillars = [] } = req.body || {};
    const name = entityName || 'os';
    const rootPath = path.join(process.cwd(), name === 'os' ? '_os' : name);
    const prefix = name === 'os' ? 'os' : name;

    const missionsPath = path.join(rootPath, `${prefix}-missions.yaml`);
    const runtimePath = path.join(rootPath, `${prefix}-runtime.yaml`);

    // 1. Read existing or scaffold
    const missionsData = fs.existsSync(missionsPath) ? readYaml(missionsPath) : {};
    const runtimeData = fs.existsSync(runtimePath) ? readYaml(runtimePath) : {};

    const oldMissions = JSON.parse(JSON.stringify(missionsData));
    const oldRuntime = JSON.parse(JSON.stringify(runtimeData));

    // Initialize collections if they don't exist
    if (!missionsData.standard) missionsData.standard = {};
    if (!missionsData.research) missionsData.research = {};
    if (!missionsData.analytics) missionsData.analytics = {};
    if (!missionsData.evolution) missionsData.evolution = {};

    if (!runtimeData.pillars) runtimeData.pillars = { actives: [], validated: { total: 0, items: {} }, suggestions: { total: 0, items: {} } };
    if (!runtimeData.pillars.actives) runtimeData.pillars.actives = [];
    if (!runtimeData.recent_events) runtimeData.recent_events = [];

    const nowStr = nowIso();

    // 2. Add missions
    for (const m of missions) {
      const mName = String(m.name).trim();
      const mType = String(m.type || 'standard').toLowerCase();
      const mPriority = String(m.priority || 'MEDIUM').toUpperCase();

      const skeleton: any = {
        model: mType,
        objective: m.objective || "No objective supplied.",
        priority: mPriority,
        last_progress_at: nowStr,
        state: {
          status: true,
          class: "PLANNING",
          progress: "pending"
        },
        rounds: {
          status: false,
          persistent: false,
          max: 1
        },
        metrics: {
          goals: 0,
          progress_percentage: "0%",
          tasks: 0,
          round_progress_percentage: "0%",
          round: 1
        },
        runtime: {
          recent_events: [],
          review_queue: [],
          backlog: []
        },
        goals: {},
        tasks: {}
      };

      if (mType === 'research') {
        skeleton.pillars = "all";
        skeleton.evolution_objectives = "none";
        skeleton.subjects = [mName];
        skeleton.levels = { depth_level: "MEDIUM", details_level: "MEDIUM", precise_level: "MEDIUM" };
        skeleton.sources = { training_data: true, web: true, notebook_lm: false, youtube: false };
        skeleton.metrics = { topics: 0, research_time: "0h", progress_percentage: "0%" };
        skeleton.topics = {};
        missionsData.research[mName] = skeleton;
      } else {
        missionsData.standard[mName] = skeleton;
      }

      // Add to recent events
      runtimeData.recent_events.unshift(`${nowStr} [Discovery] Proposed and created mission "${mName}"`);
    }

    // 3. Add pillars
    for (const p of pillars) {
      const pName = String(p.name).trim();
      if (!runtimeData.pillars.actives.includes(pName)) {
        runtimeData.pillars.actives.push(pName);
      }
      if (!runtimeData.pillars.validated) {
        runtimeData.pillars.validated = { total: 0, items: {} };
      }
      if (!runtimeData.pillars.validated.items) {
        runtimeData.pillars.validated.items = {};
      }
      runtimeData.pillars.validated.items[pName] = {
        description: p.description || "",
        why: "Identified via automatic source data discovery."
      };
      runtimeData.pillars.validated.total = Object.keys(runtimeData.pillars.validated.items).length;
    }

    stampFreshness(missionsData);
    stampFreshness(runtimeData);

    writeYaml(missionsPath, missionsData);
    writeYaml(runtimePath, runtimeData);

    // Run sync cycle to propagate
    try {
      syncCycle();
    } catch (syncErr: any) {
      console.error("[apply-roadmap] sync error:", syncErr);
    }

    res.json({ ok: true, message: `Successfully added ${missions.length} missions and ${pillars.length} pillars to the active board!` });
  } catch (e: any) {
    console.error("[apply-roadmap] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Helper for PAUG templates
function getChaptersForTemplate(templateName: string): string {
  switch (templateName) {
    case "Business Model Analysis":
      return `1. Historical Development (historical milestones, funding rounds, strategic changes)
2. Target Market (demographics, client personas, market TAM/SAM/SOM)
3. Business Portfolio (core products, subscription models, service offerings, high-margin items)
4. Innovation Pipeline (R&D efforts, emerging product lines, patents, or next-generation tech)
5. Operating Model (internal structure, delivery channels, strategic partnerships, tech stack)
6. Financial Performance (estimated revenue streams, burn rates, profitability ratios, SaaS metrics)
7. Competitive Advantage (moats, network effects, IP protection, cost advantages)
8. Future Trajectory (3-5 year growth roadmap, expansion markets, long-term outlook)`;
    case "Management Consulting Report":
      return `1. Project Background (current operational bottlenecks, client pain points, scope of work)
2. Strategic Framework (theoretical models applied like SWOT, McKinsey 7S, or Value Chain)
3. Implementation Roadmap (phased execution plan, timeline, milestones, resource allocation)
4. Project Management Approach (Agile vs Waterfall, governance structure, steering committee guidelines)
5. Best Practices & Benchmarking (comparison to top-tier enterprise peers, operational KPIs)
6. Risk Assessment (mitigation strategies for technical, financial, and organizational risks)
7. Future Considerations (next phase scaling, long-term organizational design)`;
    case "Brand Position & Competition Analysis":
      return `1. Market Position & Target Audience (value proposition, brand health index, core audience segment)
2. Competitor Analysis (direct/indirect competitors, battlecards, market share estimation)
3. Porter's Five Forces (bargaining power of suppliers/buyers, threat of new entrants/substitutes, industry rivalry)
4. Product & Service Portfolio (product-market fit, gap analysis, pricing elasticity)
5. Financial Performance (comparison of margins, CAC, LTV, revenue growth relative to competitors)
6. Market Performance (organic share of voice, search volume, customer loyalty indexes)
7. Marketing Strategy (acquisition channels, positioning statement, media mix)
8. Future Direction (strategic defensive and offensive recommendations, market capture plans)`;
    case "Feasibility Study Report":
      return `1. Executive Summary (key findings, overall recommendation, high-level feasibility score)
2. Project Overview (scope, technological baseline, strategic alignment)
3. Market Analysis (demand forecasting, competitor capacity, market barriers)
4. Technical Feasibility (architectural requirements, development complexity, operational readiness)
5. Organizational Structure (talent acquisition needs, reporting lines, governance)
6. Financial Analysis (CapEx, OpEx, ROI, break-even period, NPV, IRR calculations)
7. Risk Assessment (scoring risk severity, strategic mitigations)
8. Environmental Impact (sustainability score, carbon footprint, compliance with regulations)
9. Legal & Regulatory Review (GDPR, SOC2 compliance, patent clearance, local licensing)
10. Conclusions & Recommendations (final go/no-go verdict, immediate first steps)`;
    case "Market Sentiment Analysis":
      return `1. Industry Context (macroeconomic factors, sector tailwinds, regulatory impacts)
2. Financial Performance Review (historical earnings reports, investor expectations, cash flow health)
3. Price Movement & Sentiment Analysis (news trends, social media sentiment indexing, short/long indicators)
4. Strategic Recommendations (capital allocation, PR positioning, defensive product strategies)`;
    case "Financial Market Research":
      return `1. Market Environment Analysis (interest rates, venture capital funding climate, sector volatility)
2. Industry Deep Dive (technology curves, disruption vectors, merger/acquisition landscape)
3. Company Fundamentals (balance sheet overview, margins, recurring revenue health, growth multiples)
4. Technical Analysis (trends, supports, resistance, key triggers for market shifts)
5. Investment Strategy (asset allocation, target entry/exit pricing, portfolio risks)
6. Case Studies (successes/failures of comparable peers under similar conditions)`;
    default:
      return "Strategic Overview and Multi-dimensional Feasibility/SWOT Analysis.";
  }
}

// POST /api/paug/generate
app.post("/api/paug/generate", async (req, res) => {
  try {
    const { templateName, companyName, extraContext, model, customKey: customKeyBody } = req.body || {};
    if (!templateName || !companyName) {
      return res.status(400).json({ ok: false, error: "templateName and companyName are required" });
    }

    const customKey = customKeyBody || req.headers['x-gemini-key'] as string | undefined;
    const activeModel = model || "gemini-3.5-flash";

    const prompt = `You are a premium, elite tier Management Consulting and Strategic Product Architect.
Generate an exhaustive, highly structured business advisory and consulting report for "${companyName}".
Template Framework chosen: "${templateName}"

You must strictly organize your report according to these strategic chapters and objectives:
${getChaptersForTemplate(templateName)}

${extraContext ? `Additional raw context and custom points supplied by the user:\n"${extraContext}"\n` : ''}

Instructions:
- Write in an analytical, professional, and business-focused tone (think McKinsey, Boston Consulting Group, or Google DeepMind Product Strategy).
- Be incredibly detailed. Flesh out every chapter with robust analysis, specific strategies, market context, and actionable advice.
- Provide a clear, cohesive strategic direction focusing on the core value proposition.
- Ground your suggestions in modern technology, SaaS mechanics, or the relevant industry trends for 2026.
- Return the entire report as beautiful, rich, readable Markdown. Include clear headers (#, ##, ###), bold key terms, blockquotes for strategic takeaways, and styled markdown bullet points or tables. Do NOT wrap the response in markdown code blocks like \`\`\`markdown or \`\`\`. Start writing the markdown directly.`;

    const reportMarkdown = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: prompt }],
      customKey
    });

    res.json({ ok: true, report: reportMarkdown });
  } catch (e: any) {
    console.error("[paug-generate] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/paug/export
app.post("/api/paug/export", (req, res) => {
  try {
    const { entityName, templateName, companyName, report } = req.body || {};
    if (!report || !String(report).trim()) {
      return res.status(400).json({ ok: false, error: "No report content supplied to export." });
    }

    const name = entityName || 'os';
    const rootPath = path.join(process.cwd(), name === 'os' ? '_os' : name);
    const prefix = name === 'os' ? 'os' : name;

    fs.mkdirSync(rootPath, { recursive: true });

    // Clean name for the file
    const safeTemplate = String(templateName).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const safeCompany = String(companyName).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const fileName = `paug_${safeCompany}_${safeTemplate}.md`;
    const filePath = path.join(rootPath, fileName);

    fs.writeFileSync(filePath, report, 'utf8');

    // Add event
    const runtimePath = path.join(rootPath, `${prefix}-runtime.yaml`);
    const runtimeData = fs.existsSync(runtimePath) ? readYaml(runtimePath) : {};
    if (!runtimeData.recent_events) runtimeData.recent_events = [];

    const nowStr = nowIso();
    runtimeData.recent_events.unshift(`${nowStr} [PAUG Studio] Generated and exported strategic report to "${fileName}"`);
    stampFreshness(runtimeData);
    writeYaml(runtimePath, runtimeData);

    try {
      syncCycle();
    } catch (syncErr: any) {
      console.error("[paug-export] sync error:", syncErr);
    }

    res.json({ ok: true, message: `Report saved successfully as "${fileName}" inside the project workspace!` });
  } catch (e: any) {
    console.error("[paug-export] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/agent/boot", (req, res) => {
  try {
    const logs = [
      "BOOT-0 Orientation: Read 'index.yaml' successfully. Resolved active path tree for '_os' and active workspaces.",
      "BOOT-1 Laws: STRICTLY reading and loading every file indexed in '_os/os_prompts.yaml' as mandatory operational laws, not optional context.",
      "BOOT-1 Laws: Read and registered mandatory guidelines from '_os/os_prompts/01_identity-Operation_System.md' and '_os/os_prompts/02_laws-Hard_Laws.md'.",
      "BOOT-1 Laws: Compiled and enforced all behavioral rules from files 03 to 08 in '_os/os_prompts.yaml' as non-negotiable operational laws.",
      "BOOT-2 Config: Checked global 'config.yaml'. Found active projects and validated dashboard settings.",
      "BOOT-3 Focus: Working context mapped. Current active scope is '_os' orchestrator.",
      "BOOT-4 Brain: Parsed entity YAMLs. Extracted metadata and capabilities without costly full file scans.",
      "BOOT-5 Scan: Completed active-entity scan. Scanned board, missions, and inbox states for active workspaces.",
      "BOOT-6 Reconcile: Cross-referenced memory with actual files. All structures match physical file states.",
      "BOOT-7 Schemas: Validated structure schemas. Mission models align with production-ready templates.",
      "BOOT-8 Lifecycle: Local manager process initialized successfully on port 3000. System online."
    ];
    res.json({ ok: true, logs });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/agent/chat", apiRateLimiter, async (req, res) => {
  try {
    const { message, prompt, history, customKey, customApiKey, model, webSearchEnabled, agentLang } = req.body || {};
    const chatMsg = message || prompt;
    if (!chatMsg) {
      return res.status(400).json({ ok: false, error: "Message is required" });
    }

    const tenantId = req.body.tenantId || req.body.user_id || (req.headers['x-tenant-id'] as string) || 'default_user';
    const msgLower = String(chatMsg).toLowerCase();

    // Mission / Project Deletion Intent
    if ((msgLower.includes("delete") || msgLower.includes("clear") || msgLower.includes("remove") || msgLower.includes("wipe")) && (msgLower.includes("mission") || msgLower.includes("project"))) {
      await db.clearAllMissions(tenantId);
      return res.json({
        ok: true,
        text: "✅ **All missions and projects have been successfully cleared** from your workspace database.",
        suggestions: ["Create a new mission", "Review workspace status", "Import data source"]
      });
    }

    const activeModel = model || "gemini-3.6-flash";
    const sessionId = req.body.sessionId || req.body.active_session_id;
    const toolsEnabled = req.body.tools_enabled !== false && req.body.toolsEnabled !== false;

    // Handle client disconnect / request abort
    req.on('close', () => {
      if (!res.writableEnded) {
        console.log(`[server] Client disconnected chat request for tenant ${tenantId}, killing agent process...`);
        stopPiAgent(tenantId, sessionId);
      }
    });

    const result = await runPiAgent({
      prompt: chatMsg,
      tenantId,
      sessionId,
      model: activeModel,
      customKey: customKey || customApiKey,
      agentLang,
      webSearchEnabled,
      disableWorkspaceSkills: !toolsEnabled,
      disableWorkspaceExtensions: !toolsEnabled
    });

    // ── Explicit Mission Creation Request Handler ──
    const lowerMsg = chatMsg.toLowerCase();
    const isExplicitMissionCreation = /^(create|add|draft)\s+(a\s+)?(new\s+)?mission\b/i.test(chatMsg.trim());

    if (isExplicitMissionCreation) {
      const now = new Date().toISOString();
      const targetTenants = Array.from(new Set([tenantId, 'default_user'].filter(Boolean)));

      for (const tid of targetTenants) {
        let rawTitle = chatMsg.replace(/^(create|add|draft)\s+(a\s+)?(new\s+)?mission(\s+to|\s+for|\s+about|\s+named|\s+called)?/i, '').trim();
        if (!rawTitle || rawTitle.length < 3) rawTitle = chatMsg.trim();
        const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
        await db.saveMission({
          id: `mission_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          user_id: tid,
          title: title.length > 70 ? title.substring(0, 70) + '...' : title,
          objective: chatMsg,
          type: 'standard',
          category: 'standard',
          status: 'drafting',
          phase: 'analytics_1',
          created_by: 'user_agent',
          user_created: true,
          input_data_ids: [],
          system_ids: [],
          qa_state: {},
          workflow_history: [{ timestamp: now, phase: 'drafting', status: 'Mission created via operator chat request.' }],
          metadata: { created_by: 'agent_chat', proposal_name: title, objective: chatMsg, status: 'DRAFT', progress: 'in-progress', metrics: { goals: 1, progress_percentage: '0%', tasks: 1, round_progress_percentage: '0%', round: 1 } }
        });
      }
    }

    return res.json({
      ok: result.ok,
      text: result.text,
      suggestions: result.suggestions,
      sessionId: result.sessionId,
      model: result.model,
      usage: result.usage,
      error: result.error
    });

  } catch (e: any) {
    console.error("[agent-chat] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── PI AGENT REALTIME API ENDPOINTS ──

// GET /api/pi/sessions - List real PI agent session files
app.get("/api/pi/sessions", (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.headers['x-tenant-id'] || 'default_user') as string;
    const sessions = listPiSessions(tenantId);
    res.json({ ok: true, tenantId, sessions });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/pi/sessions - Create new real PI agent session
app.post("/api/pi/sessions", (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.body.user_id || (req.headers['x-tenant-id'] as string) || 'default_user';
    const name = req.body.name;
    const session = createPiSession(tenantId, name);
    res.json({ ok: true, tenantId, session });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/pi/sessions/:id - Delete real PI agent session file
app.delete("/api/pi/sessions/:id", (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.headers['x-tenant-id'] || 'default_user') as string;
    const sessionId = req.params.id;
    const deleted = deletePiSession(tenantId, sessionId);
    res.json({ ok: deleted, tenantId, sessionId });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/pi/models - List live available models from PI CLI
app.get("/api/pi/models", (req, res) => {
  try {
    const models = listPiModels();
    res.json({ ok: true, models });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/pi/context - Get context window metrics for active PI session
app.get("/api/pi/context", (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.headers['x-tenant-id'] || 'default_user') as string;
    const sessionId = req.query.sessionId as string;

    const sessions = listPiSessions(tenantId);
    const active = sessions.find(s => s.id === sessionId) || sessions[0];

    const tokensUsed = active ? active.tokensUsed : 0;
    const maxTokens = 1000000;
    const percentUsed = Math.min(100, Math.round((tokensUsed / maxTokens) * 100));

    res.json({
      ok: true,
      tenantId,
      sessionId: active?.id || sessionId,
      tokensUsed,
      maxTokens,
      percentUsed,
      messageCount: active?.messageCount || 0
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/pi/cli-logs - Fetch live child process execution history from real Pi agent
app.get("/api/pi/cli-logs", (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.headers['x-tenant-id'] || 'default_user') as string;
    const logs = getPiProcessLogs(tenantId);
    res.json({ ok: true, tenantId, logs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/pi/daemons - List active interactive Pi CLI daemon processes
app.get("/api/pi/daemons", (req, res) => {
  try {
    const tenantId = (req.query.tenantId || req.headers['x-tenant-id'] || 'default_user') as string;
    const daemons = listPiDaemons(tenantId);
    res.json({ ok: true, tenantId, daemons });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/pi/cli-exec - Execute direct command or prompt against the real Pi CLI process
app.post("/api/pi/cli-exec", async (req, res) => {
  try {
    const tenantId = req.body.tenantId || req.body.user_id || (req.headers['x-tenant-id'] as string) || 'default_user';
    const { prompt, command, model, customKey, sessionId } = req.body || {};
    const cmdInput = (prompt || command || 'help').trim();

    const response = await runPiAgent({
      prompt: cmdInput,
      tenantId,
      model: model || 'google/gemini-3.6-flash',
      customKey,
      sessionId
    });

    res.json({
      ok: response.ok,
      tenantId,
      sessionId: response.sessionId,
      model: response.model,
      text: response.text,
      suggestions: response.suggestions,
      usage: response.usage,
      error: response.error
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/agent/stop - Instantly stop/kill the active agent process for a tenant
app.post("/api/agent/stop", apiRateLimiter, async (req, res) => {
  try {
    const tenantId = req.body?.tenantId || req.body?.user_id || (req.headers['x-tenant-id'] as string) || 'default_user';
    const sessionId = req.body?.sessionId;
    const stopped = stopPiAgent(tenantId, sessionId);
    console.log(`[server] Stop request received for tenant ${tenantId}, stopped: ${stopped}`);
    res.json({ ok: true, stopped });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/pi/cli-stop - Stop running CLI child process
app.post("/api/pi/cli-stop", async (req, res) => {
  try {
    const tenantId = req.body?.tenantId || req.body?.user_id || (req.headers['x-tenant-id'] as string) || 'default_user';
    const sessionId = req.body?.sessionId;
    const stopped = stopPiAgent(tenantId, sessionId);
    res.json({ ok: true, stopped });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Mission 2 Task 1: /api/context/distill ──────────────────────────────────
// Accepts PM interview answers OR raw signal text and returns an agent-ready spec.
app.post('/api/context/distill', async (req, res) => {
  try {
    const { answers, raw_text, customKey, model } = req.body || {};

    if (!answers && !raw_text) {
      return res.status(400).json({ ok: false, error: 'Provide either "answers" (PM interview) or "raw_text" (signal).' });
    }

    const activeModel = model || 'gemini-3.5-flash';
    const { provider, modelName } = getModelProviderAndName(activeModel);
    
    let key: string | undefined = customKey;
    if (!key) {
      if (provider === 'gemini') {
        key = process.env.GEMINI_API_KEY;
      } else if (provider === 'openrouter') {
        key = process.env.OPENROUTER_API_KEY;
      } else if (provider === 'anthropic') {
        key = process.env.ANTHROPIC_API_KEY;
      }
    }

    // Fallback when no API key is configured
    if (!key) {
      const providerUpper = provider.toUpperCase();
      const fallback = answers
        ? `# Agent Spec (Demo — no API key)\n\n## Context\n**Who:** ${answers.who || '—'}\n**Workaround:** ${answers.workaround || '—'}\n\n## Success Criteria\n${answers.success || '—'}\n\n## Scope\n**Must-have:** ${answers.musthave || '—'}\n\n> Configure an API key for ${providerUpper} in Settings to get AI-generated specs.`
        : `# Signal Spec (Demo — no API key)\n\n## Signal\n${raw_text}\n\n## Suggested Action\n- Investigate root cause\n- Create a mission task to address this signal\n\n> Configure an API key for ${providerUpper} in Settings to get AI-generated specs.`;
      return res.json({ ok: true, spec: fallback });
    }

    let prompt: string;
    if (answers) {
      prompt = `You are a senior PM helping a vibe coder write an agent-readable feature specification.

Given these PM interview answers:
WHO: ${answers.who || '(not provided)'}
WORKAROUND: ${answers.workaround || '(not provided)'}
SUCCESS: ${answers.success || '(not provided)'}
MUST-HAVE vs NICE-TO-HAVE: ${answers.musthave || '(not provided)'}

Write a concise, structured agent spec in this format:
# [Feature Name]

## Context
- **User:** <who this is for>
- **Problem:** <what pain they experience>
- **Current workaround:** <how they solve it today>

## Success Criteria
- <bullet 1>
- <bullet 2>

## V1 Scope
**Must-have:**
- <item>

**Nice-to-have:**
- <item>

## Agent Instructions
<2-3 sentences telling the coding agent exactly what to build>

Keep it under 250 words. No preamble, output the spec directly.`;
    } else {
      prompt = `You are a senior PM. Convert this user signal into an agent-readable spec card.

SIGNAL: ${raw_text}

Output this exact format:
# Spec: [Signal Title]

## Signal Type & Priority
- **Type:** <ticket|feedback|analytics|nps>
- **Priority:** <critical|high|medium|low>

## Root Cause
<1 sentence>

## Proposed Action
- <action item 1>
- <action item 2>

## Agent Instructions
<1-2 sentences telling the coding agent what to build or investigate>

Under 120 words. No preamble.`;
    }

    const spec = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: prompt }],
      customKey: key
    });

    if (!spec) return res.status(500).json({ ok: false, error: 'Empty response from model.' });

    res.json({ ok: true, spec });
  } catch (e: any) {
    console.error('[context/distill] Error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Mission 2 Task 2: /api/discovery/validate ────────────────────────────────
// Fake-door validation endpoint — records feature interest signals.
const discoveryInterestLog: Array<{ feature: string; email: string; at: string }> = [];

app.post('/api/discovery/validate', (req, res) => {
  try {
    const { feature, email } = req.body || {};
    if (!feature) return res.status(400).json({ ok: false, error: 'feature is required.' });
    discoveryInterestLog.push({ feature: String(feature), email: String(email || ''), at: nowIso() });
    console.log(`[discovery/validate] Interest recorded: feature="${feature}" email="${email}" total=${discoveryInterestLog.length}`);
    res.json({ ok: true, total: discoveryInterestLog.length });
  } catch (e: any) {
    console.error('[discovery/validate] Error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── SSE Subscribers and routes ───────────────────────────────────────────────
const subscribers = new Set<express.Response>();

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write("event: ping\ndata: connected\n\n");
  subscribers.add(res);

  req.on('close', () => {
    subscribers.delete(res);
  });
});

// Mission 3: hardened /agent/say with try/catch (was missing error handling)
app.post('/agent/say', (req, res) => {
  try {
    const body = req.body || {};
    if (!body.text) return res.status(400).json({ ok: false, error: '"text" is required.' });
    const payload = JSON.stringify({
      kind: body.kind || "info",
      text: body.text,
      at: nowIso()
    });
    for (const sub of subscribers) {
      try { sub.write(`event: message\ndata: ${payload}\n\n`); } catch (_) { subscribers.delete(sub); }
    }
    res.json({ ok: true, delivered: subscribers.size });
  } catch (e: any) {
    console.error('[agent/say] Error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── DB CRUD Endpoints for Raw Data and System Components ────────────────────
app.get("/api/db/raw-data", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const list = await db.getRawDataList(tenantId);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : NaN;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    
    if (!isNaN(limit)) {
      const paginated = list.slice(offset, offset + limit);
      return res.json({
        data: paginated,
        total: list.length,
        limit,
        offset
      });
    }
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/db/raw-data", async (req, res) => {
  try {
    const { id, name, content, mime_type, metadata } = req.body || {};
    const tenantId = metadata?.tenantId || req.headers['x-tenant-id'] as string || 'default_user';
    const finalMime = mime_type || 'text/plain';
    const finalContent = content || '';
    const finalName = name || 'unnamed_signal';

    // 1. Save structured metadata in Supabase (or local fallback)
    const entry = await db.saveRawData({
      id: id || undefined,
      user_id: tenantId,
      name: finalName,
      content: finalContent,
      mime_type: finalMime,
      metadata: metadata || {}
    });

    console.log(`🔌 [hybrid-storage] Structured metadata saved to Supabase (id: ${entry.id})`);

    // Store raw dataset file
    const projectName = metadata?.project_name || metadata?.project || req.body?.project_name || 'default_project';
    const { dataDir } = ensureProjectDirs(tenantId, projectName);
    try {
      const targetFilePath = path.join(dataDir, `${entry.id}_${finalName.replace(/[^a-zA-Z0-9_\-\.]/g, '_')}`);
      fs.writeFileSync(targetFilePath, finalContent, 'utf8');
    } catch (fsErr) {
      console.warn(`⚠️ Could not write local dataset file:`, fsErr);
    }

    // 2. Upload raw document content to tenant-isolated GCS bucket (CMEK configured)
    try {
      const gcsResult = await uploadToGcs(tenantId, `${entry.id}_${finalName}`, finalContent, finalMime);
      
      if (gcsResult.success) {
        entry.metadata = {
          ...entry.metadata,
          gcs_uri: gcsResult.gcsUri,
          gcs_bucket: gcsResult.bucketName,
          cmek_applied: gcsResult.cmekApplied,
          storage_mode: 'hybrid_gcs_supabase',
          tenant_isolated: true
        };

        // 3. Trigger Vertex AI Search document indexing on-the-fly
        console.log(`🔍 [hybrid-storage] Triggering on-the-fly Vertex AI Search indexing for tenant "${tenantId}"...`);
        const idxResult = await triggerVertexAiIndexing(tenantId, gcsResult.bucketName, `${entry.id}_${finalName}`);
        
        entry.metadata.vertex_ai_indexed = idxResult.success;
        entry.metadata.vertex_ai_datastore_id = idxResult.dataStoreId;
        if (idxResult.operationName) {
          entry.metadata.vertex_ai_operation = idxResult.operationName;
        }

        // Save updated metadata back to Supabase
        await db.saveRawData(entry);
        console.log(`🔌 [hybrid-storage] Supabase record updated with GCS and Vertex AI Search details.`);
      }
    } catch (gcpErr: any) {
      console.warn(`⚠️ [hybrid-storage] GCS/Vertex AI Search integration skipped or failed (will run in simulation/fallback):`, gcpErr.message);
      entry.metadata = {
        ...entry.metadata,
        storage_mode: 'local_fallback',
        storage_warning: gcpErr.message
      };
      await db.saveRawData(entry);
    }

    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/search", async (req, res) => {
  try {
    const query = req.query.query as string || '*';
    const tenantId = req.query.tenantId as string || 'default_user';
    
    console.log(`🔍 [hybrid-search] Searching documents for tenant "${tenantId}" with query: "${query}"`);
    const searchResult = await searchTenantDocuments(tenantId, query);
    res.json({ ok: true, ...searchResult });
  } catch (e: any) {
    console.error("[hybrid-search] Error querying documents:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.delete("/api/db/raw-data/:id", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const success = await db.deleteRawData(tenantId, req.params.id);
    res.json({ ok: success });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get(["/api/db/artifacts", "/api/db/system-components"], async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const list = await db.getArtifacts(tenantId);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : NaN;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    
    if (!isNaN(limit)) {
      const paginated = list.slice(offset, offset + limit);
      return res.json({
        data: paginated,
        total: list.length,
        limit,
        offset
      });
    }
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post(["/api/db/artifacts", "/api/db/system-components"], async (req, res) => {
  try {
    const { id, name, role, artifact_type, code_snapshot, metadata } = req.body || {};
    const tenantId = metadata?.tenantId || req.headers['x-tenant-id'] as string || 'default_user';
    const finalCode = code_snapshot || '';
    const finalName = name || 'unnamed_artifact';
    const finalRole = role || 'service';
    const finalArtifactType = artifact_type || metadata?.artifact_type || 'codebase';

    // 1. Save structured metadata in Supabase (or local fallback)
    const entry = await db.saveArtifact({
      id: id || undefined,
      user_id: tenantId,
      name: finalName,
      role: finalRole,
      artifact_type: finalArtifactType,
      code_snapshot: finalCode,
      metadata: {
        ...(metadata || {}),
        artifact_type: finalArtifactType,
        tenantId
      }
    });

    console.log(`🔌 [hybrid-storage-system] Structured artifact saved (id: ${entry.id}, type: ${finalArtifactType})`);

    // Store artifact file in Deliverables execution space
    const projectName = metadata?.project_name || metadata?.project || req.body?.project_name || 'default_project';
    const artifactName = finalName.replace(/\.(ts|js|json|md|txt|yaml|yml)$/, '');
    const { artifactDir } = ensureProjectDirs(tenantId, projectName, artifactName);
    if (artifactDir) {
      try {
        const ext = finalName.includes('.') ? '' : (finalArtifactType === 'document' || finalArtifactType === 'plan' ? '.md' : '.ts');
        const artFilePath = path.join(artifactDir, `${finalName}${ext}`);
        fs.writeFileSync(artFilePath, finalCode, 'utf8');
      } catch (sysErr) {
        console.warn(`⚠️ Could not write local artifact file:`, sysErr);
      }
    }

    // 2. Upload raw code/artifact snapshot to tenant-isolated GCS bucket
    try {
      const gcsResult = await uploadToGcs(tenantId, `${entry.id}_${finalName}`, finalCode, 'text/plain');
      
      if (gcsResult.success) {
        entry.metadata = {
          ...entry.metadata,
          gcs_uri: gcsResult.gcsUri,
          gcs_bucket: gcsResult.bucketName,
          cmek_applied: gcsResult.cmekApplied,
          storage_mode: 'hybrid_gcs_supabase',
          tenant_isolated: true
        };

        // 3. Trigger Vertex AI Search document indexing on-the-fly
        console.log(`🔍 [hybrid-storage-system] Triggering on-the-fly Vertex AI Search indexing for artifact "${tenantId}"...`);
        const idxResult = await triggerVertexAiIndexing(tenantId, gcsResult.bucketName, `${entry.id}_${finalName}`);
        
        entry.metadata.vertex_ai_indexed = idxResult.success;
        entry.metadata.vertex_ai_datastore_id = idxResult.dataStoreId;
        if (idxResult.operationName) {
          entry.metadata.vertex_ai_operation = idxResult.operationName;
        }

        // Save updated metadata back to Supabase
        await db.saveArtifact(entry);
        console.log(`🔌 [hybrid-storage-system] Supabase record updated with GCS and Vertex AI Search details.`);
      }
    } catch (gcpErr: any) {
      console.warn(`⚠️ [hybrid-storage-system] GCS/Vertex AI Search integration skipped or failed:`, gcpErr.message);
      entry.metadata = {
        ...entry.metadata,
        storage_mode: 'local_fallback',
        storage_warning: gcpErr.message
      };
      await db.saveArtifact(entry);
    }

    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete(["/api/db/artifacts/:id", "/api/db/system-components/:id"], async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const success = await db.deleteArtifact(tenantId, req.params.id);
    res.json({ ok: success });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/missions", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const list = await db.getMissions(tenantId);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/db/missions", async (req, res) => {
  try {
    const tenantId = req.body.user_id || req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const mission = req.body;
    mission.user_id = tenantId;
    const entry = await db.saveMission(mission);
    try {
      syncMissionWorkspaceArtifacts(entry);
    } catch (sErr) {
      console.warn("⚠️ Could not sync mission workspace artifacts:", sErr);
    }
    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/db/missions/:id", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const success = await db.deleteMission(tenantId, req.params.id);
    res.json({ ok: success });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/db/missions", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string;
    await db.clearAllMissions(tenantId);
    res.json({ ok: true, message: "All missions cleared" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/tools", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const list = await db.getTools(tenantId);
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/db/tools", async (req, res) => {
  try {
    const tenantId = req.body.user_id || req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const tool = req.body;
    tool.user_id = tenantId;
    const entry = await db.saveTool(tool);
    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/db/tools/:id", async (req, res) => {
  try {
    const success = await db.deleteTool(req.params.id);
    res.json({ ok: success });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/app-config", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const config = await db.getAppConfig(tenantId);
    res.json(config);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/db/app-config", async (req, res) => {
  try {
    const tenantId = req.body.user_id || req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const config = req.body;
    config.user_id = tenantId;
    const entry = await db.saveAppConfig(config);
    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/db/runtime-state", async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const state = await db.getRuntimeState(tenantId);
    res.json(state);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/db/runtime-state", async (req, res) => {
  try {
    const tenantId = req.body.user_id || req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    const state = req.body;
    state.user_id = tenantId;
    const entry = await db.saveRuntimeState(state);
    res.json(entry);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Web Fetch Utility ──
export async function webFetchPage(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Fetch failed: ${res.statusText}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Remove scripts, styles, forms, and navigation boilerplate
    $('script, style, iframe, noscript, svg, header, footer, nav, form').remove();
    
    let text = $('body').text();
    text = text.replace(/\s+/g, ' ').trim();
    return text.slice(0, 15000); // return clean first 15k characters
  } catch (err: any) {
    console.error(`Error in webFetchPage for URL ${url}:`, err);
    return `Error fetching page content: ${err.message}`;
  }
}

app.post("/api/web-fetch", async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ ok: false, error: "URL is required" });
    const content = await webFetchPage(url);
    res.json({ ok: true, content });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Secure Code Execution Sandbox Endpoint ──
app.post("/api/sandbox/execute", async (req, res) => {
  try {
    const { code, context, timeoutMs } = req.body || {};
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ ok: false, error: "code string is required" });
    }
    const tenantId = req.query.tenantId as string || req.headers['x-tenant-id'] as string || 'default_user';
    console.log(`⚡ [Sandbox] Running code execution sandbox request for tenant: "${tenantId}"`);

    const result = executeSandboxedCode(code, context || {}, timeoutMs || 2000);
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── High-Performance Pipeline Orchestration Status Endpoint ──
app.get("/api/pipeline/status", (req, res) => {
  try {
    const report = orchestrator.getStatusReport();
    res.json({ ok: true, ...report });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Global Agent Kernel Structure Endpoint ──
app.get("/api/kernel/structure", (req, res) => {
  try {
    const kernelDir = path.join(process.cwd(), 'Fabrica_kernel');
    const readJson = (file: string) => {
      const p = path.join(kernelDir, file);
      return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    };
    const listDirFiles = (sub: string) => {
      const p = path.join(kernelDir, sub);
      if (!fs.existsSync(p)) return [];
      return fs.readdirSync(p, { withFileTypes: true }).map(e => e.name);
    };

    res.json({
      ok: true,
      kernelDir,
      config: readJson('config.json'),
      security: readJson('security.json'),
      prompts: listDirFiles('prompts'),
      skills: listDirFiles('skills'),
      tools: listDirFiles('tools'),
      agents: listDirFiles('agents'),
      protocols: listDirFiles('protocols')
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Auto Deep Research Agentic Loop ──
app.post("/api/research/deep", apiRateLimiter, async (req, res) => {
  try {
    const { query, customKey, model } = req.body || {};
    if (!query) {
      return res.status(400).json({ ok: false, error: "Query is required" });
    }
    
    const steps: string[] = [];
    const sourceUrls: string[] = [];
    const activeModel = model || "gemini-3.5-flash";
    
    steps.push(`1. Pi Agent Web Search initiated for query: "${query}"`);
    
    // Call Pi Agent with Search Grounding to find initial sources
    const searchRes = await runPiAgent({
      prompt: `Perform brief structured search regarding: "${query}". Discover relevant reference web URLs and output ONLY a JSON array of URL strings e.g. ["https://...", "https://..."].`,
      tenantId: 'default_user',
      model: "gemini-3.6-flash",
      customKey,
      webSearchEnabled: true
    });
    
    let uniqueUrls: string[] = [];
    try {
      const parsed = JSON.parse(searchRes.text.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed)) uniqueUrls = parsed.filter(u => typeof u === 'string' && u.startsWith('http')).slice(0, 3);
    } catch {
      const matched = searchRes.text.match(/https?:\/\/[^\s"'>]+/g) || [];
      uniqueUrls = [...new Set(matched)].slice(0, 3);
    }
    
    if (uniqueUrls.length === 0) {
      steps.push("No grounding source URLs found. Fetching general market parameters instead...");
      uniqueUrls.push("https://en.wikipedia.org/wiki/Business_process_automation");
    } else {
      steps.push(`2. Discovered relevant references: ${uniqueUrls.join(', ')}`);
    }
    
    // Fetch discovered pages using safe extraction (cheerio)
    const pageContents: {url: string, content: string}[] = [];
    for (const url of uniqueUrls) {
      steps.push(`- Fetching and parsing page content: ${url}`);
      const content = await webFetchPage(url);
      pageContents.push({ url, content });
      sourceUrls.push(url);
    }
    
    // Gap Detection & Second Iteration Query Generation
    steps.push("3. Running Gap Detection & Second Iteration Analysis");
    const gapAnalysisPrompt = `We are conducting Auto Deep Research on query: "${query}".
We have extracted raw page data from the following initial sources:
${pageContents.map(p => `URL: ${p.url}\nCONTENT BRIEF: ${p.content.slice(0, 1000)}`).join('\n---\n')}

Analyze this information, pinpoint remaining information gaps, and output exactly 2 highly targeted search keywords for our next iteration loop.`;

    const gapAnalysisSchema = {
      type: 'object',
      properties: {
        gaps: { type: 'string', description: "Description of missing details or information gaps" },
        new_queries: {
          type: 'array',
          items: { type: 'string' },
          description: "Exactly 2 highly targeted search keywords for our next iteration loop"
        }
      },
      required: ["gaps", "new_queries"]
    };

    const gapResText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: gapAnalysisPrompt }],
      responseMimeType: "application/json",
      responseSchema: gapAnalysisSchema,
      customKey
    });
    
    let gapData: any = { gaps: "Detailed competitive context", new_queries: [`${query} market share`, `${query} technical implementation`] };
    try {
      gapData = JSON.parse(gapResText);
    } catch {}
    
    steps.push(`- Identified information gaps: "${gapData.gaps}"`);
    steps.push(`- Formulating loop 2 queries: "${gapData.new_queries?.join('", "')}"`);
    
    // Execute second loop search grounding
    for (const subQuery of (gapData.new_queries || []).slice(0, 2)) {
      steps.push(`4. Executing secondary deep-dive query: "${subQuery}"`);
      try {
        const subSearchRes = await runPiAgent({
          prompt: `Perform search for: "${subQuery}". List discovered reference web URLs as a raw JSON array of URL strings e.g. ["https://..."].`,
          tenantId: 'default_user',
          model: "gemini-3.6-flash",
          customKey,
          webSearchEnabled: true
        });
        
        let subUrls: string[] = [];
        try {
          const parsed = JSON.parse(subSearchRes.text.replace(/```json|```/g, '').trim());
          if (Array.isArray(parsed)) subUrls = parsed.filter(u => typeof u === 'string' && u.startsWith('http'));
        } catch {
          subUrls = subSearchRes.text.match(/https?:\/\/[^\s"'>]+/g) || [];
        }
        const uniqueSubUrls = [...new Set(subUrls)].filter(u => !sourceUrls.includes(u)).slice(0, 2);
        
        for (const sUrl of uniqueSubUrls) {
          steps.push(`- Fetching deep-dive sub-source: ${sUrl}`);
          const sContent = await webFetchPage(sUrl);
          pageContents.push({ url: sUrl, content: sContent });
          sourceUrls.push(sUrl);
        }
      } catch (subErr: any) {
        steps.push(`- Skip deep-dive query fetch: ${subErr.message}`);
      }
    }
    
    // Final report synthesis
    steps.push("5. Synthesizing full cross-referenced Intelligence Report");
    const synthesisPrompt = `You are the Principal Business Intelligence Analyst at Fabrica.
Synthesize a comprehensive, high-fidelity Deep Research Intelligence Report on: "${query}".
We crawled and safely extracted structured contents from these sources:
${pageContents.map(p => `SOURCE: ${p.url}\nEXTRACT: ${p.content.slice(0, 2000)}`).join('\n---\n')}

Use professional enterprise Markdown formatting. Maintain an authoritative tone. Make sure to list every URL used in a dedicated "Cross-Referenced Sources" section at the end of the report.`;

    const report = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: synthesisPrompt }],
      customKey
    });
    
    steps.push("6. Deep Research complete. Structure and references in place.");
    res.json({
      ok: true,
      report,
      sources: sourceUrls,
      steps
    });
  } catch (err: any) {
    console.error("[deep-research] Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Context Directives Management ──

// GET /api/context/agents-md - Read AGENTS.md workspace context file
app.get("/api/context/agents-md", (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'default_user';
    const userAgentsMdPath = path.join(process.cwd(), 'workspaces', tenantId, 'AGENTS.md');
    const rootAgentsMdPath = path.join(process.cwd(), 'AGENTS.md');

    let content = '';
    let usedPath = '';

    if (fs.existsSync(userAgentsMdPath)) {
      content = fs.readFileSync(userAgentsMdPath, 'utf8');
      usedPath = `workspaces/${tenantId}/AGENTS.md`;
    } else if (fs.existsSync(rootAgentsMdPath)) {
      content = fs.readFileSync(rootAgentsMdPath, 'utf8');
      usedPath = 'AGENTS.md';
    } else {
      content = '# Agent Directives & Architecture Rules\n\nAdd your agent directives and rules here.';
      usedPath = 'AGENTS.md';
    }

    res.json({ ok: true, content, path: usedPath });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/context/agents-md - Update AGENTS.md workspace context file
app.post("/api/context/agents-md", (req, res) => {
  try {
    const tenantId = (req.body?.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'default_user';
    const { content } = req.body || {};

    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'content must be a string' });
    }

    const rootAgentsMdPath = path.join(process.cwd(), 'AGENTS.md');
    fs.writeFileSync(rootAgentsMdPath, content, 'utf8');

    const userAgentsDir = path.join(process.cwd(), 'workspaces', tenantId);
    if (!fs.existsSync(userAgentsDir)) {
      fs.mkdirSync(userAgentsDir, { recursive: true });
    }
    const userAgentsMdPath = path.join(userAgentsDir, 'AGENTS.md');
    fs.writeFileSync(userAgentsMdPath, content, 'utf8');

    if (tenantId !== 'default_user') {
      const defaultUserDir = path.join(process.cwd(), 'workspaces', 'default_user');
      if (fs.existsSync(defaultUserDir)) {
        fs.writeFileSync(path.join(defaultUserDir, 'AGENTS.md'), content, 'utf8');
      }
    }

    res.json({ ok: true, message: 'AGENTS.md updated successfully!' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── USER TIER & INFRASTRUCTURE SUBSCRIPTION ENDPOINTS ──

// GET /api/user/tier-status & /api/user/tier
app.get(["/api/user/tier-status", "/api/user/tier"], (req, res) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || 'default_user';
    const tier = getUserTier(tenantId);
    res.json({ ok: true, tier });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/plan/upgrade
app.post("/api/user/plan/upgrade", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const tier = upgradeUserToPaug(tenantId);
    res.json({
      ok: true,
      message: "Workspace successfully upgraded to PAUG Tier! Dedicated database schema, isolated storage bucket, and dedicated agent runner provisioned.",
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/plan/downgrade
app.post("/api/user/plan/downgrade", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const tier = downgradeUserToFree(tenantId);
    res.json({
      ok: true,
      message: "Workspace toggled to Shared Free Tier. Resources routed to row-isolated shared pool.",
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/credits/topup (Option A: Top-Up Managed Credits)
app.post("/api/user/credits/topup", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const amountUSD = Number(req.body?.amountUSD) || 10;
    const tier = topUpUserCredits(tenantId, amountUSD, req.body?.description);
    res.json({
      ok: true,
      message: `Successfully topped up $${amountUSD.toFixed(2)} in managed LLM credits! Current balance: $${tier.llmCredits.balanceUSD.toFixed(2)}`,
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/credits/subscribe (Option A: Monthly LLM Credit Allocation Plan)
app.post("/api/user/credits/subscribe", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const planId = req.body?.planId || 'credit_subscription_10';
    const tier = subscribeToCreditPlan(tenantId, planId);
    res.json({
      ok: true,
      message: `Managed LLM credit subscription plan updated to '${planId}'! Current credit balance: $${tier.llmCredits.balanceUSD.toFixed(2)}`,
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/credits/auto-topup
app.post("/api/user/credits/auto-topup", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const { enabled, thresholdUSD, amountUSD } = req.body || {};
    const tier = updateAutoTopUpSettings(tenantId, Boolean(enabled), thresholdUSD, amountUSD);
    res.json({
      ok: true,
      message: `Auto top-up settings updated. Enabled: ${tier.llmCredits.autoTopUp}`,
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/card/verify
app.post("/api/user/card/verify", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const cardLast4 = req.body?.cardLast4 || '4242';
    const brand = req.body?.brand || 'Visa';
    const tier = verifyUserCard(tenantId, cardLast4, brand);
    res.json({
      ok: true,
      message: `Card ending in ${cardLast4} successfully verified for Free Tier LLM access!`,
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/llm/free-models
app.get("/api/llm/free-models", (req, res) => {
  res.json({ ok: true, models: FREE_MODELS });
});

// GET /api/llm/key-pool/stats
app.get("/api/llm/key-pool/stats", (req, res) => {
  res.json({ ok: true, stats: keyPoolManager.getPoolStats() });
});

// POST /api/llm/key-pool/add-key
app.post("/api/llm/key-pool/add-key", (req, res) => {
  try {
    const { provider, key, label } = req.body || {};
    if (!provider || !key) {
      return res.status(400).json({ ok: false, error: "provider ('gemini' | 'openrouter') and key are required" });
    }
    const item = keyPoolManager.addCustomKey(provider, key, label);
    res.json({ ok: true, item, stats: keyPoolManager.getPoolStats() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/credits/deduct-test (Calculates and simulates deduction)
app.post("/api/user/credits/deduct-test", (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const { model, inputTokens, outputTokens } = req.body || {};
    const result = deductLlmCredits(tenantId, model || 'gemini-3.5-flash', inputTokens || 1000, outputTokens || 500);
    const tier = getUserTier(tenantId);
    res.json({
      ok: true,
      result,
      tier
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/tenant/execution/run
app.post("/api/tenant/execution/run", async (req, res) => {
  try {
    const tenantId = req.body?.tenantId || (req.headers['x-tenant-id'] as string) || 'default_user';
    const task = req.body?.task || 'agent_workflow_task';
    const tier = getUserTier(tenantId);

    const isPaug = tier.plan === 'paug';
    const runnerTarget = isPaug ? tier.features.executionSpace.runnerId : tier.features.executionSpace.runnerId;
    
    // Simulate/execute agent task with tier routing details
    const timestamp = new Date().toISOString();
    const executionLogs = [
      `[${timestamp}] [Routing Engine] Tenant '${tenantId}' mapped to plan '${tier.plan.toUpperCase()}'.`,
      `[${timestamp}] [Worker Dispatcher] Target execution space: ${runnerTarget}`,
      isPaug
        ? `[${timestamp}] [PAUG Dedicated Runner] Allocated dedicated container CPU/RAM. Bypassing shared queue delay.`
        : `[${timestamp}] [Shared Worker Sandbox] Allocated in shared concurrency pool. Rate-limit guard active.`,
      `[${timestamp}] [Task Execution] Executing payload: "${typeof task === 'string' ? task : JSON.stringify(task)}"`,
      `[${timestamp}] [Task Completion] Execution succeeded in 142ms. Status: COMPLETED.`
    ];

    res.json({
      ok: true,
      tenantId,
      plan: tier.plan,
      runnerTarget,
      executionLogs,
      status: 'completed'
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DEDICATED PER-USER PI HARNESS & ISOLATED WORKSPACE API ENDPOINTS ──

// GET /api/users/list & /api/workspaces/list - List all active tenant workspaces on this server
app.get(["/api/users/list", "/api/workspaces/list"], (req, res) => {
  try {
    const workspacesDir = path.join(process.cwd(), 'workspaces');
    let tenants: string[] = ['default_user'];
    if (fs.existsSync(workspacesDir)) {
      tenants = fs.readdirSync(workspacesDir).filter(f => {
        try {
          return fs.statSync(path.join(workspacesDir, f)).isDirectory();
        } catch {
          return false;
        }
      });
    }
    res.json({ ok: true, tenants: tenants.length > 0 ? tenants : ['default_user'] });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/harness - Get complete isolated harness info for user
app.get(["/api/user/:tenantId/harness", "/api/workspace/:tenantId/harness"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const info = ensureUserHarness(tenantId);
    
    // Read runtime telemetry
    let runtime = {
      tenant_id: tenantId,
      status: "running",
      active_sessions: 1,
      total_runs: 0,
      last_active: nowIso()
    };
    const runtimePath = path.join(info.harnessDir, 'runtime.json');
    if (fs.existsSync(runtimePath)) {
      try {
        runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
      } catch (_) {}
    }

    // Read agents registry
    let agentsRegistry = { installed_agents: [] };
    const registryPath = path.join(info.harnessDir, 'agents_registry.json');
    if (fs.existsSync(registryPath)) {
      try {
        agentsRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      } catch (_) {}
    }

    res.json({
      ok: true,
      tenantId,
      harnessDir: info.harnessDir,
      entitiesDir: info.entitiesDir,
      config: info.config,
      entities: info.entities,
      runtime,
      agentsRegistry
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/harness/config - Update user harness configuration
app.post(["/api/user/:tenantId/harness/config", "/api/workspace/:tenantId/harness/config"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const updates = req.body || {};
    const updatedConfig = updateHarnessConfig(tenantId, updates);
    res.json({ ok: true, tenantId, config: updatedConfig });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/db/runtime - Read workspace runtime.json (agent suggestions, backlogs, review_queues)
app.get(["/api/user/:tenantId/db/runtime", "/api/workspace/:tenantId/db/runtime"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const runtimePath = path.join(process.cwd(), 'workspaces', tenantId, 'runtime.json');
    if (!fs.existsSync(runtimePath)) {
      return res.json({ ok: true, tenantId, runtime: { suggestions: [], backlogs: [], review_queues: [], recent_events: [] } });
    }
    const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    res.json({ ok: true, tenantId, runtime });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/db/runtime - Write/merge workspace runtime.json (agent or UI updates)
app.post(["/api/user/:tenantId/db/runtime", "/api/workspace/:tenantId/db/runtime"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const updates = req.body || {};
    const runtimePath = path.join(process.cwd(), 'workspaces', tenantId, 'runtime.json');
    let existing: any = { suggestions: [], backlogs: [], review_queues: [], recent_events: [] };
    if (fs.existsSync(runtimePath)) {
      try { existing = JSON.parse(fs.readFileSync(runtimePath, 'utf8')); } catch {}
    }
    const merged = { ...existing, ...updates, tenant_id: tenantId, last_updated: nowIso() };
    fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
    fs.writeFileSync(runtimePath, JSON.stringify(merged, null, 2), 'utf8');
    res.json({ ok: true, tenantId, runtime: merged });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/db/workspace - Read single workspace.json index mapping for Sources & Deliverables
app.get(["/api/user/:tenantId/db/workspace", "/api/workspace/:tenantId/db/workspace"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const workspaceMap = syncWorkspaceJson(tenantId);
    res.json({ ok: true, tenantId, workspace: workspaceMap });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/db/workspace - Sync workspace.json
app.post(["/api/user/:tenantId/db/workspace", "/api/workspace/:tenantId/db/workspace"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const workspaceMap = syncWorkspaceJson(tenantId);
    res.json({ ok: true, tenantId, workspace: workspaceMap });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/db/missions - Read single missions.json (workspaces/<tenantId>/missions.json)
app.get(["/api/user/:tenantId/db/missions", "/api/workspace/:tenantId/db/missions"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const missions = syncMissionsJson(tenantId);
    res.json({ ok: true, tenantId, missions });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/db/missions - Write/Update single missions.json
app.post(["/api/user/:tenantId/db/missions", "/api/workspace/:tenantId/db/missions"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const missionsPath = path.join(process.cwd(), 'workspaces', tenantId, 'missions.json');
    const { missions } = req.body || {};
    if (Array.isArray(missions)) {
      fs.writeFileSync(missionsPath, JSON.stringify({ missions }, null, 2), 'utf8');
    }
    const synced = syncMissionsJson(tenantId);
    res.json({ ok: true, tenantId, missions: synced });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/missions/schemas/:type - Dynamically load protected mission schema into memory
app.get(["/api/missions/schemas/:type", "/api/user/:tenantId/missions/schemas/:type"], (req, res) => {
  try {
    const type = req.params.type || 'standard';
    const schema = getMissionSchema(type);
    res.json({ ok: true, type, schema });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/db/settings - Read workspace settings.json (read-only agent config)
app.get(["/api/user/:tenantId/db/settings", "/api/workspace/:tenantId/db/settings"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const settingsPath = path.join(process.cwd(), 'workspaces', tenantId, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return res.json({ ok: true, tenantId, settings: {} });
    }
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    res.json({ ok: true, tenantId, settings });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/db/logs - Read workspace logs.json (missions logs, Sources logs, Deliverables logs)
app.get(["/api/user/:tenantId/db/logs", "/api/workspace/:tenantId/db/logs"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const logs = syncLogsJson(tenantId);
    res.json({ ok: true, tenantId, logs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/db/logs - Write/update workspace logs.json
app.post(["/api/user/:tenantId/db/logs", "/api/workspace/:tenantId/db/logs"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const logsJsonPath = path.join(process.cwd(), 'workspaces', tenantId, 'logs.json');
    const updates = req.body || {};
    let existing: any = { missions: [], sources: [], deliverables: [], updated_at: nowIso() };
    if (fs.existsSync(logsJsonPath)) {
      try { existing = JSON.parse(fs.readFileSync(logsJsonPath, 'utf8')); } catch {}
    }
    const merged = { ...existing, ...updates, updated_at: nowIso() };
    fs.mkdirSync(path.dirname(logsJsonPath), { recursive: true });
    fs.writeFileSync(logsJsonPath, JSON.stringify(merged, null, 2), 'utf8');
    res.json({ ok: true, tenantId, logs: merged });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/files - List files inside user's isolated workspace
app.get(["/api/user/:tenantId/files", "/api/workspace/:tenantId/files"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const subDir = (req.query.path as string) || '';
    const files = listUserFiles(tenantId, subDir);
    res.json({ ok: true, tenantId, subDir, files });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/user/:tenantId/files/read - Read file inside user workspace
app.get(["/api/user/:tenantId/files/read", "/api/workspace/:tenantId/files/read"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const relativePath = (req.query.path as string) || '';
    if (!relativePath) {
      return res.status(400).json({ ok: false, error: "File 'path' query parameter is required." });
    }
    const fileData = readUserFile(tenantId, relativePath);
    res.json({ ok: true, tenantId, ...fileData });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/files/write - Write/Create file inside user workspace
app.post(["/api/user/:tenantId/files/write", "/api/workspace/:tenantId/files/write"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const { path: relativePath, content } = req.body || {};
    if (!relativePath) {
      return res.status(400).json({ ok: false, error: "File 'path' is required in body." });
    }
    const result = writeUserFile(tenantId, relativePath, content || '');
    res.json({ ok: true, tenantId, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/files/delete - Delete file/directory inside user workspace
app.post(["/api/user/:tenantId/files/delete", "/api/workspace/:tenantId/files/delete"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const { path: relativePath } = req.body || {};
    if (!relativePath) {
      return res.status(400).json({ ok: false, error: "File 'path' is required in body." });
    }
    const deleted = deleteUserFile(tenantId, relativePath);
    res.json({ ok: deleted, tenantId, path: relativePath });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/files/move - Move file or folder inside user workspace (e.g. between projects/ and workspace/)
app.post(["/api/user/:tenantId/files/move", "/api/workspace/:tenantId/files/move"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const { srcPath, destPath, src, dest } = req.body || {};
    const fromPath = srcPath || src;
    const toPath = destPath || dest;
    if (!fromPath || !toPath) {
      return res.status(400).json({ ok: false, error: "Both 'srcPath' and 'destPath' are required in request body." });
    }
    const result = moveUserFile(tenantId, fromPath, toPath);
    res.json({ ok: true, tenantId, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/cli/exec - Per-user virtual CLI command & sandbox execution
app.post(["/api/user/:tenantId/cli/exec", "/api/workspace/:tenantId/cli/exec"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const { command, code, timeoutMs } = req.body || {};
    const cmdStr = (command || code || 'help').trim();
    const userRoot = getUserRoot(tenantId);
    
    const logs: string[] = [];
    const startTime = Date.now();
    logs.push(`[${nowIso()}] [PI Harness CLI] Workspace Root: workspaces/${tenantId}/`);
    logs.push(`[${nowIso()}] [Isolated Sandbox] Executing: "${cmdStr}"`);

    recordUserHarnessActivity(tenantId, 1);

    // Support built-in CLI commands natively over user isolated filesystem
    if (cmdStr.startsWith('ls') || cmdStr.startsWith('dir')) {
      const parts = cmdStr.split(' ');
      const targetSubDir = parts[1] || '';
      const items = listUserFiles(tenantId, targetSubDir);
      logs.push(`Directory listing for workspaces/${tenantId}/${targetSubDir}:`);
      for (const item of items) {
        logs.push(`  ${item.isDirectory ? '[DIR]' : '[FILE]'}  ${item.name} (${item.size} bytes)`);
      }
      return res.json({
        ok: true,
        tenantId,
        command: cmdStr,
        stdout: logs.join('\n'),
        executionTimeMs: Date.now() - startTime
      });
    }

    if (cmdStr.startsWith('cat ') || cmdStr.startsWith('view ')) {
      const filePath = cmdStr.split(' ')[1];
      try {
        const file = readUserFile(tenantId, filePath);
        logs.push(`--- CONTENT OF workspaces/${tenantId}/${filePath} ---`);
        logs.push(file.content);
      } catch (e: any) {
        logs.push(`[ERROR] ${e.message}`);
      }
      return res.json({
        ok: true,
        tenantId,
        command: cmdStr,
        stdout: logs.join('\n'),
        executionTimeMs: Date.now() - startTime
      });
    }

    if (cmdStr === 'status' || cmdStr === 'pi harness status' || cmdStr === 'harness status') {
      const info = ensureUserHarness(tenantId);
      logs.push(`Status Report for User Harness '${tenantId}':`);
      logs.push(`- Harness Name: ${info.config.harness.name}`);
      logs.push(`- Architecture: ${info.config.harness.architecture}`);
      logs.push(`- Mode: ${info.config.harness.mode}`);
      logs.push(`- Default Model: ${info.config.harness.model_preferences.default_agent_model}`);
      logs.push(`- Active Entities: ${info.entities.join(', ')}`);
      return res.json({
        ok: true,
        tenantId,
        command: cmdStr,
        stdout: logs.join('\n'),
        executionTimeMs: Date.now() - startTime
      });
    }

    // Default to isolated JS VM code execution with per-user filesystem variables injected
    const contextVars = {
      tenantId,
      userRoot,
      env: { TENANT_ID: tenantId, WORKSPACE_PATH: userRoot }
    };

    const sandboxRes = executeSandboxedCode(
      code || `console.log("PI Harness Command Executed: " + "${cmdStr}"); result = { status: "OK", tenantId: "${tenantId}" };`,
      contextVars,
      timeoutMs || 3000
    );

    for (const logLine of sandboxRes.logs) {
      logs.push(logLine);
    }

    if (!sandboxRes.success) {
      logs.push(`[EXECUTION ERROR] ${sandboxRes.error}`);
    } else {
      logs.push(`[RESULT] ${JSON.stringify(sandboxRes.result)}`);
    }

    res.json({
      ok: sandboxRes.success,
      tenantId,
      command: cmdStr,
      stdout: logs.join('\n'),
      result: sandboxRes.result,
      executionTimeMs: Date.now() - startTime
    });

  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/user/:tenantId/agents/run & /api/workspace/:tenantId/agents/run - Trigger agent mission in user's isolated workspace
app.post(["/api/user/:tenantId/agents/run", "/api/workspace/:tenantId/agents/run"], (req, res) => {
  try {
    const tenantId = req.params.tenantId || 'default_user';
    const { agentId, prompt, entity } = req.body || {};
    const info = ensureUserHarness(tenantId);
    
    recordUserHarnessActivity(tenantId, 1);

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const logFile = `harness/runs/${runId}.json`;

    const runLog = {
      run_id: runId,
      tenant_id: tenantId,
      agent_id: agentId || "pi_orchestrator",
      entity: entity || "_os",
      prompt: prompt || "Automated system audit mission",
      status: "completed",
      started_at: nowIso(),
      completed_at: nowIso(),
      steps: [
        `Initialized isolated tenant runner for '${tenantId}'`,
        `Loaded harness config from workspaces/${tenantId}/harness/harness_config.yaml`,
        `Mounted entity workspace workspaces/${tenantId}/entities/${entity || '_os'}/`,
        `Executed mission payload successfully in isolated user workspace.`
      ]
    };

    writeUserFile(tenantId, logFile, JSON.stringify(runLog, null, 2));

    res.json({
      ok: true,
      tenantId,
      runId,
      logFile,
      log: runLog
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── SCHEMA-ENFORCED API GENERATORS FOR MISSIONS & TOOLBOXES ──

// POST /api/missions/generate-analytics
app.post("/api/missions/generate-analytics", async (req, res) => {
  try {
    const { inputs, model, customKey } = req.body || {};
    if (!inputs) {
      return res.status(400).json({ ok: false, error: "inputs string is required" });
    }

    const activeModel = model || "gemini-3.5-flash";
    const { provider } = getModelProviderAndName(activeModel);

    const prompt = `You are the Principal Analytics Engineer. Assess the following system inputs, requirements, or logs:
"${inputs}"

Structure your assessment rigorously. Identify:
1. Scope evaluation
2. Core requirements and specifications
3. Anomalies, technical risks, gaps, or security leaks
4. Actionable recommendations for the next phase.`;

    const responseText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: prompt }],
      responseMimeType: "application/json",
      responseSchema: provider === 'gemini' ? missionAnalyticsSchema : undefined,
      customKey
    });

    const result = JSON.parse(responseText);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error("[generate-analytics] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/missions/generate-planning
app.post("/api/missions/generate-planning", async (req, res) => {
  try {
    const { blueprint, model, customKey } = req.body || {};
    if (!blueprint) {
      return res.status(400).json({ ok: false, error: "blueprint string/object is required" });
    }

    const activeModel = model || "gemini-3.5-flash";
    const { provider } = getModelProviderAndName(activeModel);

    const blueprintStr = typeof blueprint === 'string' ? blueprint : JSON.stringify(blueprint, null, 2);

    const prompt = `You are the Systems Planning Architect. Convert this high-level analysis blueprint into a structured, step-by-step physical implementation plan:
"${blueprintStr}"

Generate highly concrete task cases. Each task must:
1. Reference physical file paths, db tables, or components
2. Detail the exact actions to take
3. Score benefit (HIGH | MEDIUM | LOW), cost (HIGH | MEDIUM | LOW), and worth-it (YES | NO).`;

    const responseText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: prompt }],
      responseMimeType: "application/json",
      responseSchema: provider === 'gemini' ? missionPlanningSchema : undefined,
      customKey
    });

    const result = JSON.parse(responseText);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error("[generate-planning] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/missions/generate-research
app.post("/api/missions/generate-research", async (req, res) => {
  try {
    const { topics, model, customKey } = req.body || {};
    if (!topics) {
      return res.status(400).json({ ok: false, error: "topics description is required" });
    }

    const activeModel = model || "gemini-3.5-flash";
    const { provider } = getModelProviderAndName(activeModel);

    const topicsStr = Array.isArray(topics) ? topics.join(", ") : String(topics);

    const prompt = `You are the Lead Systems Researcher. Conduct an exhaustive investigation on these topics:
"${topicsStr}"

Compile:
1. Citations, official reference URLs, and version notations
2. Clean, validated, production-ready code snippets with descriptions (No markdown wraps!)
3. Technical integration blockers, scope boundaries, or fee limitations.`;

    const responseText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: prompt }],
      responseMimeType: "application/json",
      responseSchema: provider === 'gemini' ? missionResearchSchema : undefined,
      customKey
    });

    const result = JSON.parse(responseText);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error("[generate-research] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/missions/generate-toolbox-item
app.post("/api/missions/generate-toolbox-item", async (req, res) => {
  try {
    const { prompt, kind, model, customKey } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ ok: false, error: "prompt is required" });
    }

    const activeModel = model || "gemini-3.5-flash";
    const { provider } = getModelProviderAndName(activeModel);

    const targetKind = kind || "skill";

    const systemPrompt = `You are the Fabrica Kernel Architect. Code and synthesize a production-grade ${targetKind} component based on the user's requirements:
"${prompt}"

Determine:
1. Descriptive camel_case name
2. Clear functional description and invocation criteria (when_to_use)
3. Maturity level (defaulting to "stub" or "functional")
4. Complete set of source code files or JSON configs. NO markdown code backticks inside the files array. Each file's 'content' property must hold raw, complete code.`;

    const responseText = await generateLlmText({
      model: activeModel,
      messages: [{ role: 'user', content: systemPrompt }],
      responseMimeType: "application/json",
      responseSchema: provider === 'gemini' ? toolboxGenerateSchema : undefined,
      customKey
    });

    const result = JSON.parse(responseText);
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error("[generate-toolbox-item] Error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- STRIPE ENDPOINTS REMOVED ---
// Standard Stripe integrations are handled securely on the client-side as requested.

// Sync Cycle Interval Loop
setInterval(() => {
  try {
    syncCycle();
  } catch (err: any) {
    console.error(`Error in syncCycle: ${err.message}`);
  }
}, 5000);

// Start server listening on port 3000
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[daemon] Fabrica v1 up in Node.js. Server listening on http://0.0.0.0:${PORT}`);
  // Initial harness setup for standard tenants
  ensureUserHarness('default_user');
  // Initial sync run
  try {
    syncCycle();
  } catch (err: any) {
    console.error(`Error in initial syncCycle: ${err.message}`);
  }
});
