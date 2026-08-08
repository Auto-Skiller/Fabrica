import fs from 'fs';
import path from 'path';
import { ensureUserHarness } from './harness.js';
import { getOrCreateTenantRunnerUrl, proxyTurnToRunner } from '../services/cloudrun.orchestrator.js';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

export interface AppConfig {
  id: string;
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: Record<string, boolean>;
  metadata?: Record<string, any>;
}

export interface RuntimeState {
  tenantId: string;
  status: 'initializing' | 'running' | 'paused' | 'stopped';
  activeSessionsCount: number;
  lastActiveAt: string;
  suggestions: any[];
  backlogs: any[];
  reviewQueues: any[];
  recentEvents: any[];
}

export interface RawData {
  id: string;
  source: string;
  payload: any;
  createdAt: string;
}

export interface Artifact {
  id: string;
  name: string;
  type: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category?: string;
}

export interface TenantProfile {
  tenantId: string;
  name: string;
  email?: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
  settings: Record<string, any>;
  integrations_config?: Record<string, any>;
}

export interface TenantTelemetry {
  tenantId: string;
  cpuUsagePercent: number;
  memoryUsageMb: number;
  activeDaemonsCount: number;
  totalMissionsCount: number;
  totalStorageBytes: number;
  uptimeSeconds: number;
  timestamp: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  type: 'system' | 'mission' | 'audit' | 'source' | 'deliverable' | 'user';
  event: string;
  mission_id?: string | null;
  details?: any;
}

// ── Tenant Workspace Root Helper ───────────────────────────────────────────────

export function getTenantRoot(_tenantId?: string): string {
  const userRoot = '/mnt';
  if (!fs.existsSync(userRoot)) {
    try {
      fs.mkdirSync(userRoot, { recursive: true });
    } catch (_) {}
  }
  return userRoot;
}

export function resolveTenantPath(tenantId: string, targetPath: string = ''): string {
  const userRoot = getTenantRoot(tenantId);
  const resolved = path.resolve(userRoot, targetPath);
  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Path traversal attempt blocked outside tenant workspace boundary (${userRoot}).`);
  }
  return resolved;
}

export function isTenantInitialized(tenantId: string): boolean {
  const userRoot = getTenantRoot(tenantId);
  const runtimeBoardPath = path.join(userRoot, 'runtime-board.json');
  if (!fs.existsSync(userRoot) || !fs.existsSync(runtimeBoardPath)) {
    return false;
  }
  try {
    const data = JSON.parse(fs.readFileSync(runtimeBoardPath, 'utf8'));
    return Boolean(data.is_initialized);
  } catch (_) {
    return false;
  }
}

export function ensureTenantFilesAndFolders(tenantId: string): string {
  const userRoot = getTenantRoot(tenantId);
  fs.mkdirSync(userRoot, { recursive: true });

  const runtimeBoardPath = path.join(userRoot, 'runtime-board.json');
  if (!fs.existsSync(runtimeBoardPath)) {
    fs.writeFileSync(runtimeBoardPath, JSON.stringify({
      tenant_id: tenantId,
      name: `Tenant (${tenantId})`,
      plan: "Professional",
      status: "idle",
      selected_model: "gemini-3.6-flash",
      autonomy: "director",
      autonomy_interval: 20,
      agent_lang: "EN",
      output_language: "EN",
      web_search_enabled: true,
      suggestions: [],
      suggestion_cards: [],
      backlogs: [],
      backlog: [],
      review_queues: [],
      review: [],
      new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] },
      settings: { language: "EN", internet_access: true },
      subscription: { plan: "Professional", active: true },
      telemetry: { total_runs: 0, last_active: new Date().toISOString() },
      logs: [
        {
          id: `evt-init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "system",
          event: "Workspace Initialized",
          details: "Unified audit event stream initialized in runtime-board.json."
        }
      ],
      last_active: new Date().toISOString()
    }, null, 2), 'utf8');
  }

  const missionsGraphPath = path.join(userRoot, 'missions-graph.json');
  if (!fs.existsSync(missionsGraphPath)) {
    fs.writeFileSync(missionsGraphPath, JSON.stringify({ missions: [], last_updated: new Date().toISOString() }, null, 2), 'utf8');
  }

  const workspaceGraphPath = path.join(userRoot, 'workspace-graph.json');
  if (!fs.existsSync(workspaceGraphPath)) {
    fs.writeFileSync(workspaceGraphPath, JSON.stringify({
      sources: {},
      deliverables: {},
      last_synced_at: new Date().toISOString()
    }, null, 2), 'utf8');
  }

  const agentsMdPath = path.join(userRoot, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath)) {
    fs.writeFileSync(agentsMdPath, '', 'utf8');
  }

  const piDir = path.join(userRoot, '.pi');
  fs.mkdirSync(path.join(piDir, 'skills'), { recursive: true });
  fs.mkdirSync(path.join(piDir, 'extensions'), { recursive: true });

  const workspaceDir = path.join(userRoot, 'workspace');
  const workspaceDirs = [
    'Discovery & Scoping',
    'Deep Research & Intelligence Gathering',
    'Data Analysis & Pattern Extraction',
    'Strategic Synthesis & Decision Support',
    'Executions',
    'Reviews',
    'Completed'
  ];

  for (const d of workspaceDirs) {
    fs.mkdirSync(path.join(workspaceDir, d), { recursive: true });
  }

  const missionsDir = path.join(userRoot, 'missions');
  fs.mkdirSync(missionsDir, { recursive: true });

  return userRoot;
}

export function initializeUserTenant(tenantId: string = 'default_user'): { ok: boolean; userRoot: string; piDir: string } {
  // Step 1: tenant.ts creates the user directory and initial files/folders
  const userRoot = ensureTenantFilesAndFolders(tenantId);

  // Step 2: harness.ts triggers the first time harness initialization
  ensureUserHarness(tenantId);

  const piDir = path.join(userRoot, '.pi');

  // Step 3: Mark tenant as initialized, but agent_initialized as false
  updateTenantProfile(tenantId, { is_initialized: true, agent_initialized: false } as any);

  return { ok: true, userRoot, piDir };
}

export function isAgentInitialized(tenantId: string = 'default_user'): boolean {
  const userRoot = getTenantRoot(tenantId);
  const runtimeBoardPath = path.join(userRoot, 'runtime-board.json');

  if (fs.existsSync(runtimeBoardPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(runtimeBoardPath, 'utf8'));
      if (data.agent_initialized !== true) {
        return false;
      }
    } catch (_) {
      return false;
    }
  } else {
    return false;
  }

  const piDir = path.join(userRoot, '.pi');
  if (fs.existsSync(piDir)) {
    const piSkillsDir = path.join(piDir, 'skills');
    const piExtDir = path.join(piDir, 'extensions');
    if (!fs.existsSync(piSkillsDir)) {
      fs.mkdirSync(piSkillsDir, { recursive: true });
    }
    if (!fs.existsSync(piExtDir)) {
      fs.mkdirSync(piExtDir, { recursive: true });
    }
    return true;
  }
  return false;
}

export async function startUserAgent(tenantId: string = 'default_user'): Promise<{ ok: boolean; agentInitialized: boolean; message: string }> {
  const userRoot = getTenantRoot(tenantId);

  try {
    // Trigger agent CLI targeting user tenant directory via dedicated runner container
    const runnerUrl = await getOrCreateTenantRunnerUrl(tenantId);
    if (runnerUrl) {
      await proxyTurnToRunner(runnerUrl, { tenantId, prompt: 'Agent initialization handshake.' });
    }
  } catch (err: any) {
    console.warn('Agent CLI trigger warning:', err?.message || err);
  }

  // Check for .pi/ in userRoot
  const piDir = path.join(userRoot, '.pi');
  if (fs.existsSync(piDir)) {
    // Creates the skills folder
    const piSkillsDir = path.join(piDir, 'skills');
    if (!fs.existsSync(piSkillsDir)) {
      fs.mkdirSync(piSkillsDir, { recursive: true });
    }
    updateTenantProfile(tenantId, { agent_initialized: true } as any);
    return { ok: true, agentInitialized: true, message: 'Agent initialized successfully.' };
  } else {
    updateTenantProfile(tenantId, { agent_initialized: false } as any);
    return { ok: false, agentInitialized: false, message: 'Agent initialization failed: .pi directory not found after agent trigger.' };
  }
}

// ── Database Engine (db.ts Merger) ──────────────────────────────────────────────

export class DatabaseEngine {
  private tenantId: string;

  constructor(tenantId: string = 'default_user') {
    this.tenantId = tenantId;
  }

  public getTenantFile(filename: string): string {
    const root = getTenantRoot(this.tenantId);
    return path.join(root, filename);
  }

  public readJson<T>(filename: string, fallback: T): T {
    const filePath = this.getTenantFile(filename);
    if (!fs.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch (_) {
      return fallback;
    }
  }

  public writeJson<T>(filename: string, data: T): void {
    const filePath = this.getTenantFile(filename);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[DatabaseEngine] Failed to write ${filename} for ${this.tenantId}:`, err);
    }
  }
}

export const dbEngine = new DatabaseEngine('default_user');

// ── Tenant Profile & Settings ──────────────────────────────────────────────────

export function getTenantProfile(tenantId: string = 'default_user'): TenantProfile {
  const root = getTenantRoot(tenantId);
  const boardPath = path.join(root, 'runtime-board.json');

  if (fs.existsSync(boardPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      return {
        tenantId,
        name: parsed.name || (tenantId === 'default_user' ? 'Default Workspace' : `Tenant (${tenantId})`),
        email: parsed.email,
        plan: parsed.plan || parsed.subscription?.plan || 'Professional',
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        settings: parsed.settings || { language: 'EN', internet_access: true }
      };
    } catch (_) {}
  }

  const defaultProfile: TenantProfile = {
    tenantId,
    name: tenantId === 'default_user' ? 'Default Workspace' : `Tenant (${tenantId})`,
    plan: 'Professional',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: { language: 'EN', internet_access: true }
  };

  return defaultProfile;
}

export function updateTenantProfile(tenantId: string = 'default_user', updates: Partial<TenantProfile>): TenantProfile {
  const root = getTenantRoot(tenantId);
  const boardPath = path.join(root, 'runtime-board.json');

  let fullBoardData: any = {};
  if (fs.existsSync(boardPath)) {
    try {
      fullBoardData = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
    } catch (_) {}
  }

  const current = getTenantProfile(tenantId);
  const updated: TenantProfile = {
    ...current,
    ...updates,
    tenantId,
    updatedAt: new Date().toISOString()
  };

  fullBoardData = {
    ...fullBoardData,
    ...updated,
    tenant_id: tenantId,
    updatedAt: updated.updatedAt
  };

  fs.writeFileSync(boardPath, JSON.stringify(fullBoardData, null, 2), 'utf8');
  return updated;
}

// ── Telemetry & System Metrics ────────────────────────────────────────────────

export function getTenantTelemetry(tenantId: string = 'default_user'): TenantTelemetry {
  const root = getTenantRoot(tenantId);
  let totalStorageBytes = 0;

  function calculateSize(dir: string) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          calculateSize(full);
        } else {
          try {
            totalStorageBytes += fs.statSync(full).size;
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  calculateSize(root);

  const cpuUsage = process.cpuUsage();
  const uptime = process.uptime() || 1;
  const cpuUsagePercent = Math.min(100, Math.max(1, Math.round(((cpuUsage.user + cpuUsage.system) / 1000000) / uptime)));

  return {
    tenantId,
    cpuUsagePercent,
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeDaemonsCount: 1,
    totalMissionsCount: 0,
    totalStorageBytes,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  };
}

// ── Audit Logs Engine ──────────────────────────────────────────────────────────

export function getTenantAuditLogs(tenantId: string = 'default_user'): AuditLogEvent[] {
  const root = getTenantRoot(tenantId);
  const boardPath = path.join(root, 'runtime-board.json');

  if (fs.existsSync(boardPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      if (Array.isArray(parsed.logs)) return parsed.logs;
    } catch (_) {}
  }

  return [];
}

export function appendTenantAuditLog(
  tenantId: string = 'default_user',
  event: Omit<AuditLogEvent, 'id' | 'timestamp'>
): AuditLogEvent {
  const root = getTenantRoot(tenantId);
  const boardPath = path.join(root, 'runtime-board.json');

  let fullBoardData: any = { tenant_id: tenantId, logs: [] };

  if (fs.existsSync(boardPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        fullBoardData = parsed;
      }
    } catch (_) {}
  }

  if (!Array.isArray(fullBoardData.logs)) {
    fullBoardData.logs = [];
  }

  const newEntry: AuditLogEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event
  };

  fullBoardData.logs.unshift(newEntry);
  if (fullBoardData.logs.length > 1000) {
    fullBoardData.logs = fullBoardData.logs.slice(0, 1000);
  }
  fullBoardData.last_event_at = newEntry.timestamp;

  try {
    fs.writeFileSync(boardPath, JSON.stringify(fullBoardData, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[TenantCore] Error appending audit log for ${tenantId}:`, err);
  }

  return newEntry;
}
