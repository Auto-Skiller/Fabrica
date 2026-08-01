import fs from 'fs';
import path from 'path';

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

export function getTenantRoot(tenantId: string = 'default_user'): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const userRoot = path.resolve(process.cwd(), 'workspaces', safeTenant);
  if (!fs.existsSync(userRoot)) {
    fs.mkdirSync(userRoot, { recursive: true });
  }
  return userRoot;
}

export function resolveTenantPath(tenantId: string = 'default_user', targetPath: string = ''): string {
  const userRoot = getTenantRoot(tenantId);
  const resolved = path.resolve(userRoot, targetPath);
  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Path traversal attempt blocked outside tenant workspace boundary (${userRoot}).`);
  }
  return resolved;
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
  const profilePath = path.join(root, 'tenant.json');
  const settingsPath = path.join(root, 'settings.json');

  let settings: Record<string, any> = {};
  if (fs.existsSync(settingsPath)) {
    try {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    } catch (_) {}
  }

  if (fs.existsSync(profilePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
      return {
        tenantId,
        name: parsed.name || `Tenant ${tenantId}`,
        email: parsed.email,
        plan: parsed.plan || settings.subscription?.plan || 'Professional',
        createdAt: parsed.createdAt || new Date().toISOString(),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        settings: { ...settings, ...(parsed.settings || {}) }
      };
    } catch (_) {}
  }

  const defaultProfile: TenantProfile = {
    tenantId,
    name: tenantId === 'default_user' ? 'Default Workspace' : `Tenant (${tenantId})`,
    plan: settings.subscription?.plan || 'Professional',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings
  };

  try {
    fs.writeFileSync(profilePath, JSON.stringify(defaultProfile, null, 2), 'utf8');
  } catch (_) {}

  return defaultProfile;
}

export function updateTenantProfile(tenantId: string = 'default_user', updates: Partial<TenantProfile>): TenantProfile {
  const current = getTenantProfile(tenantId);
  const updated: TenantProfile = {
    ...current,
    ...updates,
    tenantId,
    updatedAt: new Date().toISOString()
  };

  const root = getTenantRoot(tenantId);
  const profilePath = path.join(root, 'tenant.json');
  fs.writeFileSync(profilePath, JSON.stringify(updated, null, 2), 'utf8');
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

  return {
    tenantId,
    cpuUsagePercent: Math.min(100, Math.round(Math.random() * 15 + 5)),
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
  const logsPath = path.join(root, 'logs.json');

  if (!fs.existsSync(logsPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch (_) {
    return [];
  }
}

export function appendTenantAuditLog(
  tenantId: string = 'default_user',
  event: Omit<AuditLogEvent, 'id' | 'timestamp'>
): AuditLogEvent {
  const root = getTenantRoot(tenantId);
  const logsPath = path.join(root, 'logs.json');

  let logsData: { events: AuditLogEvent[]; last_event_at: string } = {
    events: [],
    last_event_at: new Date().toISOString()
  };

  if (fs.existsSync(logsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        logsData = parsed;
      }
    } catch (_) {}
  }

  if (!Array.isArray(logsData.events)) {
    logsData.events = [];
  }

  const newEntry: AuditLogEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...event
  };

  logsData.events.unshift(newEntry);
  if (logsData.events.length > 1000) {
    logsData.events = logsData.events.slice(0, 1000);
  }
  logsData.last_event_at = newEntry.timestamp;

  try {
    fs.writeFileSync(logsPath, JSON.stringify(logsData, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[TenantCore] Error appending audit log for ${tenantId}:`, err);
  }

  return newEntry;
}
