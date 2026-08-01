import { execFile, execFileSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { keyPoolManager } from './auth.js';
import { getUserTier, deductLlmCredits } from './auth.js';
import { getTenantRoot, appendTenantAuditLog } from './tenant.js';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

export interface HarnessConfig {
  harness: {
    version: string;
    name: string;
    architecture: string;
    mode: string;
    model_preferences: {
      default_agent_model: string;
      research_model: string;
      sandbox_timeout_ms: number;
    };
    memory: {
      context_window_tokens: number;
      persistence_mode: string;
    };
    tools_sandbox: {
      isolation: string;
      allow_network: boolean;
    };
  };
}

export interface UserHarnessInfo {
  tenantId: string;
  harnessDir: string;
  entitiesDir: string;
  config: HarnessConfig;
  entities: string[];
}

export interface PiExecutionOptions {
  cwd: string;
  piCodingAgentDir: string;
  env: Record<string, string>;
  cliFlags: string[];
}

export interface PiDaemonProcessInfo {
  id: string; // tenantId:sessionId
  tenantId: string;
  sessionId: string;
  model: string;
  pid?: number;
  status: 'running' | 'idle' | 'busy' | 'stopped';
  createdAt: string;
  lastActiveAt: string;
  apiKeyStrategy: string;
}

export interface PiAgentRunOptions {
  prompt: string;
  tenantId?: string;
  sessionId?: string;
  model?: string;
  customKey?: string;
  agentLang?: string;
  webSearchEnabled?: boolean;
  disableWorkspaceSkills?: boolean;
  disableWorkspaceExtensions?: boolean;
}

export interface PiAgentResponse {
  ok: boolean;
  text: string;
  suggestions: string[];
  sessionId: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface PiSessionItem {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tokensUsed: number;
  history: { sender: 'user' | 'agent'; text: string; timestamp?: string }[];
}

export interface PiModelItem {
  provider: string;
  model: string;
  fullModel: string;
  context: string;
  maxOutput: string;
  thinking: boolean;
  images: boolean;
}

export interface PiProcessLogItem {
  id: string;
  timestamp: string;
  tenantId: string;
  sessionId: string;
  model: string;
  prompt: string;
  command: string;
  args: string[];
  executionTimeMs: number;
  stdout: string;
  stderr: string;
  ok: boolean;
  error?: string;
  apiKeyStrategy: string;
}

// ── Single Daemon Process & Active Trackers ────────────────────────────────────

export class PiDaemonProcess {
  public id: string;
  public tenantId: string;
  public sessionId: string;
  public model: string;
  public child: ChildProcess | null = null;
  public pid?: number;
  public status: 'running' | 'idle' | 'busy' | 'stopped' = 'stopped';
  public createdAt: string;
  public lastActiveAt: string;
  public apiKeyStrategy: string;

  constructor(tenantId: string, sessionId: string, model: string, apiKeyStrategy: string = 'System Fallback') {
    this.id = tenantId; // Strict 1:1 binding per tenantId
    this.tenantId = tenantId;
    this.sessionId = sessionId;
    this.model = model;
    this.apiKeyStrategy = apiKeyStrategy;
    this.createdAt = new Date().toISOString();
    this.lastActiveAt = new Date().toISOString();
  }

  public getInfo(): PiDaemonProcessInfo {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      model: this.model,
      pid: this.pid,
      status: this.status,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      apiKeyStrategy: this.apiKeyStrategy
    };
  }

  public kill(): boolean {
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
        this.child.kill('SIGKILL');
      } catch (_) {}
    }
    this.status = 'stopped';
    activePiDaemons.delete(this.tenantId);
    activePiChildProcesses.delete(this.tenantId);
    return true;
  }
}

export const activePiDaemons = new Map<string, PiDaemonProcess>();
const activePiChildProcesses = new Map<string, ChildProcess>();
export const piProcessLogs: PiProcessLogItem[] = [];

export function stopPiAgent(tenantId: string, sessionId?: string): boolean {
  let killed = false;
  const existingDaemon = activePiDaemons.get(tenantId);
  if (existingDaemon) {
    existingDaemon.kill();
    killed = true;
  }
  for (const [key, child] of activePiChildProcesses.entries()) {
    if (key === tenantId || key.startsWith(`${tenantId}:`)) {
      try {
        child.kill('SIGTERM');
        child.kill('SIGKILL');
        killed = true;
      } catch (err) {
        console.warn(`[harness] Failed to kill child process ${key}:`, err);
      }
      activePiChildProcesses.delete(key);
    }
  }
  return killed;
}

export function listPiDaemons(tenantId?: string): PiDaemonProcessInfo[] {
  const daemons: PiDaemonProcessInfo[] = [];
  for (const daemon of activePiDaemons.values()) {
    if (!tenantId || tenantId === 'all' || daemon.tenantId === tenantId) {
      daemons.push(daemon.getInfo());
    }
  }
  return daemons;
}

export function getPiProcessLogs(tenantId?: string): PiProcessLogItem[] {
  if (!tenantId || tenantId === 'all') return piProcessLogs;
  return piProcessLogs.filter(l => l.tenantId === tenantId || l.tenantId === 'default_user');
}

export function recordPiProcessLog(item: PiProcessLogItem) {
  piProcessLogs.unshift(item);
  if (piProcessLogs.length > 100) {
    piProcessLogs.pop();
  }
}

// ── Workspace Initialization & Execution Options ───────────────────────────────

export function ensureUserHarness(tenantId: string = 'default_user'): UserHarnessInfo {
  const userRoot = getTenantRoot(tenantId);
  const piDir = path.join(userRoot, '.pi');
  const piAgentDir = path.join(piDir, 'agent');
  const piSkillsDir = path.join(piDir, 'skills');
  const piExtensionsDir = path.join(piDir, 'extensions');

  fs.mkdirSync(piAgentDir, { recursive: true });
  fs.mkdirSync(piSkillsDir, { recursive: true });
  fs.mkdirSync(piExtensionsDir, { recursive: true });

  const tenantJsonPath = path.join(userRoot, 'tenant.json');
  if (!fs.existsSync(tenantJsonPath)) {
    fs.writeFileSync(tenantJsonPath, JSON.stringify({
      tenant_id: tenantId,
      name: tenantId === 'default_user' ? 'Default Workspace' : `Tenant (${tenantId})`,
      plan: "Professional",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: { language: "EN", internet_access: true },
      subscription: { plan: "Professional", active: true },
      telemetry: { total_runs: 0, last_active: new Date().toISOString() },
      logs: [
        {
          id: `evt-init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "system",
          event: "Workspace Initialized",
          details: "Unified audit event stream initialized in tenant.json."
        }
      ]
    }, null, 2), 'utf8');
  }

  const harnessJsonPath = path.join(userRoot, 'harness.json');
  if (!fs.existsSync(harnessJsonPath)) {
    fs.writeFileSync(harnessJsonPath, JSON.stringify({
      tenant_id: tenantId,
      status: "idle",
      selected_model: "gemini-3.6-flash",
      autonomy: "autonomous",
      agent_lang: "EN",
      web_search_enabled: true,
      suggestions: [],
      backlogs: [],
      review_queues: [],
      last_active: new Date().toISOString()
    }, null, 2), 'utf8');
  }

  const singleMissionsPath = path.join(userRoot, 'missions.json');
  if (!fs.existsSync(singleMissionsPath)) {
    fs.writeFileSync(singleMissionsPath, JSON.stringify({ missions: [] }, null, 2), 'utf8');
  }

  const workspaceJsonPath = path.join(userRoot, 'workspace.json');
  if (!fs.existsSync(workspaceJsonPath)) {
    fs.writeFileSync(workspaceJsonPath, JSON.stringify({
      sources: {},
      deliverables: {},
      last_synced_at: new Date().toISOString()
    }, null, 2), 'utf8');
  }

  const agentsMdPath = path.join(userRoot, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, '', 'utf8');
  }

  const workspaceDir = path.join(userRoot, 'workspace');
  const sourcesDir = path.join(workspaceDir, 'Sources');
  const deliverablesDir = path.join(workspaceDir, 'Deliverables');

  const sourceDirs = [
    'Discovery & Scoping',
    'Deep Research & Intelligence Gathering',
    'Data Analysis & Pattern Extraction',
    'Strategic Synthesis & Decision Support'
  ];
  const deliverableDirs = ['Executions', 'Reviews', 'Completed'];

  for (const sd of sourceDirs) {
    fs.mkdirSync(path.join(sourcesDir, sd), { recursive: true });
  }
  for (const dd of deliverableDirs) {
    fs.mkdirSync(path.join(deliverablesDir, dd), { recursive: true });
  }

  const missionsDir = path.join(userRoot, 'missions');
  fs.mkdirSync(missionsDir, { recursive: true });

  const config: HarnessConfig = {
    harness: {
      version: "3.0.0",
      name: `Fabrica Harness [Tenant: ${tenantId}]`,
      architecture: "modular_core_harness",
      mode: "per_user_isolated",
      model_preferences: {
        default_agent_model: "gemini-3.6-flash",
        research_model: "gemini-3.6-flash",
        sandbox_timeout_ms: 10000
      },
      memory: {
        context_window_tokens: 1000000,
        persistence_mode: "hybrid_fs_json"
      },
      tools_sandbox: {
        isolation: "isolated_v8_vm",
        allow_network: true
      }
    }
  };

  return {
    tenantId,
    harnessDir: '',
    entitiesDir: '',
    config,
    entities: []
  };
}

export function loadKernelSystemPrompts(tenantId: string = 'default_user'): string {
  const kernelPromptsDir = path.join(process.cwd(), 'Fabrica_kernel', 'system_prompts');
  let combinedPrompts = '';

  if (fs.existsSync(kernelPromptsDir)) {
    const files = fs.readdirSync(kernelPromptsDir).filter(f => f.endsWith('.md')).sort();
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(kernelPromptsDir, f), 'utf8');
        if (content.trim()) {
          combinedPrompts += `\n\n[SYSTEM DIRECTIVE (${f})]:\n${content.trim()}`;
        }
      } catch (_) {}
    }
  }

  const userRoot = getTenantRoot(tenantId);
  const agentsMdPath = path.join(userRoot, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    try {
      const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8');
      if (agentsMdContent.trim()) {
        combinedPrompts += `\n\n[USER AGENTS.MD DIRECTIVES]:\n${agentsMdContent.trim()}`;
      }
    } catch (_) {}
  }

  return combinedPrompts;
}

export function getPiExecutionOptions(
  tenantId: string = 'default_user',
  disableWorkspaceSkills: boolean = false,
  disableWorkspaceExtensions: boolean = false
): PiExecutionOptions {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const piDir = path.join(userRoot, '.pi');
  fs.mkdirSync(path.join(piDir, 'agent', 'sessions'), { recursive: true });

  const cliFlags: string[] = [];

  const kernelSkillsDir = path.join(process.cwd(), 'Fabrica_kernel', 'skills');
  if (fs.existsSync(kernelSkillsDir) && fs.readdirSync(kernelSkillsDir).length > 0) {
    cliFlags.push('--skill', kernelSkillsDir);
  }

  if (!disableWorkspaceSkills) {
    const userSkillsDir = path.join(userRoot, '.pi', 'skills');
    if (fs.existsSync(userSkillsDir) && fs.readdirSync(userSkillsDir).length > 0) {
      cliFlags.push('--skill', userSkillsDir);
    }
  }

  if (!disableWorkspaceExtensions) {
    const userExtDir = path.join(userRoot, '.pi', 'extensions');
    if (fs.existsSync(userExtDir)) {
      const extFiles = fs.readdirSync(userExtDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
      for (const extFile of extFiles) {
        cliFlags.push('--extension', path.join(userExtDir, extFile));
      }
    }
  }

  const systemPrompts = loadKernelSystemPrompts(tenantId);
  if (systemPrompts.trim()) {
    cliFlags.push('--append-system-prompt', systemPrompts.trim());
  }

  return {
    cwd: userRoot,
    piCodingAgentDir: piDir,
    env: {
      ...process.env,
      PI_CODING_AGENT_DIR: piDir
    },
    cliFlags
  };
}

// ── Agent Runner & Session Management ─────────────────────────────────────────

export async function runPiAgent(options: PiAgentRunOptions): Promise<PiAgentResponse> {
  const tenantId = options.tenantId || 'default_user';
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const execOpts = getPiExecutionOptions(tenantId, options.disableWorkspaceSkills, options.disableWorkspaceExtensions);

  const sessionId = options.sessionId || `session_${Date.now()}`;
  const rawModel = options.model || 'gemini-3.6-flash';

  let fullModel = rawModel;
  if (!rawModel.includes('/')) {
    if (rawModel.startsWith('gemini') || rawModel.startsWith('gemma') || rawModel.startsWith('deep-research')) {
      fullModel = `google/${rawModel}`;
    } else if (rawModel.startsWith('claude')) {
      fullModel = `anthropic/${rawModel}`;
    } else if (rawModel.startsWith('gpt') || rawModel.startsWith('o1') || rawModel.startsWith('o3')) {
      fullModel = `openai/${rawModel}`;
    } else {
      fullModel = `openrouter/${rawModel}`;
    }
  }

  const provider = fullModel.split('/')[0];

  const piBin = fs.existsSync(path.resolve(process.cwd(), 'node_modules/.bin/pi'))
    ? path.resolve(process.cwd(), 'node_modules/.bin/pi')
    : 'pi';

  const executeAttempt = async (apiKey?: string): Promise<{ stdout: string; stderr: string }> => {
    const apiKeyStrategy = options.customKey ? 'BYOK' : (apiKey ? 'Key Pool Rotation' : 'System Fallback');
    const effectiveKey = apiKey || (options.customKey ? options.customKey : undefined) || (provider === 'google' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY) || process.env.GEMINI_API_KEY;

    // Environmental isolation: Do not blindly inherit sensitive master server environment variables
    const env: Record<string, string> = {
      PATH: `${path.resolve(process.cwd(), 'node_modules/.bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
      HOME: process.env.HOME || '/tmp',
      TMPDIR: process.env.TMPDIR || '/tmp',
      NODE_ENV: process.env.NODE_ENV || 'production',
      PI_CODING_AGENT_DIR: execOpts.piCodingAgentDir
    };

    if (effectiveKey) {
      if (provider === 'google') env.GEMINI_API_KEY = effectiveKey;
      else if (provider === 'openrouter') env.OPENROUTER_API_KEY = effectiveKey;
      else if (provider === 'anthropic') env.ANTHROPIC_API_KEY = effectiveKey;
      else if (provider === 'openai') env.OPENAI_API_KEY = effectiveKey;
      else env.GEMINI_API_KEY = effectiveKey;
    }

    let promptWithLang = options.prompt;
    if (options.agentLang === 'FR') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in French (Français).]';
    } else if (options.agentLang === 'AR') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in Arabic (العربية).]';
    } else if (options.agentLang === 'EN') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in English.]';
    }

    const args: string[] = [
      '-p',
      '--mode', 'json',
      '--session-id', sessionId,
      '--model', fullModel,
      ...execOpts.cliFlags,
      promptWithLang
    ];

    const startTime = Date.now();
    const procKey = tenantId; // Enforce strict 1:1 daemon binding per tenantId

    let daemon = activePiDaemons.get(procKey);
    if (daemon && daemon.status !== 'stopped') {
      // Kill previous daemon instance for this tenant if session/model changed to prevent concurrent daemons
      if (daemon.sessionId !== sessionId || daemon.model !== fullModel) {
        daemon.kill();
        daemon = undefined;
      }
    }

    if (!daemon || daemon.status === 'stopped') {
      daemon = new PiDaemonProcess(tenantId, sessionId, fullModel, apiKeyStrategy);
      activePiDaemons.set(procKey, daemon);
    }
    daemon.sessionId = sessionId;
    daemon.model = fullModel;
    daemon.status = 'busy';
    daemon.lastActiveAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const child = execFile(piBin, args, {
        cwd: userRoot,
        env,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 120000
      }, (err, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        if (daemon) {
          daemon.status = 'idle';
          daemon.pid = child.pid;
        }

        recordPiProcessLog({
          id: `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toISOString(),
          tenantId,
          sessionId,
          model: fullModel,
          prompt: options.prompt,
          command: 'pi',
          args,
          executionTimeMs,
          stdout: stdout || '',
          stderr: stderr || '',
          ok: !err || Boolean(stdout),
          error: err ? err.message : undefined,
          apiKeyStrategy
        });

        if (err && !stdout) {
          if (daemon) daemon.status = 'stopped';
          return reject(err);
        }
        resolve({ stdout, stderr });
      });

      if (daemon) daemon.child = child;
      activePiChildProcesses.set(procKey, child);

      if (child.stdin) {
        child.stdin.end();
      }
    });
  };

  // 1. Direct BYOK execution
  if (options.customKey) {
    try {
      const { stdout } = await executeAttempt(options.customKey);
      const resParsed = parsePiJsonOutput(stdout, sessionId, fullModel);
      const inTokens = resParsed.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = resParsed.usage?.outputTokens || Math.max(20, Math.round((resParsed.text || '').length / 4));
      try { deductLlmCredits(tenantId, fullModel, inTokens, outTokens); } catch (_) {}
      return resParsed;
    } catch (err: any) {
      return {
        ok: false,
        text: `Error executing pi agent: ${err.message}`,
        suggestions: ["Check API Key", "Retry request"],
        sessionId,
        model: fullModel,
        error: err.message
      };
    }
  }

  // 2. Card verification check for Free tier users
  const userTier = getUserTier(tenantId);
  const isFreeTier = userTier.plan === 'free';
  const isCardVerified = Boolean(userTier.hasVerifiedCard || userTier.cardVerified || userTier.paymentVerified || process.env.GEMINI_API_KEY || tenantId === 'default_user');

  if (isFreeTier && !isCardVerified) {
    return {
      ok: false,
      text: "💳 **Card Verification Required**: To access the complimentary LLM key pool on the Free tier, please verify your payment card in Account Settings or provide a custom API key (BYOK).",
      suggestions: ["Verify Payment Card", "Provide Custom API Key"],
      sessionId,
      model: fullModel,
      error: "CARD_VERIFICATION_REQUIRED"
    };
  }

  // 3. Pool key rotation execution
  const excludedKeyIds = new Set<string>();
  const targetProvider = (provider === 'google' || provider === 'gemini') ? 'gemini' : 'openrouter';

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const keyItem = keyPoolManager.acquireKey(targetProvider, tenantId, excludedKeyIds);
    const apiKey = keyItem ? keyItem.key : (targetProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY);

    if (!apiKey && !keyItem) break;

    try {
      const { stdout } = await executeAttempt(apiKey);
      const result = parsePiJsonOutput(stdout, sessionId, fullModel);

      if (result.error && (result.error.includes('429') || result.error.includes('quota') || result.error.includes('RESOURCE_EXHAUSTED'))) {
        if (keyItem) {
          keyPoolManager.markRateLimited(keyItem.id, 60);
          excludedKeyIds.add(keyItem.id);
        }
        if (!keyItem) break;
        continue;
      }

      if (keyItem) keyPoolManager.releaseKey(keyItem.id);

      const inTokens = result.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = result.usage?.outputTokens || Math.max(20, Math.round((result.text || '').length / 4));
      try { deductLlmCredits(tenantId, fullModel, inTokens, outTokens); } catch (_) {}

      return result;
    } catch (err: any) {
      const msg = (err.message || '').toLowerCase();
      const isRateLimit = msg.includes('429') || msg.includes('503') || msg.includes('quota') || msg.includes('resource_exhausted');
      if (isRateLimit && keyItem) {
        keyPoolManager.markRateLimited(keyItem.id, 60);
        excludedKeyIds.add(keyItem.id);
      } else if (keyItem) {
        keyPoolManager.releaseKey(keyItem.id);
      }
      if (!keyItem) break;
    }
  }

  return {
    ok: false,
    text: "Rate limit temporarily reached due to high platform traffic. Shared complimentary tokens are currently busy. Please wait 30 seconds or configure your custom API key (BYOK).",
    suggestions: ["Retry request", "Configure custom API key"],
    sessionId,
    model: fullModel,
    error: "RATE_LIMIT_EXHAUSTED"
  };
}

function parsePiJsonOutput(stdout: string, sessionId: string, model: string): PiAgentResponse {
  let finalText = '';
  let suggestions: string[] = [];
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let errorMessage: string | undefined = undefined;

  const lines = stdout.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === 'turn_end' && event.message) {
        const msg = event.message;
        if (typeof msg.content === 'string') {
          finalText = msg.content;
        } else if (Array.isArray(msg.content)) {
          finalText = msg.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
        }

        if (msg.usage) {
          usage.inputTokens += msg.usage.input || 0;
          usage.outputTokens += msg.usage.output || 0;
          usage.totalTokens += msg.usage.totalTokens || (usage.inputTokens + usage.outputTokens);
        }
        if (msg.errorMessage) errorMessage = msg.errorMessage;
      }

      if (event.type === 'agent_end') {
        const msgs = event.messages || [];
        const lastAssistant = msgs.filter((m: any) => m.role === 'assistant').pop();
        if (lastAssistant) {
          if (typeof lastAssistant.content === 'string') {
            finalText = lastAssistant.content;
          } else if (Array.isArray(lastAssistant.content)) {
            finalText = lastAssistant.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
          }
          if (lastAssistant.errorMessage) errorMessage = lastAssistant.errorMessage;
        }
      }
    } catch (_) {}
  }

  if (finalText) {
    const suggestMatches = finalText.match(/\[SUGGEST:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi);
    if (suggestMatches) {
      suggestions = suggestMatches.map(m => m.replace(/^\[SUGGEST:\s*/i, '').replace(/\]$/, '').split('|')[0].trim());
    }
    if (finalText.trim().startsWith('{') && finalText.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(finalText);
        if (parsed.text) finalText = parsed.text;
        if (Array.isArray(parsed.suggestions)) suggestions = parsed.suggestions;
      } catch (_) {}
    }
  }

  if (!suggestions || suggestions.length === 0) {
    suggestions = ["Continue mission", "Review workspace state", "Show backlog priority"];
  }

  return {
    ok: !errorMessage,
    text: finalText || (errorMessage ? `Agent notice: ${errorMessage}` : "Task completed."),
    suggestions,
    sessionId,
    model,
    usage,
    error: errorMessage
  };
}

export function listPiSessions(tenantId: string = 'default_user'): PiSessionItem[] {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDirs = [
    path.join(userRoot, '.pi', 'agent', 'sessions'),
    path.join(userRoot, '.pi', 'sessions')
  ];

  const items: PiSessionItem[] = [];
  const processedIds = new Set<string>();

  for (const sessionDir of sessionDirs) {
    if (!fs.existsSync(sessionDir)) continue;

    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));

    for (const f of files) {
      const fullPath = path.join(sessionDir, f);
      const id = f.replace(/\.jsonl?$/, '');
      if (processedIds.has(id)) continue;
      processedIds.add(id);

      try {
        const stats = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').filter(Boolean);

        let messageCount = 0;
        let tokensUsed = 0;
        const history: { sender: 'user' | 'agent'; text: string; timestamp?: string }[] = [];

        for (const l of lines) {
          try {
            const entry = JSON.parse(l);
            if (entry.type === 'turn_end' || entry.type === 'message_end' || entry.role) {
              const role = entry.role || entry.message?.role;
              let text = '';
              const rawContent = entry.content || entry.message?.content;
              if (typeof rawContent === 'string') text = rawContent;
              else if (Array.isArray(rawContent)) text = rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');

              if (text && (role === 'user' || role === 'assistant' || role === 'agent')) {
                messageCount++;
                history.push({
                  sender: role === 'user' ? 'user' : 'agent',
                  text,
                  timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : stats.mtime.toISOString()
                });
              }
              if (entry.message?.usage?.totalTokens) tokensUsed += entry.message.usage.totalTokens;
            }
          } catch (_) {}
        }

        const name = `Session ${items.length + 1} (${id.slice(0, 8)})`;

        items.push({
          id,
          name,
          path: path.relative(userRoot, fullPath),
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          messageCount,
          tokensUsed,
          history
        });
      } catch (_) {}
    }
  }

  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items;
}

export function createPiSession(tenantId: string = 'default_user', name?: string): PiSessionItem {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDir = path.join(userRoot, '.pi', 'agent', 'sessions');
  fs.mkdirSync(sessionDir, { recursive: true });

  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const filePath = path.join(sessionDir, `${id}.jsonl`);

  const initialHeader = {
    type: "session_start",
    sessionId: id,
    tenantId,
    timestamp: Date.now()
  };

  fs.writeFileSync(filePath, JSON.stringify(initialHeader) + '\n', 'utf8');

  return {
    id,
    name: name || `Session (${id.slice(-6)})`,
    path: path.relative(userRoot, filePath),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    tokensUsed: 0,
    history: []
  };
}

export function deletePiSession(tenantId: string = 'default_user', sessionId: string): boolean {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDirs = [
    path.join(userRoot, '.pi', 'agent', 'sessions'),
    path.join(userRoot, '.pi', 'sessions')
  ];

  let deleted = false;
  for (const sessionDir of sessionDirs) {
    if (!fs.existsSync(sessionDir)) continue;
    const filePath = path.join(sessionDir, `${sessionId}.jsonl`);
    const altPath = path.join(sessionDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); deleted = true; }
    if (fs.existsSync(altPath)) { fs.unlinkSync(altPath); deleted = true; }
  }
  return deleted;
}

export const DEFAULT_PI_CLI_FALLBACK_MODELS: PiModelItem[] = [
  { provider: 'google', model: 'gemini-3.6-flash', fullModel: 'google/gemini-3.6-flash', context: '1.0M', maxOutput: '65.5K', thinking: true, images: true },
  { provider: 'google', model: 'gemini-2.0-flash', fullModel: 'google/gemini-2.0-flash', context: '1.0M', maxOutput: '8.2K', thinking: false, images: true },
  { provider: 'google', model: 'gemma-4-31b-it', fullModel: 'google/gemma-4-31b-it', context: '262.1K', maxOutput: '32.8K', thinking: true, images: true },
  { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', fullModel: 'openrouter/anthropic/claude-3.5-sonnet', context: '200K', maxOutput: '8K', thinking: true, images: true },
  { provider: 'openrouter', model: 'deepseek/deepseek-r1', fullModel: 'openrouter/deepseek/deepseek-r1', context: '128K', maxOutput: '8K', thinking: true, images: false },
  { provider: 'openrouter', model: 'openai/gpt-4o', fullModel: 'openrouter/openai/gpt-4o', context: '128K', maxOutput: '4K', thinking: false, images: true },
  { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', fullModel: 'anthropic/claude-3-5-sonnet-latest', context: '200K', maxOutput: '8K', thinking: true, images: true },
  { provider: 'openai', model: 'gpt-4o', fullModel: 'openai/gpt-4o', context: '128K', maxOutput: '4K', thinking: false, images: true }
];

export function listPiModels(): PiModelItem[] {
  try {
    let piBin = 'pi';
    if (fs.existsSync('/app/applet/node_modules/.bin/pi')) piBin = '/app/applet/node_modules/.bin/pi';
    else if (fs.existsSync('./node_modules/.bin/pi')) piBin = './node_modules/.bin/pi';

    const stdout = execFileSync(piBin, ['--list-models'], { encoding: 'utf8', timeout: 10000 });
    const items: PiModelItem[] = [];
    for (const line of stdout.split('\n')) {
      if (!line.trim() || line.startsWith('provider')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        items.push({
          provider: parts[0],
          model: parts[1],
          fullModel: `${parts[0]}/${parts[1]}`,
          context: parts[2] || '128K',
          maxOutput: parts[3] || '8K',
          thinking: parts[4] === 'yes',
          images: parts[5] === 'yes'
        });
      }
    }
    return items.length > 0 ? items : DEFAULT_PI_CLI_FALLBACK_MODELS;
  } catch (_) {
    return DEFAULT_PI_CLI_FALLBACK_MODELS;
  }
}

// ── User Activity Recording ────────────────────────────────────────────────────

export function recordUserHarnessActivity(tenantId: string, runIncrement: number = 0) {
  const harnessPath = path.join(getTenantRoot(tenantId), 'harness.json');
  try {
    let harnessData: any = { tenant_id: tenantId, status: "running", last_active: new Date().toISOString() };
    if (fs.existsSync(harnessPath)) {
      harnessData = JSON.parse(fs.readFileSync(harnessPath, 'utf8'));
    }
    harnessData.status = "running";
    harnessData.last_active = new Date().toISOString();
    fs.writeFileSync(harnessPath, JSON.stringify(harnessData, null, 2), 'utf8');
  } catch (_) {}

  const tenantPath = path.join(getTenantRoot(tenantId), 'tenant.json');
  try {
    let tenantData: any = {};
    if (fs.existsSync(tenantPath)) {
      tenantData = JSON.parse(fs.readFileSync(tenantPath, 'utf8'));
    }
    if (!tenantData.telemetry) tenantData.telemetry = {};
    tenantData.telemetry.total_runs = (tenantData.telemetry.total_runs || 0) + runIncrement;
    tenantData.telemetry.last_active = new Date().toISOString();
    fs.writeFileSync(tenantPath, JSON.stringify(tenantData, null, 2), 'utf8');
  } catch (_) {}
}
