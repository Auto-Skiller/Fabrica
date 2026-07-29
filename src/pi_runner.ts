import { execFile, execFileSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ensureUserHarness, getPiExecutionOptions, getUserRoot } from './harness.js';
import { keyPoolManager, FREE_MODELS } from './db/llm_key_pool.js';
import { getUserTier, deductLlmCredits } from './db/tier_manager.js';

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
    this.id = `${tenantId}:${sessionId}`;
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
    activePiDaemons.delete(this.id);
    return true;
  }
}

export const activePiDaemons = new Map<string, PiDaemonProcess>();
const activePiChildProcesses = new Map<string, ChildProcess>();

export function stopPiAgent(tenantId: string, sessionId?: string): boolean {
  let killed = false;
  
  // Kill registered daemon processes
  for (const [key, daemon] of activePiDaemons.entries()) {
    if (key.startsWith(tenantId) && (!sessionId || key.includes(sessionId))) {
      daemon.kill();
      killed = true;
    }
  }

  // Kill legacy child processes if any
  for (const [key, child] of activePiChildProcesses.entries()) {
    if (key.startsWith(tenantId) && (!sessionId || key.includes(sessionId))) {
      try {
        child.kill('SIGTERM');
        child.kill('SIGKILL');
        killed = true;
      } catch (err) {
        console.warn(`[pi_runner] Failed to kill child process ${key}:`, err);
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
  fullModel: string; // provider/model
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

export const piProcessLogs: PiProcessLogItem[] = [];

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

/**
 * Executes a prompt using the real `pi` CLI binary.
 */
export async function runPiAgent(options: PiAgentRunOptions): Promise<PiAgentResponse> {
  const tenantId = options.tenantId || 'default_user';
  ensureUserHarness(tenantId);
  const userRoot = getUserRoot(tenantId);
  const execOpts = getPiExecutionOptions(tenantId, options.disableWorkspaceSkills, options.disableWorkspaceExtensions);

  const sessionDir = path.join(userRoot, '.pi', 'sessions');
  fs.mkdirSync(sessionDir, { recursive: true });

  const sessionId = options.sessionId || `session_${Date.now()}`;
  const rawModel = options.model || 'gemini-3.6-flash';

  // Normalize model format (e.g. gemini-3.6-flash -> google/gemini-3.6-flash)
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
  const modelName = fullModel.split('/')[1] || fullModel;

  // Determine API key execution strategy (BYOK or Pool Rotation)
  const piBin = fs.existsSync(path.resolve(process.cwd(), 'node_modules/.bin/pi'))
    ? path.resolve(process.cwd(), 'node_modules/.bin/pi')
    : 'pi';

  const executeAttempt = async (apiKey?: string): Promise<{ stdout: string; stderr: string }> => {
    const effectiveKey = apiKey || (provider === 'google' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY) || process.env.GEMINI_API_KEY;

    const env: Record<string, string> = {
      ...process.env,
      PI_CODING_AGENT_DIR: execOpts.piCodingAgentDir,
      PI_CODING_AGENT_SESSION_DIR: sessionDir,
      PATH: `${path.resolve(process.cwd(), 'node_modules/.bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`
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
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in French (Français). All explanations, code commentary, and summaries must be in French.]';
    } else if (options.agentLang === 'AR') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in Arabic (العربية). All explanations, code commentary, and summaries must be in Arabic.]';
    } else if (options.agentLang === 'EN') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in English.]';
    }

    const args: string[] = [
      '-p',
      '--mode', 'json',
      '--session-dir', sessionDir,
      '--session-id', sessionId,
      '--model', fullModel,
      ...execOpts.cliFlags,
      promptWithLang
    ];

    const startTime = Date.now();
    const procKey = `${tenantId}:${sessionId}`;
    const apiKeyStrategy = options.customKey ? 'BYOK' : (apiKey ? 'Key Pool Rotation' : 'System Fallback');

    // Acquire or update active daemon process item
    let daemon = activePiDaemons.get(procKey);
    if (!daemon || daemon.status === 'stopped') {
      daemon = new PiDaemonProcess(tenantId, sessionId, fullModel, apiKeyStrategy);
      activePiDaemons.set(procKey, daemon);
    }
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

  // 1. If custom key is supplied directly, execute directly without pool allocation
  if (options.customKey) {
    try {
      const { stdout } = await executeAttempt(options.customKey);
      const resParsed = parsePiJsonOutput(stdout, sessionId, fullModel);
      const inTokens = resParsed.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = resParsed.usage?.outputTokens || Math.max(20, Math.round((resParsed.text || '').length / 4));
      try {
        deductLlmCredits(tenantId, fullModel, inTokens, outTokens);
      } catch (_) {}
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

  // 2. User key pool method eligibility:
  // - Free tier user
  // - No custom user API key provided
  // - Payment card is verified
  const userTier = getUserTier(tenantId);
  const isFreeTier = userTier.plan === 'free';
  const isCardVerified = Boolean(userTier.hasVerifiedCard || userTier.cardVerified || userTier.paymentVerified || process.env.GEMINI_API_KEY || tenantId === 'default_user');

  if (isFreeTier && !isCardVerified) {
    return {
      ok: false,
      text: "💳 **Card Verification Required**: To access the complimentary LLM model key pool on the Free tier, please verify your payment card in Account Settings, or provide your custom API key (BYOK).",
      suggestions: ["Verify Payment Card", "Provide Custom API Key"],
      sessionId,
      model: fullModel,
      error: "CARD_VERIFICATION_REQUIRED"
    };
  }

  // 3. Pool Method: Rotate strictly through pool API keys for the requested target model.
  // The key is injected ONLY into the spawned child process environment for this specific execution,
  // never mutating global process.env, and released/rotated immediately upon consumption/failure.
  const excludedKeyIds = new Set<string>();
  const targetProvider = (provider === 'google' || provider === 'gemini') ? 'gemini' : 'openrouter';

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    attempts++;
    const keyItem = keyPoolManager.acquireKey(targetProvider, tenantId, excludedKeyIds);
    
    // Fallback to system env key if pool key is not returned
    const apiKey = keyItem ? keyItem.key : (targetProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY);

    if (!apiKey && !keyItem) {
      break; // No further pool keys available
    }

    try {
      const { stdout } = await executeAttempt(apiKey);
      const result = parsePiJsonOutput(stdout, sessionId, fullModel);

      if (result.error && (result.error.includes('429') || result.error.includes('quota') || result.error.includes('RESOURCE_EXHAUSTED'))) {
        if (keyItem) {
          keyPoolManager.markRateLimited(keyItem.id, 60);
          excludedKeyIds.add(keyItem.id);
        }
        console.warn(`[Pi Runner Pool Method] Rate limit on model ${fullModel} with key ${keyItem?.id || 'env'}, falling back to next pool API key...`);
        if (!keyItem) break;
        continue;
      }

      if (keyItem) keyPoolManager.releaseKey(keyItem.id);
      
      const inTokens = result.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = result.usage?.outputTokens || Math.max(20, Math.round((result.text || '').length / 4));
      try {
        deductLlmCredits(tenantId, fullModel, inTokens, outTokens);
      } catch (_) {}

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
    text: "Rate limit temporarily reached due to high platform traffic. All shared complimentary tokens are currently busy under rate limits. Please wait 30 seconds or configure your custom API key (BYOK).",
    suggestions: ["Retry request", "Configure custom API key"],
    sessionId,
    model: fullModel,
    error: "RATE_LIMIT_EXHAUSTED"
  };
}

/**
 * Parses stdout JSON lines emitted by `pi -p --mode json`.
 */
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

        if (msg.errorMessage) {
          errorMessage = msg.errorMessage;
        }
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
          if (lastAssistant.errorMessage) {
            errorMessage = lastAssistant.errorMessage;
          }
        }
      }
    } catch (_) {}
  }

  // Parse [SUGGEST: ...] or JSON formatting embedded in output
  if (finalText) {
    const suggestMatches = finalText.match(/\[SUGGEST:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi);
    if (suggestMatches) {
      suggestions = suggestMatches.map(m => m.replace(/^\[SUGGEST:\s*/i, '').replace(/\]$/, '').split('|')[0].trim());
    }

    // Fallback: Check if response is raw JSON with text and suggestions
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

/**
 * Lists all real `pi` session files from `/workspaces/${tenantId}/.pi/sessions`
 */
export function listPiSessions(tenantId: string = 'default_user'): PiSessionItem[] {
  ensureUserHarness(tenantId);
  const userRoot = getUserRoot(tenantId);
  const sessionDir = path.join(userRoot, '.pi', 'sessions');

  if (!fs.existsSync(sessionDir)) {
    return [];
  }

  const items: PiSessionItem[] = [];
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));

  for (const f of files) {
    const fullPath = path.join(sessionDir, f);
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

          // Handle session turn message entries
          if (entry.type === 'turn_end' || entry.type === 'message_end' || entry.role) {
            const role = entry.role || entry.message?.role;
            let text = '';
            const rawContent = entry.content || entry.message?.content;
            if (typeof rawContent === 'string') {
              text = rawContent;
            } else if (Array.isArray(rawContent)) {
              text = rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
            }

            if (text && (role === 'user' || role === 'assistant' || role === 'agent')) {
              messageCount++;
              history.push({
                sender: role === 'user' ? 'user' : 'agent',
                text,
                timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : stats.mtime.toISOString()
              });
            }

            if (entry.message?.usage?.totalTokens) {
              tokensUsed += entry.message.usage.totalTokens;
            }
          }
        } catch (_) {}
      }

      const id = f.replace(/\.jsonl?$/, '');
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

  // Sort by updatedAt descending
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items;
}

/**
 * Creates a new real `pi` session for a tenant.
 */
export function createPiSession(tenantId: string = 'default_user', name?: string): PiSessionItem {
  ensureUserHarness(tenantId);
  const userRoot = getUserRoot(tenantId);
  const sessionDir = path.join(userRoot, '.pi', 'sessions');
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

/**
 * Deletes a real `pi` session file.
 */
export function deletePiSession(tenantId: string = 'default_user', sessionId: string): boolean {
  ensureUserHarness(tenantId);
  const userRoot = getUserRoot(tenantId);
  const sessionDir = path.join(userRoot, '.pi', 'sessions');
  const filePath = path.join(sessionDir, `${sessionId}.jsonl`);
  const altPath = path.join(sessionDir, `${sessionId}.json`);

  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }
  if (fs.existsSync(altPath)) {
    fs.unlinkSync(altPath);
    deleted = true;
  }
  return deleted;
}

/**
 * Executes `pi --list-models` live to retrieve available models and providers.
 */
export const DEFAULT_PI_CLI_FALLBACK_MODELS: PiModelItem[] = [
  // Google
  { provider: 'google', model: 'gemini-3.6-flash', fullModel: 'google/gemini-3.6-flash', context: '1.0M', maxOutput: '65.5K', thinking: true, images: true },
  { provider: 'google', model: 'gemini-2.0-flash', fullModel: 'google/gemini-2.0-flash', context: '1.0M', maxOutput: '8.2K', thinking: false, images: true },
  { provider: 'google', model: 'gemma-4-31b-it', fullModel: 'google/gemma-4-31b-it', context: '262.1K', maxOutput: '32.8K', thinking: true, images: true },
  
  // OpenRouter
  { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', fullModel: 'openrouter/anthropic/claude-3.5-sonnet', context: '200K', maxOutput: '8K', thinking: true, images: true },
  { provider: 'openrouter', model: 'deepseek/deepseek-r1', fullModel: 'openrouter/deepseek/deepseek-r1', context: '128K', maxOutput: '8K', thinking: true, images: false },
  { provider: 'openrouter', model: 'openai/gpt-4o', fullModel: 'openrouter/openai/gpt-4o', context: '128K', maxOutput: '4K', thinking: false, images: true },
  { provider: 'openrouter', model: 'nvidia/nemotron-3-ultra-550b-a55b:free', fullModel: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free', context: '128K', maxOutput: '4K', thinking: false, images: false },
  { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free', fullModel: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', context: '128K', maxOutput: '4K', thinking: false, images: false },

  // Anthropic
  { provider: 'anthropic', model: 'claude-3-5-sonnet-latest', fullModel: 'anthropic/claude-3-5-sonnet-latest', context: '200K', maxOutput: '8K', thinking: true, images: true },
  { provider: 'anthropic', model: 'claude-3-5-haiku-latest', fullModel: 'anthropic/claude-3-5-haiku-latest', context: '200K', maxOutput: '8K', thinking: false, images: false },

  // OpenAI
  { provider: 'openai', model: 'gpt-4o', fullModel: 'openai/gpt-4o', context: '128K', maxOutput: '4K', thinking: false, images: true },
  { provider: 'openai', model: 'gpt-4o-mini', fullModel: 'openai/gpt-4o-mini', context: '128K', maxOutput: '16K', thinking: false, images: true },
  { provider: 'openai', model: 'o3-mini', fullModel: 'openai/o3-mini', context: '200K', maxOutput: '100K', thinking: true, images: false },

  // Groq
  { provider: 'groq', model: 'llama-3.3-70b-versatile', fullModel: 'groq/llama-3.3-70b-versatile', context: '128K', maxOutput: '8K', thinking: false, images: false },
  { provider: 'groq', model: 'deepseek-r1-distill-llama-70b', fullModel: 'groq/deepseek-r1-distill-llama-70b', context: '128K', maxOutput: '8K', thinking: true, images: false },

  // DeepSeek
  { provider: 'deepseek', model: 'deepseek-chat', fullModel: 'deepseek/deepseek-chat', context: '64K', maxOutput: '8K', thinking: false, images: false },
  { provider: 'deepseek', model: 'deepseek-reasoner', fullModel: 'deepseek/deepseek-reasoner', context: '64K', maxOutput: '8K', thinking: true, images: false }
];

/**
 * Executes `pi --list-models` live to retrieve available models and providers.
 */
export function listPiModels(): PiModelItem[] {
  try {
    let piBin = 'pi';
    if (fs.existsSync('/app/applet/node_modules/.bin/pi')) {
      piBin = '/app/applet/node_modules/.bin/pi';
    } else if (fs.existsSync('./node_modules/.bin/pi')) {
      piBin = './node_modules/.bin/pi';
    } else if (fs.existsSync(path.join(__dirname, '..', 'node_modules', '.bin', 'pi'))) {
      piBin = path.join(__dirname, '..', 'node_modules', '.bin', 'pi');
    }

    const stdout = execFileSync(piBin, ['--list-models'], {
      encoding: 'utf8',
      timeout: 10000
    });

    const items: PiModelItem[] = [];
    const lines = stdout.split('\n');

    for (const line of lines) {
      if (!line.trim() || line.startsWith('provider')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const provider = parts[0];
        const model = parts[1];
        items.push({
          provider,
          model,
          fullModel: `${provider}/${model}`,
          context: parts[2] || '128K',
          maxOutput: parts[3] || '8K',
          thinking: parts[4] === 'yes',
          images: parts[5] === 'yes'
        });
      }
    }

    // Merge fallback provider models if certain providers are missing
    const existingProviders = new Set(items.map(i => i.provider));
    for (const fb of DEFAULT_PI_CLI_FALLBACK_MODELS) {
      if (!existingProviders.has(fb.provider)) {
        items.push(fb);
      }
    }

    return items.length > 0 ? items : DEFAULT_PI_CLI_FALLBACK_MODELS;
  } catch (err) {
    return DEFAULT_PI_CLI_FALLBACK_MODELS;
  }
}
