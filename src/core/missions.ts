import fs from 'fs';
import path from 'path';
import { getTenantRoot, appendTenantAuditLog } from './tenant.js';
import { getWorkspaceArtifactsFromIndex, moveUserFile, deleteUserFile, syncWorkspaceJson } from './workspace.js';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

export interface MissionTask {
  id: string;
  title: string;
  cost?: 'LOW' | 'MEDIUM' | 'HIGH';
  benefit?: 'LOW' | 'MEDIUM' | 'HIGH';
  worth_it?: 'YES' | 'NO' | boolean;
  completed: boolean;
  assigned_agent?: string;
  deliverable_path?: string;
}

export interface MissionBlueprint {
  id: string;
  title: string;
  objective: string;
  type: string;
  status: string;
  phase: string;
  qa_state?: any;
  tasks: MissionTask[];
}

export interface MissionExecutionArtifact {
  id: string;
  status: string;
  phase: string;
  workflow_history: Array<{ timestamp: string; phase: string; status: string }>;
  system_ids: string[];
  input_data_ids: string[];
  metrics: Record<string, any>;
}

export interface MissionSchema {
  type: string;
  title: string;
  protected: boolean;
  version: string;
  supported_phases: string[];
  phase_selection: string;
  storage_paths: Record<string, string>;
  pipeline: {
    stages: string[];
  };
}

export interface MissionsStoreData {
  missions: Mission[];
}

export interface MissionArtifactItem {
  name: string;
  path: string;
  processed: boolean;
  size?: number;
  modified_at?: string;
}

export interface Mission {
  id: string;
  title: string;
  objective: string;
  type: string;
  user_id: string;
  status: 'drafting' | 'planning' | 'in_progress' | 'reviewing' | 'completed' | 'failed';
  phase: 'discovery' | 'blueprint' | 'scaffold' | 'execute' | 'review';
  scratchpad?: string;
  sources?: MissionArtifactItem[];
  deliverables?: MissionArtifactItem[];
  workspace_files?: Array<{ name: string; path: string }>;
  metadata?: {
    tasks?: MissionTask[];
    metrics?: Record<string, any>;
  };
  workflow_history?: Array<{ timestamp: string; phase: string; status: string }>;
  created_at?: string;
  updated_at?: string;
}

// ── Mission Schemas Loader ──────────────────────────────────────────────────────

export function getMissionSchema(missionType: string = 'standard'): MissionSchema {
  const normType = (missionType || 'standard').replace(/^system_/, '').toLowerCase();

  return {
    type: normType,
    title: `${normType.toUpperCase()} Mission Schema`,
    protected: true,
    version: "3.0.0",
    supported_phases: ["discovery", "blueprint", "scaffold", "execute", "review"],
    phase_selection: "multi_or_single",
    storage_paths: {
      scratchpad: "missions/{missionId}/",
      sources: "workspace/Sources/",
      deliverables: "workspace/Deliverables/",
      state_index: "missions.json",
      workspace_index: "workspace.json",
      event_stream: "logs.json"
    },
    pipeline: {
      stages: ["discovery", "blueprint", "scaffold", "execute", "review"]
    }
  };
}

// ── Mission Workspace Directories & Artifact Synchronization ────────────────────

export function scanWorkspaceArtifacts(tenantId: string = 'default_user', existingMission?: Mission) {
  return getWorkspaceArtifactsFromIndex(tenantId, existingMission);
}

export function ensureMissionWorkspaceDirs(tenantId: string, missionType: string, missionId: string) {
  const normType = (missionType || 'standard').replace(/^system_/, '');
  const userRoot = getTenantRoot(tenantId);
  // missions/<mission_id>/ is strictly for runtime agent temp scripts that users do not see
  const baseDir = path.join(userRoot, 'missions', missionId);
  fs.mkdirSync(baseDir, { recursive: true });

  const sourcesDir = path.join(userRoot, 'workspace', 'Sources');
  const deliverablesDir = path.join(userRoot, 'workspace', 'Deliverables');
  fs.mkdirSync(sourcesDir, { recursive: true });
  fs.mkdirSync(deliverablesDir, { recursive: true });

  return { baseDir, sourcesDir, deliverablesDir, normType };
}

export function saveMissionToStore(tenantId: string = 'default_user', mission: Mission) {
  const userRoot = getTenantRoot(tenantId);
  const singleMissionsPath = path.join(userRoot, 'missions.json');
  let missions: Mission[] = [];

  if (fs.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(singleMissionsPath, 'utf8'));
      missions = Array.isArray(parsed) ? parsed : (parsed.missions || []);
    } catch (_) {}
  }

  const { sources, deliverables } = scanWorkspaceArtifacts(tenantId, mission);
  const updatedMission: Mission = {
    ...mission,
    sources,
    deliverables
  };

  const idx = missions.findIndex(m => m.id === mission.id);
  if (idx >= 0) {
    missions[idx] = updatedMission;
  } else {
    missions.push(updatedMission);
  }

  const missionsDir = path.join(userRoot, 'missions');
  const mTempDir = path.join(missionsDir, mission.id);
  if (!fs.existsSync(mTempDir)) {
    fs.mkdirSync(mTempDir, { recursive: true });
  }

  fs.writeFileSync(singleMissionsPath, JSON.stringify({ missions }, null, 2), 'utf8');
}

export function syncMissionWorkspaceArtifacts(mission: Partial<Mission> & { id: string }) {
  if (!mission || !mission.id) return null;
  const tenantId = mission.user_id || 'default_user';
  const mType = mission.type || 'standard';
  const { baseDir, sourcesDir, deliverablesDir } = ensureMissionWorkspaceDirs(tenantId, mType, mission.id);

  try {
    const { sources, deliverables } = scanWorkspaceArtifacts(tenantId, mission as Mission);
    const updatedMission: Mission = {
      ...(mission as Mission),
      sources,
      deliverables
    };
    saveMissionToStore(tenantId, updatedMission);
  } catch (err) {
    console.warn(`[MissionsCore] Failed syncing mission workspace artifacts:`, err);
  }

  return { baseDir, sourcesDir, deliverablesDir };
}

// ── Single missions.json Persistence Store ─────────────────────────────────────

export function syncMissionsJson(tenantId: string = 'default_user'): Mission[] {
  const userRoot = getTenantRoot(tenantId);
  const missionsDir = path.join(userRoot, 'missions');
  const singleMissionsPath = path.join(userRoot, 'missions.json');

  if (!fs.existsSync(missionsDir)) {
    fs.mkdirSync(missionsDir, { recursive: true });
  }

  let existingMissions: Mission[] = [];

  if (fs.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(singleMissionsPath, 'utf8'));
      existingMissions = Array.isArray(parsed) ? parsed : (parsed.missions || []);
    } catch (_) {}
  }

  // Ensure each existing mission has runtime temp folder in missions/<mission_id>/ and dynamic sources & deliverables
  const updatedMissions = existingMissions.map(m => {
    if (!m || !m.id) return m;
    const mTempDir = path.join(missionsDir, m.id);
    if (!fs.existsSync(mTempDir)) {
      fs.mkdirSync(mTempDir, { recursive: true });
    }
    const { sources, deliverables } = scanWorkspaceArtifacts(tenantId, m);
    return {
      ...m,
      sources,
      deliverables
    };
  });

  fs.writeFileSync(
    singleMissionsPath,
    JSON.stringify({ missions: updatedMissions }, null, 2),
    'utf8'
  );

  return updatedMissions;
}

export const syncMissionsDb = syncMissionsJson;

export function getMissionsData(tenantId: string = 'default_user'): MissionsStoreData {
  const userRoot = getTenantRoot(tenantId);
  const singleMissionsPath = path.join(userRoot, 'missions.json');
  syncMissionsJson(tenantId);

  if (fs.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(singleMissionsPath, 'utf8'));
      return {
        missions: Array.isArray(parsed.missions) ? parsed.missions : []
      };
    } catch (_) {}
  }
  return { missions: [] };
}

// ── Missions CRUD Helpers ─────────────────────────────────────────────────────

export function getMissions(tenantId: string = 'default_user'): Mission[] {
  return syncMissionsJson(tenantId);
}

export function createMission(
  tenantId: string = 'default_user',
  missionData: { title: string; objective: string; type?: string }
): Mission {
  const id = `msn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newMission: Mission = {
    id,
    title: missionData.title,
    objective: missionData.objective,
    type: missionData.type || 'standard',
    user_id: tenantId,
    status: 'drafting',
    phase: 'discovery',
    scratchpad: `missions/${id}/`,
    metadata: { tasks: [] },
    workflow_history: [
      { timestamp: new Date().toISOString(), phase: 'discovery', status: 'created' }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  syncMissionWorkspaceArtifacts(newMission);

  appendTenantAuditLog(tenantId, {
    type: 'mission',
    event: 'Mission Created',
    mission_id: id,
    details: { title: newMission.title, type: newMission.type }
  });

  return newMission;
}

export function updateMission(
  tenantId: string = 'default_user',
  missionId: string,
  updates: Partial<Mission>
): Mission | null {
  const missions = getMissions(tenantId);
  const target = missions.find(m => m.id === missionId);
  if (!target) return null;

  const isMoved = (updates.phase && updates.phase !== target.phase) || (updates.status && updates.status !== target.status);

  const newPhase = updates.phase || target.phase;
  const newStatus = updates.status || target.status;

  // Moving a mission through pipeline stages triggers file moving operations and workspace.json item stage update
  if (isMoved && target.deliverables && target.deliverables.length > 0) {
    let destSubDir = 'workspace/Deliverables/Executions';
    if (newStatus === 'completed' || newPhase === 'review') {
      destSubDir = newStatus === 'completed' ? 'workspace/Deliverables/Completed' : 'workspace/Deliverables/Reviews';
    } else if (newPhase === 'discovery' || newPhase === 'blueprint') {
      destSubDir = 'workspace/Sources/Discovery & Scoping';
    }

    for (const deliv of target.deliverables) {
      if (!deliv.path) continue;
      const fileName = path.basename(deliv.path);
      const destPath = `${destSubDir}/${fileName}`;

      if (deliv.path !== destPath) {
        try {
          moveUserFile(tenantId, deliv.path, destPath);
          deliv.path = destPath;
        } catch (_) {}
      }
    }
  }

  const updated: Mission = {
    ...target,
    ...updates,
    id: missionId,
    updated_at: new Date().toISOString()
  };

  syncMissionWorkspaceArtifacts(updated);
  syncWorkspaceJson(tenantId);

  return updated;
}

export function deleteMission(tenantId: string = 'default_user', missionId: string): boolean {
  const userRoot = getTenantRoot(tenantId);
  const missionDir = path.join(userRoot, 'missions', missionId);
  if (fs.existsSync(missionDir)) {
    fs.rmSync(missionDir, { recursive: true, force: true });
  }

  const missions = getMissions(tenantId);
  const target = missions.find(m => m.id === missionId);

  // Removing a mission triggers file deletion operations and workspace.json item removal
  if (target && target.deliverables) {
    for (const deliv of target.deliverables) {
      if (deliv.path) {
        try {
          deleteUserFile(tenantId, deliv.path);
        } catch (_) {}
      }
    }
  }

  const filteredMissions = missions.filter(m => m.id !== missionId);
  const singleMissionsPath = path.join(userRoot, 'missions.json');

  fs.writeFileSync(singleMissionsPath, JSON.stringify({ missions: filteredMissions }, null, 2), 'utf8');
  syncWorkspaceJson(tenantId);
  return true;
}
