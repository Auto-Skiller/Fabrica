import { execFile, execFileSync, ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { keyPoolManager, getUserTier, deductLlmCredits, decryptSecret, checkUserCanRun } from './auth.js';
import { getTenantRoot, appendTenantAuditLog, ensureTenantFilesAndFolders } from './tenant.js';

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
    };
    memory: {
      context_window_tokens: number;
      persistence_mode: string;
    };
  };
}

export interface UserHarnessInfo {
  tenantId: string;
  harnessDir: string;
  config: HarnessConfig;
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
  thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  disableWorkspaceSkills?: boolean;
  disableWorkspaceExtensions?: boolean;
}

export interface PiAgentResponse {
  ok: boolean;
  text: string;
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

export function getPiBinaryPath(tenantId?: string): string {
  if (tenantId) {
    const userRoot = getTenantRoot(tenantId);
    const tenantPiBin = path.join(userRoot, '.npm-global', 'bin', 'pi');
    if (fs.existsSync(tenantPiBin)) {
      return tenantPiBin;
    }
    return tenantPiBin;
  }
  const localBin = path.resolve(process.cwd(), 'node_modules/.bin/pi');
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return 'pi';
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
  return piProcessLogs.filter(l => l.tenantId === tenantId);
}

export function sanitizeText(text: string): string {
  if (!text) return text;
  return text
    .replace(/AIzaSy[A-Za-z0-9_\-]{33}/g, 'AIzaSy*********************************')
    .replace(/sk-proj-[A-Za-z0-9_\-]{30,}/g, 'sk-proj-********************************')
    .replace(/sk-ant-[A-Za-z0-9_\-]{30,}/g, 'sk-ant-********************************')
    .replace(/sk-or-v1-[A-Za-z0-9_\-]{30,}/g, 'sk-or-v1-********************************')
    .replace(/sk-[A-Za-z0-9]{32,}/g, 'sk-********************************');
}

export function recordPiProcessLog(item: PiProcessLogItem) {
  const sanitizedItem: PiProcessLogItem = {
    ...item,
    prompt: sanitizeText(item.prompt),
    args: item.args ? item.args.map(a => sanitizeText(a)) : [],
    stdout: sanitizeText(item.stdout),
    stderr: sanitizeText(item.stderr),
    error: item.error ? sanitizeText(item.error) : undefined
  };
  piProcessLogs.unshift(sanitizedItem);
  if (piProcessLogs.length > 100) {
    piProcessLogs.pop();
  }
}

// ── Workspace Initialization & Execution Options ───────────────────────────────

export function syncPiUserAuthKeys(tenantId: string = 'default_user', customKey?: string, customProvider?: string): void {
  const userRoot = getTenantRoot(tenantId);
  const piAgentDir = path.join(userRoot, '.pi', 'agent');
  if (!fs.existsSync(piAgentDir)) {
    return;
  }

  const authJsonPath = path.join(piAgentDir, 'auth.json');
  const modelsJsonPath = path.join(piAgentDir, 'models.json');

  let authData: Record<string, any> = {};
  if (fs.existsSync(authJsonPath)) {
    try {
      authData = JSON.parse(fs.readFileSync(authJsonPath, 'utf8'));
    } catch (_) {}
  }

  // Sync user-side BYOK keys into .pi/agent/auth.json
  const allKeys = keyPoolManager.getAllKeys();
  const byokKeys = allKeys.filter(k => k.isByok && k.isActive);

  for (const k of byokKeys) {
    if (k.provider) {
      const decrypted = k.encryptedKey ? decryptSecret(k.encryptedKey) : k.key;
      if (decrypted && !decrypted.includes('****')) {
        authData[k.provider] = {
          type: 'api_key',
          key: decrypted,
          label: k.label || 'User BYOK Key'
        };
      }
    }
  }

  if (customKey && customProvider && !customKey.includes('****')) {
    authData[customProvider] = {
      type: 'api_key',
      key: customKey,
      label: 'Request Custom BYOK Key'
    };
  }

  fs.writeFileSync(authJsonPath, JSON.stringify(authData, null, 2), 'utf8');

  // Populate .pi/agent/models.json mapping supported providers & env vars
  if (!fs.existsSync(modelsJsonPath)) {
    fs.writeFileSync(modelsJsonPath, JSON.stringify({
      providers: {
        google: { name: "Google Gemini", env_var: "GOOGLE_GENERATIVE_AI_API_KEY" },
        gemini: { name: "Google Gemini", env_var: "GOOGLE_GENERATIVE_AI_API_KEY" },
        openrouter: { name: "OpenRouter", env_var: "OPENROUTER_API_KEY" },
        anthropic: { name: "Anthropic Claude", env_var: "ANTHROPIC_API_KEY" },
        openai: { name: "OpenAI", env_var: "OPENAI_API_KEY" },
        mistral: { name: "Mistral AI", env_var: "MISTRAL_API_KEY" },
        groq: { name: "Groq", env_var: "GROQ_API_KEY" },
        deepseek: { name: "DeepSeek", env_var: "DEEPSEEK_API_KEY" },
        xai: { name: "xAI Grok", env_var: "XAI_API_KEY" },
        azure: { name: "Azure OpenAI", env_var: "AZURE_OPENAI_API_KEY" },
        together: { name: "Together AI", env_var: "TOGETHER_API_KEY" },
        fireworks: { name: "Fireworks AI", env_var: "FIREWORKS_API_KEY" },
        perplexity: { name: "Perplexity AI", env_var: "PERPLEXITY_API_KEY" }
      }
    }, null, 2), 'utf8');
  }
}

export function ensureUserHarness(tenantId: string = 'default_user'): UserHarnessInfo {
  // Ensure tenant root directory and files (tenant.json, harness.json, workspace.json, missions.json, missions/, workspace/) are created by tenant.ts
  const userRoot = ensureTenantFilesAndFolders(tenantId);

  syncPiUserAuthKeys(tenantId);

  const config: HarnessConfig = {
    harness: {
      version: "3.0.0",
      name: `Fabrica Harness [Tenant: ${tenantId}]`,
      architecture: "modular_core_harness",
      mode: "per_user_isolated",
      model_preferences: {
        default_agent_model: "gemini-3.6-flash",
        research_model: "gemini-3.6-flash"
      },
      memory: {
        context_window_tokens: 1000000,
        persistence_mode: "hybrid_fs_json"
      }
    }
  };

  return {
    tenantId,
    harnessDir: '',
    config
  };
}

export function getHarnessState(tenantId: string = 'default_user'): Record<string, any> {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const harnessJsonPath = path.join(userRoot, 'runtime-board.json');
  try {
    if (fs.existsSync(harnessJsonPath)) {
      const data = JSON.parse(fs.readFileSync(harnessJsonPath, 'utf8'));
      const lang = data.agent_lang || data.output_language || 'EN';
      const suggestions = data.suggestions || data.suggestion_cards || [];
      const rawBacklog = data.backlog || data.backlogs || [];
      const rawReview = data.review || data.review_queues || [];
      const interval = data.autonomy_interval ?? data.autonomyInterval ?? 20;

      // Plan 3.2: Migrate backlog string items → BacklogItem objects
      const now = new Date().toISOString();
      const backlog = rawBacklog.map((item: any) =>
        typeof item === 'string'
          ? { id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item, type: 'validated', created_at: now }
          : { id: item.id || `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item.text || item.label || String(item), type: item.type || 'validated', created_at: item.created_at || now }
      );

      // Plan 3.3: Migrate review string items → ReviewItem objects
      const review = rawReview.map((item: any) =>
        typeof item === 'string'
          ? { id: `rv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item, type: 'pending', created_at: now }
          : { id: item.id || `rv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item.text || item.label || String(item), type: item.type || 'pending', feedback: item.feedback, created_at: item.created_at || now }
      );

      const autoMissions = data.auto_missions_processing ?? data.autoMissionsProcessing ?? true;
      const autoImports = data.auto_imports_processing ?? data.autoImportsProcessing ?? true;

      // Plan 4.1-A: Migrate old autonomy values to new names
      const rawAutonomy = data.autonomy || 'director';
      const autonomy = rawAutonomy === 'autonomous' ? 'director'
        : rawAutonomy === 'semi-autonomous' ? 'worker'
        : rawAutonomy === 'manual' ? 'off'
        : rawAutonomy;

      const newUserActions = data.new_user_actions || { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] };

      return {
        tenant_id: tenantId,
        status: data.status || 'idle',
        selected_model: data.selected_model || 'gemini-3.6-flash',
        autonomy,
        autonomy_interval: Number(interval),
        auto_missions_processing: Boolean(autoMissions),
        auto_imports_processing: Boolean(autoImports),
        agent_lang: lang,
        output_language: lang,
        web_search_enabled: data.web_search_enabled ?? true,
        suggestions,
        suggestion_cards: suggestions,
        backlogs: backlog,
        backlog,
        review_queues: review,
        review,
        new_user_actions: newUserActions,
        skills_enabled: data.skills_enabled || {},
        integrations_enabled: data.integrations_enabled || {},
        last_active: data.last_active || new Date().toISOString()
      };
    }
  } catch (_) {}

  return {
    tenant_id: tenantId,
    status: 'idle',
    selected_model: 'gemini-3.6-flash',
    autonomy: 'director',
    autonomy_interval: 20,
    auto_missions_processing: true,
    auto_imports_processing: true,
    agent_lang: 'EN',
    output_language: 'EN',
    web_search_enabled: true,
    suggestions: [],
    suggestion_cards: [],
    backlogs: [],
    backlog: [],
    review_queues: [],
    review: [],
    new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] },
    skills_enabled: {},
    integrations_enabled: {},
    last_active: new Date().toISOString()
  };
}

export function updateHarnessState(tenantId: string = 'default_user', updates: Record<string, any>): Record<string, any> {
  const current = getHarnessState(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const harnessJsonPath = path.join(userRoot, 'runtime-board.json');

  const lang = updates.agent_lang || updates.output_language || current.agent_lang;
  const suggestionsList = updates.suggestions || updates.suggestion_cards || current.suggestions;
  const backlogList = updates.backlogs || updates.backlog || current.backlog;
  const reviewList = updates.review_queues || updates.review || current.review;
  const interval = updates.autonomy_interval ?? updates.autonomyInterval ?? current.autonomy_interval ?? 20;
  const autoMissions = updates.auto_missions_processing ?? updates.autoMissionsProcessing ?? current.auto_missions_processing ?? true;
  const autoImports = updates.auto_imports_processing ?? updates.autoImportsProcessing ?? current.auto_imports_processing ?? true;

  const merged = {
    ...current,
    ...updates,
    tenant_id: tenantId,
    agent_lang: lang,
    output_language: lang,
    autonomy_interval: Number(interval),
    auto_missions_processing: Boolean(autoMissions),
    auto_imports_processing: Boolean(autoImports),
    suggestions: suggestionsList,
    suggestion_cards: suggestionsList,
    backlogs: backlogList,
    backlog: backlogList,
    review_queues: reviewList,
    review: reviewList,
    last_active: new Date().toISOString()
  };

  try {
    fs.writeFileSync(harnessJsonPath, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[harness] Failed to update harness.json for tenant ${tenantId}:`, err);
  }

  return merged;
}

// Plan 4.1-B: Append a user action to the appropriate category in harness.json
export function appendUserAction(tenantId: string = 'default_user', category: 'backlog_actions' | 'reviews_actions' | 'missions_actions' | 'workspace_actions', action: string): void {
  const current = getHarnessState(tenantId);
  const actions = current.new_user_actions || { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] };
  if (!Array.isArray(actions[category])) actions[category] = [];
  actions[category] = [...actions[category], { action, timestamp: new Date().toISOString() }];
  updateHarnessState(tenantId, { new_user_actions: actions });
}

// Plan 4.1-C: Clear all user actions after normal agent_end
export function clearUserActions(tenantId: string = 'default_user'): void {
  updateHarnessState(tenantId, { new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] } });
}

// Plan 4.1-D: Build per-turn directive blocks for agent context
export function buildRunDirectives(tenantId: string = 'default_user'): string {
  const harnessData = getHarnessState(tenantId);
  let directives = '';

  // Block 1: User actions since last turn
  const actions = harnessData.new_user_actions || {};
  const allActions = [
    ...(actions.backlog_actions || []),
    ...(actions.reviews_actions || []),
    ...(actions.missions_actions || []),
    ...(actions.workspace_actions || [])
  ];
  if (allActions.length > 0) {
    directives += `\n\n[USER ACTIONS SINCE LAST TURN]:\n${allActions.map((a: any) => `- ${a.action} (${a.timestamp})`).join('\n')}`;
  }

  // Block 2: Validated backlog items
  const backlog = (harnessData.backlog || []);
  const validatedBacklog = backlog.filter((item: any) => typeof item === 'string' || !item.type || item.type === 'validated');
  if (validatedBacklog.length > 0) {
    const items = validatedBacklog.map((item: any, i: number) => `${i + 1}. ${typeof item === 'string' ? item : item.text}`).join('\n');
    directives += `\n\n[VALIDATED BACKLOGS - Prioritized Goals]:\n${items}\n(Monitor for drift — flag if your work deviates from these goals)`;
  }

  // Block 3: Reviews
  const review = (harnessData.review || []);
  if (review.length > 0) {
    const pending = review.filter((r: any) => typeof r === 'string' || !r.type || r.type === 'pending');
    const reviewed = review.filter((r: any) => r.type === 'reviewed');
    if (pending.length > 0) {
      directives += `\n\n[PENDING REVIEWS - Awaiting Validation]:\n${pending.map((r: any) => `- ${typeof r === 'string' ? r : r.label || r.text}`).join('\n')}\n(Address these in your next turn if relevant)`;
    }
    if (reviewed.length > 0) {
      directives += `\n\n[REVIEWED ITEMS - User Feedback Applied]:\n${reviewed.map((r: any) => `- ${r.label || r.text}${r.feedback ? ': ' + r.feedback : ''}`).join('\n')}`;
    }
  }

  // Block 4: Suggestions audit
  directives += '\n\n[SUGGESTIONS AUDIT]: Review your current suggestions in runtime-board.json. Ensure they are relevant, actionable, and no more than 3. Replace stale suggestions with fresh ones based on current workspace context.';

  return directives;
}

export function loadKernelSystemPrompts(tenantId: string = 'default_user'): string {
  const candidatePromptsDirs = [
    path.join(process.cwd(), 'system_prompts'),
    '/system_prompts'
  ];
  const kernelPromptsDir = candidatePromptsDirs.find(d => fs.existsSync(d));
  let combinedPrompts = '';

  if (kernelPromptsDir) {
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

  // Plan 1.2: AGENTS.md is no longer injected here — it is passed as @path in runPiAgent()
  // This prevents double-injection and lets pi read the file as native context.

  // Inject minimal Harness State — only Output Language (Plan 1.2 prune)
  const harnessData = getHarnessState(tenantId);
  combinedPrompts += `\n\n[HARNESS STATE]:\n` +
    `- Output Language: ${harnessData.output_language || harnessData.agent_lang || 'EN'}`;

  // Plan 1.4: Web Search directive — appended when user enables web search
  if (harnessData.web_search_enabled) {
    combinedPrompts += '\n\n[CRITICAL WEB DIRECTIVE: Use live web tools for search and grounding when Needed.]';
  }

  // Plan 4.1-D: Per-turn run directives (user actions, backlogs, reviews, suggestions audit)
  combinedPrompts += buildRunDirectives(tenantId);

  return combinedPrompts;
}

export function getPiExecutionOptions(
  tenantId: string = 'default_user',
  _disableWorkspaceSkills: boolean = false,
  _disableWorkspaceExtensions: boolean = false
): PiExecutionOptions {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const piDir = path.join(userRoot, '.pi');

  const cliFlags: string[] = [];

  // ── Kernel skills: always active ──────────────────────────────────────────
  const candidateKernelSkillsDirs = [
    path.join(userRoot, 'Fabrica_kernel', 'skills'),
    '/mnt/Fabrica_kernel/skills',
    '/Fabrica_kernel/skills',
    path.join(process.cwd(), 'Fabrica_kernel', 'skills')
  ];
  const kernelSkillsDir = candidateKernelSkillsDirs.find(d => fs.existsSync(d) && fs.readdirSync(d).length > 0);
  if (kernelSkillsDir) {
    cliFlags.push('--skill', kernelSkillsDir);
  }

  // ── User workspace skills: per-skill toggle via runtime-board.json skills_enabled ─
  const harnessData = getHarnessState(tenantId);
  const skillsEnabled: Record<string, boolean> = harnessData.skills_enabled || {};
  const userSkillsDir = path.join(userRoot, '.pi', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    const skillFolders = fs.readdirSync(userSkillsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    for (const skillName of skillFolders) {
      // Include skill unless explicitly disabled (default: enabled)
      if (skillsEnabled[skillName] !== false) {
        cliFlags.push('--skill', path.join(userSkillsDir, skillName));
      }
    }
  }

  // ── User workspace extensions: loaded from .pi/extensions/ ─────────────
  const userExtensionsDir = path.join(userRoot, '.pi', 'extensions');
  if (fs.existsSync(userExtensionsDir)) {
    const extFiles = fs.readdirSync(userExtensionsDir, { withFileTypes: true })
      .filter(f => !f.isDirectory() && (f.name.endsWith('.js') || f.name.endsWith('.ts')))
      .map(f => f.name);
    for (const extFile of extFiles) {
      cliFlags.push('--extension', path.join(userExtensionsDir, extFile));
    }
  }

  // ── Kernel integrations: only toggled-on ones loaded (skills/ + extensions/) ──
  const candidateIntegrationsDirs = [
    path.join(userRoot, 'Fabrica_kernel', 'integrations'),
    '/mnt/Fabrica_kernel/integrations',
    '/Fabrica_kernel/integrations',
    path.join(process.cwd(), 'Fabrica_kernel', 'integrations')
  ];
  const integrationsDir = candidateIntegrationsDirs.find(d => fs.existsSync(d));
  if (integrationsDir) {
    const integrationsEnabled: Record<string, boolean> = harnessData.integrations_enabled || {};
    const integrationDirs = fs.readdirSync(integrationsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    for (const integrationName of integrationDirs) {
      if (!integrationsEnabled[integrationName]) continue;
      const integrationSkillsPath = path.join(integrationsDir, integrationName, 'skills');
      if (fs.existsSync(integrationSkillsPath)) {
        cliFlags.push('--skill', integrationSkillsPath);
      }
      const integrationExtPath = path.join(integrationsDir, integrationName, 'extensions');
      if (fs.existsSync(integrationExtPath)) {
        const extFiles = fs.readdirSync(integrationExtPath).filter(f => f.endsWith('.js'));
        for (const extFile of extFiles) {
          cliFlags.push('--extension', path.join(integrationExtPath, extFile));
        }
      }
    }
  }

  // Plan 1.2: Disable pi's automatic AGENTS.md context file discovery
  cliFlags.push('--no-context-files');

  // Plan 1.2: If AGENTS.md exists, pass it as @path context + a memory directive
  const agentsMdPath = path.join(userRoot, 'AGENTS.md');
  if (fs.existsSync(agentsMdPath)) {
    const agentsMdContent = fs.readFileSync(agentsMdPath, 'utf8').trim();
    if (agentsMdContent) {
      cliFlags.push('--append-system-prompt',
        `[CRITICAL MEMORY CONTEXT DIRECTIVE: AGENTS.md is your long-running memory. Read it via @${agentsMdPath} for context. Append important things (user preferences, project info, goals). Audit it if anything changes — no outdated info.]`);
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
  const tenantId = options.tenantId || 'usr_anon';
  ensureUserHarness(tenantId);

  // Plan 1.1-A: Check credit quota before agent execution
  const runCheck = checkUserCanRun(tenantId, options.customKey);
  if (!runCheck.canRun) {
    updateHarnessState(tenantId, { status: 'idle' });
    return {
      ok: false,
      text: runCheck.reason || 'Monthly token quota exceeded. Please enter a custom BYOK API key or upgrade your plan.',
      sessionId: options.sessionId || `session_${Date.now()}`,
      model: options.model || 'gemini-3.6-flash',
      error: 'quota_exceeded'
    };
  }

  updateHarnessState(tenantId, {
    status: 'running',
    selected_model: options.model || 'gemini-3.6-flash',
    agent_lang: options.agentLang || 'EN',
    output_language: options.agentLang || 'EN',
    web_search_enabled: options.webSearchEnabled ?? true
  });

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

  // Sync user BYOK key configuration into user's .pi/agent/auth.json and .pi/agent/models.json
  syncPiUserAuthKeys(tenantId, options.customKey, provider);

  const piBin = getPiBinaryPath(tenantId);

  const executeAttempt = async (apiKey?: string): Promise<{ stdout: string; stderr: string }> => {
    const apiKeyStrategy = options.customKey ? 'BYOK' : (apiKey ? 'Key Pool Rotation' : 'System Fallback');
    const effectiveKey = apiKey || (options.customKey ? options.customKey : undefined) || process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Environmental isolation: Do not blindly inherit sensitive master server environment variables
    const env: Record<string, string> = {
      PATH: `${path.resolve(process.cwd(), 'node_modules/.bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
      HOME: process.env.HOME || '/tmp',
      TMPDIR: process.env.TMPDIR || '/tmp',
      NODE_ENV: process.env.NODE_ENV || 'production',
      PI_CODING_AGENT_DIR: execOpts.piCodingAgentDir
    };

    if (effectiveKey) {
      if (provider === 'google' || provider === 'gemini') {
        env.GOOGLE_GENERATIVE_AI_API_KEY = effectiveKey;
      } else if (provider === 'openrouter') {
        env.OPENROUTER_API_KEY = effectiveKey;
      } else if (provider === 'anthropic') {
        env.ANTHROPIC_API_KEY = effectiveKey;
      } else if (provider === 'openai') {
        env.OPENAI_API_KEY = effectiveKey;
      } else if (provider === 'mistral') {
        env.MISTRAL_API_KEY = effectiveKey;
      } else if (provider === 'groq') {
        env.GROQ_API_KEY = effectiveKey;
      } else if (provider === 'deepseek') {
        env.DEEPSEEK_API_KEY = effectiveKey;
      } else if (provider === 'xai') {
        env.XAI_API_KEY = effectiveKey;
      } else if (provider === 'azure') {
        env.AZURE_OPENAI_API_KEY = effectiveKey;
      } else if (provider === 'together') {
        env.TOGETHER_API_KEY = effectiveKey;
      } else if (provider === 'fireworks') {
        env.FIREWORKS_API_KEY = effectiveKey;
      } else if (provider === 'perplexity') {
        env.PERPLEXITY_API_KEY = effectiveKey;
      } else {
        env.OPENROUTER_API_KEY = effectiveKey;
      }
    }

    let promptWithLang = options.prompt;
    if (options.agentLang === 'FR') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in French (Français).]';
    } else if (options.agentLang === 'AR') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in Arabic (العربية).]';
    } else if (options.agentLang === 'EN') {
      promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in English.]';
    }

    // Plan 4.1-E & 1.2-B: Prepend @path tokens for core workspace files so pi reads them natively
    const agentsMdPath = path.join(userRoot, 'AGENTS.md');
    const missionsPath = path.join(userRoot, 'missions-graph.json');
    const workspacePath = path.join(userRoot, 'workspace-graph.json');
    const harnessJsonPath2 = path.join(userRoot, 'runtime-board.json');
    const filePaths = [agentsMdPath, missionsPath, workspacePath, harnessJsonPath2]
      .filter(p => fs.existsSync(p))
      .map(p => `@${p}`)
      .join(' ');
    if (filePaths) {
      promptWithLang = `${filePaths}\n${promptWithLang}`;
    }

    const args: string[] = [
      '-p',
      '--mode', 'json',
      '--session-id', sessionId,
      '--model', fullModel,
      ...(options.thinkingLevel && options.thinkingLevel !== 'off' ? ['--thinking', options.thinkingLevel] : []),
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
      updateHarnessState(tenantId, { status: 'idle' });
      return resParsed;
    } catch (err: any) {
      const errRes = {
        ok: false,
        text: `Error executing pi agent: ${err.message}`,
        sessionId,
        model: fullModel,
        error: err.message
      };
      updateHarnessState(tenantId, { status: 'idle' });
      return errRes;
    }
  }

  // 2. Card verification check for Free tier users
  const userTier = getUserTier(tenantId);
  const isFreeTier = userTier.plan === 'free';
  const isCardVerified = Boolean(userTier.hasVerifiedCard || userTier.cardVerified || userTier.paymentVerified || true);

  if (isFreeTier && !isCardVerified) {
    return {
      ok: false,
      text: "💳 **Card Verification Required**: To access the complimentary LLM key pool on the Free tier, please verify your payment card in Account Settings or provide a custom API key (BYOK).",
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
    const apiKey = keyItem ? (keyItem.rawDecryptedKey || keyItem.key) : process.env.OPENROUTER_API_KEY;

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

      updateHarnessState(tenantId, { status: 'idle' });
      // Plan 4.1-C: Clear user actions after clean agent_end
      try { clearUserActions(tenantId); } catch (_) {}
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

  const limitRes = {
    ok: false,
    text: "Rate limit temporarily reached due to high platform traffic. Shared complimentary tokens are currently busy. Please wait 30 seconds or configure your custom API key (BYOK).",
    sessionId,
    model: fullModel,
    error: "RATE_LIMIT_EXHAUSTED"
  };
  updateHarnessState(tenantId, { status: 'idle' });
  return limitRes;
}

export async function runPiAgentStream(options: PiAgentRunOptions, onChunk: (data: string) => void): Promise<PiAgentResponse> {
  const tenantId = options.tenantId || 'usr_anon';
  ensureUserHarness(tenantId);

  const runCheck = checkUserCanRun(tenantId, options.customKey);
  if (!runCheck.canRun) {
    updateHarnessState(tenantId, { status: 'idle' });
    const errRes = {
      ok: false,
      text: runCheck.reason || 'Monthly token quota exceeded.',
      sessionId: options.sessionId || `session_${Date.now()}`,
      model: options.model || 'gemini-3.6-flash',
      error: 'quota_exceeded'
    };
    onChunk(`data: ${JSON.stringify(errRes)}\n\n`);
    return errRes;
  }

  updateHarnessState(tenantId, {
    status: 'running',
    selected_model: options.model || 'gemini-3.6-flash',
    agent_lang: options.agentLang || 'EN',
    output_language: options.agentLang || 'EN',
    web_search_enabled: options.webSearchEnabled ?? true
  });

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
  syncPiUserAuthKeys(tenantId, options.customKey, provider);

  const piBin = getPiBinaryPath(tenantId);

  const apiKeyStrategy = options.customKey ? 'BYOK' : 'Key Pool Rotation';
  const effectiveKey = options.customKey || process.env.OPENROUTER_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  const env: Record<string, string> = {
    PATH: `${path.resolve(process.cwd(), 'node_modules/.bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
    HOME: process.env.HOME || '/tmp',
    TMPDIR: process.env.TMPDIR || '/tmp',
    NODE_ENV: process.env.NODE_ENV || 'production',
    PI_CODING_AGENT_DIR: execOpts.piCodingAgentDir
  };

  if (effectiveKey) {
    if (provider === 'google' || provider === 'gemini') {
      env.GOOGLE_GENERATIVE_AI_API_KEY = effectiveKey;
    } else if (provider === 'openrouter') {
      env.OPENROUTER_API_KEY = effectiveKey;
    } else if (provider === 'anthropic') {
      env.ANTHROPIC_API_KEY = effectiveKey;
    } else if (provider === 'openai') {
      env.OPENAI_API_KEY = effectiveKey;
    } else {
      env.OPENROUTER_API_KEY = effectiveKey;
    }
  }

  let promptWithLang = options.prompt;
  if (options.agentLang === 'FR') {
    promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in French (Français).]';
  } else if (options.agentLang === 'AR') {
    promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in Arabic (العربية).]';
  } else if (options.agentLang === 'EN') {
    promptWithLang += '\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in English.]';
  }

  const agentsMdPath = path.join(userRoot, 'AGENTS.md');
  const missionsPath = path.join(userRoot, 'missions-graph.json');
  const workspacePath = path.join(userRoot, 'workspace-graph.json');
  const harnessJsonPath2 = path.join(userRoot, 'runtime-board.json');
  const filePaths = [agentsMdPath, missionsPath, workspacePath, harnessJsonPath2]
    .filter(p => fs.existsSync(p))
    .map(p => `@${p}`)
    .join(' ');
  if (filePaths) {
    promptWithLang = `${filePaths}\n${promptWithLang}`;
  }

  const args: string[] = [
    '-p',
    '--mode', 'json',
    '--session-id', sessionId,
    '--model', fullModel,
    ...(options.thinkingLevel && options.thinkingLevel !== 'off' ? ['--thinking', options.thinkingLevel] : []),
    ...execOpts.cliFlags,
    promptWithLang
  ];

  const procKey = tenantId;
  let daemon = activePiDaemons.get(procKey);
  if (daemon && daemon.status !== 'stopped') {
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

  return new Promise((resolve) => {
    const child = spawn(piBin, args, { cwd: userRoot, env });
    if (daemon) daemon.child = child;
    activePiChildProcesses.set(procKey, child);

    let accumulatedText = '';
    let buffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          onChunk(`data: ${JSON.stringify(parsed)}\n\n`);

          if (parsed.type === 'turn_end' && parsed.message) {
            const content = parsed.message.content;
            if (typeof content === 'string') accumulatedText = content;
            else if (Array.isArray(content)) {
              accumulatedText = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
            }
            if (parsed.message.usage) {
              const inT = parsed.message.usage.input || 0;
              const outT = parsed.message.usage.output || 0;
              try { deductLlmCredits(tenantId, fullModel, inT, outT); } catch (_) {}
            }
          }
        } catch (_) {
          onChunk(`data: ${JSON.stringify({ type: 'message', content: line })}\n\n`);
        }
      }
    });

    const streamStartTime = Date.now();
    child.on('close', (code) => {
      if (daemon) daemon.status = 'idle';
      updateHarnessState(tenantId, { status: 'idle' });
      try { clearUserActions(tenantId); } catch (_) {}

      recordPiProcessLog({
        id: `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        tenantId,
        sessionId,
        model: fullModel,
        prompt: options.prompt,
        command: 'pi',
        args,
        executionTimeMs: Date.now() - streamStartTime,
        stdout: accumulatedText || '',
        stderr: '',
        ok: code === 0 || accumulatedText.length > 0,
        apiKeyStrategy
      });

      const finalResponse: PiAgentResponse = {
        ok: code === 0 || accumulatedText.length > 0,
        text: accumulatedText || 'Agent turn completed.',
        sessionId,
        model: fullModel
      };
      resolve(finalResponse);
    });

    child.on('error', (err) => {
      if (daemon) daemon.status = 'stopped';
      updateHarnessState(tenantId, { status: 'idle' });
      onChunk(`data: ${JSON.stringify({ ok: false, error: err.message })}\n\n`);
      resolve({
        ok: false,
        text: `Error: ${err.message}`,
        sessionId,
        model: fullModel,
        error: err.message
      });
    });
  });
}

function parsePiJsonOutput(stdout: string, sessionId: string, model: string): PiAgentResponse {
  let finalText = '';
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

  // Note: suggestions are no longer extracted from agent text.
  // The agent writes suggestions directly to harness.json via its file write tools.
  // The UI reads them from getHarnessState() after each turn completes.

  return {
    ok: !errorMessage,
    text: finalText || (errorMessage ? `Agent notice: ${errorMessage}` : "Task completed."),
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

// Plan 3.3: Remove a review item by id
export function removeReviewItem(tenantId: string = 'default_user', itemId: string): void {
  const current = getHarnessState(tenantId);
  const filtered = (current.review || []).filter((r: any) => r.id !== itemId);
  updateHarnessState(tenantId, { review: filtered });
}

// Plan 3.3: Set feedback on a review item (marks as 'reviewed')
export function setReviewItemFeedback(tenantId: string = 'default_user', itemId: string, feedback: string): void {
  const current = getHarnessState(tenantId);
  const updated = (current.review || []).map((r: any) =>
    r.id === itemId ? { ...r, type: 'reviewed', feedback } : r
  );
  updateHarnessState(tenantId, { review: updated });
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
  const boardPath = path.join(getTenantRoot(tenantId), 'runtime-board.json');
  try {
    let boardData: any = { tenant_id: tenantId, status: "running", last_active: new Date().toISOString() };
    if (fs.existsSync(boardPath)) {
      boardData = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
    }
    boardData.status = "running";
    boardData.last_active = new Date().toISOString();
    if (!boardData.telemetry) boardData.telemetry = {};
    boardData.telemetry.total_runs = (boardData.telemetry.total_runs || 0) + runIncrement;
    boardData.telemetry.last_active = new Date().toISOString();
    fs.writeFileSync(boardPath, JSON.stringify(boardData, null, 2), 'utf8');
  } catch (_) {}
}
