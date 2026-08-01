import fs from 'fs';
import path from 'path';
import { getTenantRoot, appendTenantAuditLog } from './tenant.js';

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

export interface Mission {
  id: string;
  title: string;
  objective: string;
  type: string;
  user_id: string;
  status: 'drafting' | 'planning' | 'in_progress' | 'reviewing' | 'completed' | 'failed';
  phase: 'discovery' | 'blueprint' | 'scaffold' | 'execute' | 'review';
  scratchpad?: string;
  planning_artifacts?: {
    plan_json?: string | null;
    blueprint_md?: string | null;
  };
  execution_artifacts?: {
    execution_json?: string | null;
    execution_history_md?: string | null;
  };
  workspace_files?: Array<{ name: string; path: string }>;
  metadata?: {
    tasks?: MissionTask[];
    metrics?: Record<string, any>;
  };
  workflow_history?: Array<{ timestamp: string; phase: string; status: string }>;
  created_at?: string;
  updated_at?: string;
}

export interface PipelineJob {
  id: string;
  name: string;
  tenantId: string;
  type: 'sync' | 'simulation' | 'audit' | 'custom' | 'mission_step';
  status: 'queued' | 'running' | 'completed' | 'failed';
  queuedAt: string;
  startedAt?: string;
  endedAt?: string;
  error?: string;
  logs: string[];
  execute: () => Promise<any>;
}

// ── Pipeline Orchestrator Engine ───────────────────────────────────────────────

class PipelineOrchestrator {
  private queue: PipelineJob[] = [];
  private activeWorkers = 0;
  private maxConcurrency = 4;
  private activeJobs = new Map<string, PipelineJob>();
  private completedJobs: PipelineJob[] = [];

  constructor(maxConcurrency = 4) {
    this.maxConcurrency = maxConcurrency;
  }

  public enqueue(
    tenantId: string,
    type: PipelineJob['type'],
    name: string,
    execute: () => Promise<any>
  ): string {
    const jobKey = `${tenantId}:${type}`;

    if (this.activeJobs.has(jobKey)) {
      const activeJob = this.activeJobs.get(jobKey)!;
      if (activeJob.status === 'queued' || activeJob.status === 'running') {
        activeJob.logs.push(`[Orchestrator] Coalesced duplicate trigger request received at ${new Date().toISOString()}`);
        return activeJob.id;
      }
    }

    const job: PipelineJob = {
      id: `job_${Math.random().toString(36).substring(2, 11)}`,
      name,
      tenantId,
      type,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      logs: [`[Orchestrator] Enqueued job: ${name} (type: ${type}) for tenant: "${tenantId}"`],
      execute
    };

    this.queue.push(job);
    this.activeJobs.set(jobKey, job);
    this.processQueue();

    return job.id;
  }

  private async processQueue(): Promise<void> {
    if (this.activeWorkers >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    this.activeWorkers++;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    job.logs.push(`[Orchestrator] Workers active: ${this.activeWorkers}/${this.maxConcurrency}. Executing job...`);

    try {
      await job.execute();
      job.status = 'completed';
      job.logs.push(`[Orchestrator] Job completed successfully at ${new Date().toISOString()}`);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || String(err);
      job.logs.push(`[Orchestrator] Job execution failed: ${job.error}`);
    } finally {
      job.endedAt = new Date().toISOString();
      this.activeWorkers--;

      this.completedJobs.push(job);
      if (this.completedJobs.length > 50) {
        this.completedJobs.shift();
      }

      const jobKey = `${job.tenantId}:${job.type}`;
      this.activeJobs.delete(jobKey);
      this.processQueue();
    }
  }

  public getStatusReport() {
    const running = Array.from(this.activeJobs.values()).filter(j => j.status === 'running');
    const queued = this.queue;
    return {
      stats: {
        activeWorkers: this.activeWorkers,
        maxConcurrency: this.maxConcurrency,
        pendingJobsCount: queued.length,
        runningJobsCount: running.length,
        completedJobsCount: this.completedJobs.length,
      },
      activeJobs: running.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt,
        logs: j.logs,
      })),
      queuedJobs: queued.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        queuedAt: j.queuedAt,
      })),
      recentCompleted: this.completedJobs.map(j => ({
        id: j.id,
        name: j.name,
        tenantId: j.tenantId,
        type: j.type,
        status: j.status,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt,
        endedAt: j.endedAt,
        error: j.error,
        durationMs: j.startedAt && j.endedAt ? Date.now() - Date.parse(j.startedAt) : 0,
      })),
    };
  }
}

export const orchestrator = new PipelineOrchestrator(4);

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

export function ensureMissionWorkspaceDirs(tenantId: string, missionType: string, missionId: string) {
  const normType = (missionType || 'standard').replace(/^system_/, '');
  const userRoot = getTenantRoot(tenantId);
  const baseDir = path.join(userRoot, 'missions', missionId);
  const planningDir = path.join(baseDir, 'planning');
  const executionDir = path.join(baseDir, 'execution');

  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(executionDir, { recursive: true });

  return { baseDir, planningDir, executionDir, normType };
}

export function syncMissionWorkspaceArtifacts(mission: Partial<Mission> & { id: string }) {
  if (!mission || !mission.id) return null;
  const tenantId = mission.user_id || 'default_user';
  const mType = mission.type || 'standard';
  const { planningDir, executionDir, baseDir } = ensureMissionWorkspaceDirs(tenantId, mType, mission.id);

  try {
    const planJsonPath = path.join(planningDir, 'plan.json');
    const planMdPath = path.join(planningDir, 'blueprint.md');

    const tasks = mission.metadata?.tasks || [];
    const planData = {
      id: mission.id,
      title: mission.title || '',
      objective: mission.objective || '',
      type: mType,
      status: mission.status || 'drafting',
      phase: mission.phase || 'planning',
      tasks
    };

    fs.writeFileSync(planJsonPath, JSON.stringify(planData, null, 2), 'utf8');

    let tasksMd = '';
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasksMd = tasks.map(t => `- [${t.completed ? 'x' : ' '}] **${t.title || t.id}**`).join('\n');
    }

    const blueprintMd = `# Mission Blueprint: ${mission.title || mission.id}\n**Objective:** ${mission.objective || 'N/A'}\n\n## Tasks Roadmap\n${tasksMd || 'No tasks generated yet.'}\n`;
    fs.writeFileSync(planMdPath, blueprintMd, 'utf8');

    const execJsonPath = path.join(executionDir, 'execution.json');
    const execLogsMdPath = path.join(executionDir, 'execution_history.md');

    const execData = {
      id: mission.id,
      status: mission.status || 'drafting',
      phase: mission.phase || 'planning',
      workflow_history: mission.workflow_history || [],
      metrics: mission.metadata?.metrics || {}
    };

    fs.writeFileSync(execJsonPath, JSON.stringify(execData, null, 2), 'utf8');

    const historyLines = (mission.workflow_history || []).map(h => `### [${h.timestamp || 'N/A'}] Phase: ${h.phase || ''}\n${h.status || ''}`).join('\n\n');
    const execMd = `# Mission Execution Logs: ${mission.title || mission.id}\n\n## Workflow Execution History\n${historyLines || 'No execution events logged yet.'}\n`;
    fs.writeFileSync(execLogsMdPath, execMd, 'utf8');

    syncMissionsJson(tenantId);
  } catch (err) {
    console.warn(`[MissionsCore] Failed writing mission workspace artifacts:`, err);
  }

  return { baseDir, planningDir, executionDir };
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

  const diskMissions: Mission[] = [];

  const scanMissionFolder = (mPath: string, mId: string, mType: string) => {
    const planJsonPath = path.join(mPath, 'planning', 'plan.json');
    const planMdPath = path.join(mPath, 'planning', 'blueprint.md');
    const execJsonPath = path.join(mPath, 'execution', 'execution.json');
    const execMdPath = path.join(mPath, 'execution', 'execution_history.md');

    let planData: any = {};
    let execData: any = {};

    if (fs.existsSync(planJsonPath)) {
      try { planData = JSON.parse(fs.readFileSync(planJsonPath, 'utf8')); } catch (_) {}
    }
    if (fs.existsSync(execJsonPath)) {
      try { execData = JSON.parse(fs.readFileSync(execJsonPath, 'utf8')); } catch (_) {}
    }

    if (!fs.existsSync(planJsonPath) && !fs.existsSync(execJsonPath) && !planData.title && !planData.objective) {
      return;
    }

    diskMissions.push({
      id: mId,
      title: planData.title || mId,
      objective: planData.objective || planData.title || mId,
      type: mType || planData.type || 'standard',
      user_id: tenantId,
      status: planData.status || execData.status || 'drafting',
      phase: planData.phase || execData.phase || 'planning',
      scratchpad: `missions/${mId}/`,
      planning_artifacts: {
        plan_json: fs.existsSync(planJsonPath) ? path.relative(userRoot, planJsonPath) : null,
        blueprint_md: fs.existsSync(planMdPath) ? path.relative(userRoot, planMdPath) : null
      },
      execution_artifacts: {
        execution_json: fs.existsSync(execJsonPath) ? path.relative(userRoot, execJsonPath) : null,
        execution_history_md: fs.existsSync(execMdPath) ? path.relative(userRoot, execMdPath) : null
      },
      metadata: {
        tasks: planData.tasks || [],
        metrics: execData.metrics || {}
      },
      workflow_history: execData.workflow_history || [],
      updated_at: new Date().toISOString()
    });
  };

  if (fs.existsSync(missionsDir)) {
    const topEntries = fs.readdirSync(missionsDir).filter(f => {
      try { return fs.statSync(path.join(missionsDir, f)).isDirectory(); } catch { return false; }
    });
    for (const entryName of topEntries) {
      const entryPath = path.join(missionsDir, entryName);
      if (fs.existsSync(path.join(entryPath, 'planning')) || fs.existsSync(path.join(entryPath, 'execution'))) {
        scanMissionFolder(entryPath, entryName, 'standard');
      }
    }
  }

  const combinedMap = new Map<string, Mission>();
  for (const m of existingMissions) {
    if (m && m.id) combinedMap.set(m.id, m);
  }
  for (const m of diskMissions) {
    combinedMap.set(m.id, m);
  }

  const finalMissions = Array.from(combinedMap.values());
  fs.writeFileSync(singleMissionsPath, JSON.stringify({ missions: finalMissions }, null, 2), 'utf8');

  return finalMissions;
}

export const syncMissionsDb = syncMissionsJson;

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

  const updated: Mission = {
    ...target,
    ...updates,
    id: missionId,
    updated_at: new Date().toISOString()
  };

  syncMissionWorkspaceArtifacts(updated);
  return updated;
}

export function deleteMission(tenantId: string = 'default_user', missionId: string): boolean {
  const userRoot = getTenantRoot(tenantId);
  const missionDir = path.join(userRoot, 'missions', missionId);
  if (fs.existsSync(missionDir)) {
    fs.rmSync(missionDir, { recursive: true, force: true });
  }

  const missions = getMissions(tenantId).filter(m => m.id !== missionId);
  const singleMissionsPath = path.join(userRoot, 'missions.json');
  fs.writeFileSync(singleMissionsPath, JSON.stringify({ missions }, null, 2), 'utf8');
  return true;
}
