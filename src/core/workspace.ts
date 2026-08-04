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

export interface WorkspaceItemLevel {
  maturity: 'draft' | 'beta' | 'production' | string;
  readability: 'low' | 'medium' | 'high' | string;
}

export interface WorkspaceItem {
  id?: string;
  name: string;
  path: string;
  isDirectory: boolean;
  type: string;
  level: WorkspaceItemLevel;
  description: string;
  when_to_use: string;
  triggers: string[];
  size: number;
  modified_at: string;
  created_at?: string;
  flagged_as_action?: boolean;
}

export type WorkspaceSourceItem = WorkspaceItem;
export type WorkspaceDeliverableItem = WorkspaceItem;

export interface WorkspaceMap {
  discovery_and_scoping: WorkspaceSourceItem[];
  deep_research: WorkspaceSourceItem[];
  data_analysis: WorkspaceSourceItem[];
  strategic_synthesis: WorkspaceSourceItem[];
  executions: WorkspaceDeliverableItem[];
  reviews: WorkspaceDeliverableItem[];
  completed: WorkspaceDeliverableItem[];
  all?: WorkspaceItem[];
  sources?: {
    discovery_and_scoping: WorkspaceSourceItem[];
    deep_research: WorkspaceSourceItem[];
    data_analysis: WorkspaceSourceItem[];
    strategic_synthesis: WorkspaceSourceItem[];
    all: WorkspaceSourceItem[];
  };
  deliverables?: {
    executions: WorkspaceDeliverableItem[];
    reviews: WorkspaceDeliverableItem[];
    completed: WorkspaceDeliverableItem[];
    all: WorkspaceDeliverableItem[];
  };
  action_items: WorkspaceItem[];
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

  const workspaceFolders = [
    'Discovery & Scoping',
    'Deep Research & Intelligence Gathering',
    'Data Analysis & Pattern Extraction',
    'Strategic Synthesis & Decision Support',
    'Executions',
    'Reviews',
    'Completed'
  ];

  for (const folder of workspaceFolders) {
    fs.mkdirSync(path.join(workspaceDir, folder), { recursive: true });
  }

  const existingMetadataMap = new Map<string, Partial<WorkspaceItem>>();
  let existingActionItems: WorkspaceItem[] = [];

  if (fs.existsSync(workspaceJsonPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(workspaceJsonPath, 'utf8'));
      existingActionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];

      const collectMetadata = (list: any[]) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (item && item.path) {
            existingMetadataMap.set(item.path, item);
          }
        }
      };

      collectMetadata(parsed.discovery_and_scoping);
      collectMetadata(parsed.deep_research);
      collectMetadata(parsed.data_analysis);
      collectMetadata(parsed.strategic_synthesis);
      collectMetadata(parsed.executions);
      collectMetadata(parsed.reviews);
      collectMetadata(parsed.completed);
      collectMetadata(parsed.all);
      if (parsed.sources) {
        collectMetadata(parsed.sources.all);
      }
      if (parsed.deliverables) {
        collectMetadata(parsed.deliverables.all);
      }
      collectMetadata(existingActionItems);
    } catch (_) {}
  }

  const scanDir = (dir: string): WorkspaceItem[] => {
    if (!fs.existsSync(dir)) return [];
    const results: WorkspaceItem[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(userRoot, fullPath);
        const isDir = entry.isDirectory();

        let size = 0;
        let modifiedAt = new Date().toISOString();
        try {
          const st = fs.statSync(fullPath);
          size = st.size;
          modifiedAt = st.mtime.toISOString();
        } catch (_) {}

        const existing = existingMetadataMap.get(relPath);

        const defaultType = isDir
          ? 'directory'
          : relPath.startsWith('workspace/Executions') || relPath.startsWith('workspace/Reviews') || relPath.startsWith('workspace/Completed')
          ? 'deliverable'
          : 'source';

        const item: WorkspaceItem = {
          name: entry.name,
          path: relPath,
          isDirectory: isDir,
          type: existing?.type || defaultType,
          level: existing?.level || { maturity: 'production', readability: 'high' },
          description: existing?.description || `Workspace ${isDir ? 'directory' : 'file'}: ${entry.name}`,
          when_to_use: existing?.when_to_use || `Referenced when processing ${entry.name} in mission or workspace tasks`,
          triggers: existing?.triggers || [entry.name, isDir ? 'folder' : 'file'],
          size,
          modified_at: modifiedAt,
          flagged_as_action: existing?.flagged_as_action || false
        };

        results.push(item);

        if (isDir) {
          results.push(...scanDir(fullPath));
        }
      }
    } catch (_) {}
    return results;
  };

  const discovery_and_scoping = scanDir(path.join(workspaceDir, 'Discovery & Scoping'));
  const deep_research = scanDir(path.join(workspaceDir, 'Deep Research & Intelligence Gathering'));
  const data_analysis = scanDir(path.join(workspaceDir, 'Data Analysis & Pattern Extraction'));
  const strategic_synthesis = scanDir(path.join(workspaceDir, 'Strategic Synthesis & Decision Support'));
  const executions = scanDir(path.join(workspaceDir, 'Executions'));
  const reviews = scanDir(path.join(workspaceDir, 'Reviews'));
  const completed = scanDir(path.join(workspaceDir, 'Completed'));
  const allWorkspaceItems = scanDir(workspaceDir);

  const allScannedItems = allWorkspaceItems;
  const flaggedItems = allScannedItems.filter(item => item.flagged_as_action);
  const actionItemsMap = new Map<string, WorkspaceItem>();

  for (const item of existingActionItems) {
    if (item && item.path) {
      const scanned = allScannedItems.find(s => s.path === item.path);
      actionItemsMap.set(item.path, scanned || item);
    }
  }
  for (const item of flaggedItems) {
    actionItemsMap.set(item.path, item);
  }

  const workspaceMap: WorkspaceMap = {
    discovery_and_scoping,
    deep_research,
    data_analysis,
    strategic_synthesis,
    executions,
    reviews,
    completed,
    all: allWorkspaceItems,
    sources: {
      discovery_and_scoping,
      deep_research,
      data_analysis,
      strategic_synthesis,
      all: [...discovery_and_scoping, ...deep_research, ...data_analysis, ...strategic_synthesis]
    },
    deliverables: {
      executions,
      reviews,
      completed,
      all: [...executions, ...reviews, ...completed]
    },
    action_items: Array.from(actionItemsMap.values()),
    updated_at: new Date().toISOString()
  };

  try {
    fs.writeFileSync(workspaceJsonPath, JSON.stringify(workspaceMap, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[WorkspaceCore] Failed writing workspace.json for ${tenantId}:`, err);
  }

  return workspaceMap;
}

export function flagWorkspaceAction(tenantId: string = 'default_user', pathOrItem: string | WorkspaceItem) {
  const userRoot = getTenantRoot(tenantId);
  const workspaceJsonPath = path.join(userRoot, 'workspace.json');
  let map = getWorkspaceMap(tenantId);
  if (!map.action_items) map.action_items = [];

  let targetItem: WorkspaceItem;
  if (typeof pathOrItem === 'string') {
    const filename = path.basename(pathOrItem);
    targetItem = {
      name: filename,
      path: pathOrItem,
      isDirectory: false,
      type: 'action',
      level: { maturity: 'production', readability: 'high' },
      description: `Item flagged as action: ${filename}`,
      when_to_use: `Requires explicit execution action for ${filename}`,
      triggers: [filename, 'action'],
      size: 0,
      modified_at: new Date().toISOString(),
      flagged_as_action: true
    };
  } else {
    targetItem = {
      ...pathOrItem,
      type: pathOrItem.type || 'action',
      level: pathOrItem.level || { maturity: 'production', readability: 'high' },
      description: pathOrItem.description || `Item flagged as action: ${pathOrItem.name}`,
      when_to_use: pathOrItem.when_to_use || `Requires explicit execution action for ${pathOrItem.name}`,
      triggers: pathOrItem.triggers || [pathOrItem.name, 'action'],
      flagged_as_action: true
    };
  }

  const existingIdx = map.action_items.findIndex(a => a.path === targetItem.path);
  if (existingIdx >= 0) {
    map.action_items[existingIdx] = targetItem;
  } else {
    map.action_items.push(targetItem);
  }

  try {
    fs.writeFileSync(workspaceJsonPath, JSON.stringify(map, null, 2), 'utf8');
  } catch (_) {}
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

export function listWorkspaceItemsFromJson(tenantId: string = 'default_user', subDir: string = ''): WorkspaceItem[] {
  // Sanitize path against directory traversal
  let targetPath = subDir.trim();
  if (targetPath.includes('..')) {
    throw new Error('Security Violation: Path traversal attempt blocked.');
  }

  if (targetPath) {
    resolveUserPath(tenantId, targetPath);
  }

  const map = getWorkspaceMap(tenantId);
  const pathMap = new Map<string, WorkspaceItem>();

  const addItems = (list?: WorkspaceItem[]) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && item.path && !pathMap.has(item.path)) {
        pathMap.set(item.path, item);
      }
    }
  };

  addItems(map.discovery_and_scoping);
  addItems(map.deep_research);
  addItems(map.data_analysis);
  addItems(map.strategic_synthesis);
  addItems(map.executions);
  addItems(map.reviews);
  addItems(map.completed);
  addItems(map.all);
  if (map.sources) addItems(map.sources.all);
  if (map.deliverables) addItems(map.deliverables.all);
  addItems(map.action_items);

  const items = Array.from(pathMap.values());

  if (!targetPath || targetPath === 'workspace' || targetPath === '/') {
    return items;
  }

  const normSubDir = targetPath.replace(/\\/g, '/').replace(/\/$/, '');

  return items.filter(item => {
    const normItemPath = item.path.replace(/\\/g, '/');
    return normItemPath === normSubDir || normItemPath.startsWith(normSubDir + '/');
  });
}

export function createWorkspaceItem(
  tenantId: string = 'default_user',
  params: {
    path: string;
    content?: string;
    type?: string;
    level?: WorkspaceItemLevel;
    description?: string;
    when_to_use?: string;
    triggers?: string[];
    isImport?: boolean;
    flagged_as_action?: boolean;
  }
): { path: string; size: number; item: WorkspaceItem } {
  const { path: relPath, content = '', type, level, description, when_to_use, triggers, isImport = false, flagged_as_action = false } = params;

  const writeRes = writeUserFile(tenantId, relPath, content, isImport);

  const filename = path.basename(relPath);

  const isDeliverable = relPath.startsWith('workspace/Executions') || relPath.startsWith('workspace/Reviews') || relPath.startsWith('workspace/Completed');

  const item: WorkspaceItem = {
    name: filename,
    path: relPath,
    isDirectory: false,
    type: type || (isImport ? 'imported' : isDeliverable ? 'deliverable' : 'source'),
    level: level || { maturity: isImport ? 'draft' : 'production', readability: 'high' },
    description: description || `Workspace file: ${filename}`,
    when_to_use: when_to_use || `Referenced when processing ${filename} in mission or workspace tasks`,
    triggers: triggers || [filename, isImport ? 'import' : 'file'],
    size: writeRes.size,
    modified_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    flagged_as_action
  };

  if (flagged_as_action) {
    flagWorkspaceAction(tenantId, item);
  } else {
    syncWorkspaceJson(tenantId);
  }

  return {
    path: writeRes.path,
    size: writeRes.size,
    item
  };
}

export function getWorkspaceArtifactsFromIndex(
  tenantId: string = 'default_user',
  existingMission?: { sources?: Array<{ path: string; processed: boolean }>; deliverables?: Array<{ path: string; processed: boolean }> }
) {
  const map = getWorkspaceMap(tenantId);
  const processedMap = new Map<string, boolean>();
  if (existingMission) {
    (existingMission.sources || []).forEach(s => processedMap.set(s.path, s.processed));
    (existingMission.deliverables || []).forEach(d => processedMap.set(d.path, d.processed));
  }

  const allSourcesList = [
    ...(map.discovery_and_scoping || []),
    ...(map.deep_research || []),
    ...(map.data_analysis || []),
    ...(map.strategic_synthesis || []),
    ...(map.sources?.all || [])
  ];
  const sourceItemsMap = new Map<string, WorkspaceItem>();
  allSourcesList.forEach(item => { if (item?.path) sourceItemsMap.set(item.path, item); });

  const allDeliverablesList = [
    ...(map.executions || []),
    ...(map.reviews || []),
    ...(map.completed || []),
    ...(map.deliverables?.all || [])
  ];
  const deliverableItemsMap = new Map<string, WorkspaceItem>();
  allDeliverablesList.forEach(item => { if (item?.path) deliverableItemsMap.set(item.path, item); });

  const sources = Array.from(sourceItemsMap.values()).map(item => ({
    name: item.name,
    path: item.path,
    isDirectory: item.isDirectory,
    type: item.type,
    level: item.level,
    description: item.description,
    when_to_use: item.when_to_use,
    triggers: item.triggers,
    processed: processedMap.get(item.path) || false,
    size: item.size,
    modified_at: item.modified_at
  }));

  const deliverables = Array.from(deliverableItemsMap.values()).map(item => ({
    name: item.name,
    path: item.path,
    isDirectory: item.isDirectory,
    type: item.type,
    level: item.level,
    description: item.description,
    when_to_use: item.when_to_use,
    triggers: item.triggers,
    processed: processedMap.get(item.path) || false,
    size: item.size,
    modified_at: item.modified_at
  }));

  return { sources, deliverables };
}

// ── Cloud / GCS Storage Engine & Hybrid Sync ───────────────────────────────────

export function listCloudStorageObjects(tenantId: string = 'default_user', folderPrefix: string = ''): StorageObject[] {
  const map = getWorkspaceMap(tenantId);
  const allFiles = map.all || [
    ...(map.discovery_and_scoping || []),
    ...(map.deep_research || []),
    ...(map.data_analysis || []),
    ...(map.strategic_synthesis || []),
    ...(map.executions || []),
    ...(map.reviews || []),
    ...(map.completed || [])
  ];

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
  const syncedFilesCount = map ? (map.all?.length || 0) : 0;

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

const PROTECTED_SECURITY_FILES = ['keys.json', 'auth.json', 'key_pools.json', '.env', '.env.local', '.env.production', 'secrets.json'];

export function isProtectedSecurityPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/').toLowerCase();
  const baseName = path.basename(norm);
  return (
    PROTECTED_SECURITY_FILES.includes(baseName) ||
    norm.includes('.stash') ||
    norm.includes('/.stash/') ||
    baseName.startsWith('.env')
  );
}

export function resolveUserPath(tenantId: string, relativePath: string = ''): string {
  const userRoot = getTenantRoot(tenantId);
  const resolved = path.resolve(userRoot, relativePath);

  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Access denied outside tenant workspace boundary (${userRoot}).`);
  }

  const relFromRoot = path.relative(userRoot, resolved);
  if (isProtectedSecurityPath(relFromRoot)) {
    throw new Error(`Security Violation: Access denied to protected server security/key store file (${path.basename(resolved)}). Server keys and key pools are strictly isolated.`);
  }

  return resolved;
}

export function listUserFiles(tenantId: string = 'default_user', subDir: string = ''): UserFileItem[] {
  ensureUserHarness(tenantId);
  const targetDir = resolveUserPath(tenantId, subDir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) return [];

  const userRoot = getTenantRoot(tenantId);
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });

  return entries
    .filter(entry => {
      const relPath = path.relative(userRoot, path.join(targetDir, entry.name));
      return !isProtectedSecurityPath(relPath) && !entry.name.startsWith('.');
    })
    .map(entry => {
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

export function writeUserFile(
  tenantId: string,
  relativePath: string,
  content: string,
  isImport: boolean = false,
  options?: {
    type?: string;
    level?: WorkspaceItemLevel;
    description?: string;
    when_to_use?: string;
    triggers?: string[];
    flagged_as_action?: boolean;
  }
): { path: string; size: number } {
  const targetPath = resolveUserPath(tenantId, relativePath);
  const parentDir = path.dirname(targetPath);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');

  const userRoot = getTenantRoot(tenantId);
  const normPath = path.relative(userRoot, targetPath);
  const size = Buffer.byteLength(content, 'utf8');
  const filename = path.basename(normPath);

  const isDeliverable = normPath.startsWith('workspace/Executions') || normPath.startsWith('workspace/Reviews') || normPath.startsWith('workspace/Completed');
  const itemType = options?.type || (isImport ? 'imported' : isDeliverable ? 'deliverable' : 'source');
  const itemLevel = options?.level || { maturity: isImport ? 'draft' : 'production', readability: 'high' };
  const itemDesc = options?.description || `Workspace file: ${filename}`;
  const itemWhen = options?.when_to_use || `Referenced when processing ${filename} in mission or workspace tasks`;
  const itemTriggers = options?.triggers || [filename, 'file'];
  const isAction = options?.flagged_as_action || false;

  if (isAction) {
    flagWorkspaceAction(tenantId, {
      name: filename,
      path: normPath,
      isDirectory: false,
      type: itemType,
      level: itemLevel,
      description: itemDesc,
      when_to_use: itemWhen,
      triggers: itemTriggers,
      size,
      modified_at: new Date().toISOString(),
      flagged_as_action: true
    });
  }

  appendTenantAuditLog(tenantId, {
    type: 'user',
    event: 'File Written',
    details: { path: normPath, size }
  });

  return {
    path: normPath,
    size
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

  const userRoot = getTenantRoot(tenantId);
  const normPath = path.relative(userRoot, targetPath);

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }

  return true;
}

