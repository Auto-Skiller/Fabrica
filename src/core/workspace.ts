import fs from 'fs';
import path from 'path';
import { getTenantRoot, appendTenantAuditLog } from './tenant.js';
import { ensureUserHarness } from './harness.js';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

export interface UserFileItem {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

export interface WorkspaceSourceItem {
  name: string;
  path: string;
  size: number;
  modified_at: string;
}

export interface WorkspaceDeliverableItem {
  name: string;
  path: string;
  size: number;
  modified_at: string;
}

export interface WorkspaceMap {
  sources: {
    discovery_and_scoping: WorkspaceSourceItem[];
    deep_research: WorkspaceSourceItem[];
    data_analysis: WorkspaceSourceItem[];
    strategic_synthesis: WorkspaceSourceItem[];
    all: WorkspaceSourceItem[];
  };
  deliverables: {
    executions: WorkspaceDeliverableItem[];
    reviews: WorkspaceDeliverableItem[];
    completed: WorkspaceDeliverableItem[];
    all: WorkspaceDeliverableItem[];
  };
  updated_at: string;
}

export interface StorageObject {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  updated: string;
  metadata?: Record<string, string>;
}

export interface SyncResult {
  tenantId: string;
  syncedFilesCount: number;
  newGapsFilled: number;
  timestamp: string;
}

// ── Single workspace.json Index Mapping Engine ─────────────────────────────────

export function syncWorkspaceJson(tenantId: string = 'default_user'): WorkspaceMap | null {
  const userRoot = getTenantRoot(tenantId);
  const workspaceJsonPath = path.join(userRoot, 'workspace.json');
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

  const scanDir = (dir: string): any[] => {
    if (!fs.existsSync(dir)) return [];
    const results: any[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(userRoot, fullPath);
        if (entry.isDirectory()) {
          results.push(...scanDir(fullPath));
        } else {
          let size = 0;
          let modifiedAt = new Date().toISOString();
          try {
            const st = fs.statSync(fullPath);
            size = st.size;
            modifiedAt = st.mtime.toISOString();
          } catch (_) {}
          results.push({
            name: entry.name,
            path: relPath,
            size,
            modified_at: modifiedAt
          });
        }
      }
    } catch (_) {}
    return results;
  };

  const workspaceMap: WorkspaceMap = {
    sources: {
      discovery_and_scoping: scanDir(path.join(sourcesDir, 'Discovery & Scoping')),
      deep_research: scanDir(path.join(sourcesDir, 'Deep Research & Intelligence Gathering')),
      data_analysis: scanDir(path.join(sourcesDir, 'Data Analysis & Pattern Extraction')),
      strategic_synthesis: scanDir(path.join(sourcesDir, 'Strategic Synthesis & Decision Support')),
      all: scanDir(sourcesDir)
    },
    deliverables: {
      executions: scanDir(path.join(deliverablesDir, 'Executions')),
      reviews: scanDir(path.join(deliverablesDir, 'Reviews')),
      completed: scanDir(path.join(deliverablesDir, 'Completed')),
      all: scanDir(deliverablesDir)
    },
    updated_at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(workspaceJsonPath, JSON.stringify(workspaceMap, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[WorkspaceCore] Failed writing workspace.json for ${tenantId}:`, err);
  }

  return workspaceMap;
}

export function getWorkspaceMap(tenantId: string = 'default_user'): WorkspaceMap {
  const userRoot = getTenantRoot(tenantId);
  const workspaceJsonPath = path.join(userRoot, 'workspace.json');
  if (fs.existsSync(workspaceJsonPath)) {
    try {
      return JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
    } catch (_) {}
  }
  return syncWorkspaceJson(tenantId)!;
}

// ── Cloud / GCS Storage Engine & Hybrid Sync ───────────────────────────────────

export function listCloudStorageObjects(tenantId: string = 'default_user', folderPrefix: string = ''): StorageObject[] {
  const map = getWorkspaceMap(tenantId);
  const allFiles = [...map.sources.all, ...map.deliverables.all];

  return allFiles
    .filter(f => !folderPrefix || f.path.startsWith(folderPrefix))
    .map(f => ({
      name: f.name,
      bucket: `fabrica-tenant-${tenantId}`,
      size: f.size,
      contentType: f.name.endsWith('.json') ? 'application/json' : f.name.endsWith('.md') ? 'text/markdown' : 'text/plain',
      updated: f.modified_at
    }));
}

export function syncTenantWorkspace(tenantId: string = 'default_user'): SyncResult {
  const map = syncWorkspaceJson(tenantId);
  const syncedFilesCount = map ? (map.sources.all.length + map.deliverables.all.length) : 0;

  appendTenantAuditLog(tenantId, {
    type: 'system',
    event: 'Workspace Synced',
    details: { syncedFilesCount }
  });

  return {
    tenantId,
    syncedFilesCount,
    newGapsFilled: 0,
    timestamp: new Date().toISOString()
  };
}

// Daemon gap detection helper
export function detectFillGaps(tenantId: string = 'default_user'): { gapsFound: number; fixed: boolean } {
  syncWorkspaceJson(tenantId);
  return { gapsFound: 0, fixed: true };
}

// ── Filesystem Storage & Explorer Engine ──────────────────────────────────────

export function resolveUserPath(tenantId: string, relativePath: string = ''): string {
  const userRoot = getTenantRoot(tenantId);
  const resolved = path.resolve(userRoot, relativePath);

  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Access denied outside tenant workspace boundary (${userRoot}).`);
  }
  return resolved;
}

export function listUserFiles(tenantId: string = 'default_user', subDir: string = ''): UserFileItem[] {
  ensureUserHarness(tenantId);
  const targetDir = resolveUserPath(tenantId, subDir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) return [];

  const userRoot = getTenantRoot(tenantId);
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });

  return entries.map(entry => {
    const fullPath = path.join(targetDir, entry.name);
    const relPath = path.relative(userRoot, fullPath);
    let size = 0;
    let updatedAt = new Date().toISOString();
    try {
      const stats = fs.statSync(fullPath);
      size = stats.size;
      updatedAt = stats.mtime.toISOString();
    } catch (_) {}

    return {
      name: entry.name,
      relativePath: relPath,
      isDirectory: entry.isDirectory(),
      size,
      updatedAt
    };
  });
}

export function readUserFile(tenantId: string, relativePath: string): { content: string; path: string; size: number } {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    throw new Error(`File not found or is a directory: ${relativePath}`);
  }
  const content = fs.readFileSync(targetPath, 'utf8');
  const userRoot = getTenantRoot(tenantId);
  return {
    content,
    path: path.relative(userRoot, targetPath),
    size: Buffer.byteLength(content, 'utf8')
  };
}

export function writeUserFile(tenantId: string, relativePath: string, content: string): { path: string; size: number } {
  const targetPath = resolveUserPath(tenantId, relativePath);
  const parentDir = path.dirname(targetPath);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');

  const userRoot = getTenantRoot(tenantId);
  const normPath = path.relative(userRoot, targetPath);

  appendTenantAuditLog(tenantId, {
    type: 'user',
    event: 'File Written',
    details: { path: normPath, size: Buffer.byteLength(content, 'utf8') }
  });

  return {
    path: normPath,
    size: Buffer.byteLength(content, 'utf8')
  };
}

export function moveUserFile(tenantId: string, srcRelativePath: string, destRelativePath: string): { src: string; dest: string; size: number } {
  const srcPath = resolveUserPath(tenantId, srcRelativePath);
  const destPath = resolveUserPath(tenantId, destRelativePath);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source file or folder does not exist: ${srcRelativePath}`);
  }

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.renameSync(srcPath, destPath);

  const userRoot = getTenantRoot(tenantId);
  const normSrc = path.relative(userRoot, srcPath);
  const normDest = path.relative(userRoot, destPath);

  let size = 0;
  try { size = fs.statSync(destPath).size; } catch (_) {}

  return { src: normSrc, dest: normDest, size };
}

export function deleteUserFile(tenantId: string, relativePath: string): boolean {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!fs.existsSync(targetPath)) return false;

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
  return true;
}

