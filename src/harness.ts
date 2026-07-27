import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { nowIso, readYaml, writeYaml } from './utils.js';

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

function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Ensures the target workspace directory hierarchy exists for a user/tenant:
 * workspaces/<tenant_id>/
 * ├── .pi/
 * │   ├── agent/ (auth.json, models-store.json managed automatically by pi)
 * │   ├── skills/
 * │   └── extensions/
 * ├── AGENTS.md
 * ├── db/
 * │   ├── settings.json
 * │   ├── runtime.json
 * │   ├── projects.json
 * │   └── missions.json
 * ├── projects/
 * └── missions/
 *     ├── standard/ (planning/, execution/)
 *     └── [9 other mission types]/ (planning/, execution/)
 */
export function ensureUserHarness(tenantId: string = 'default_user'): UserHarnessInfo {
  const userRoot = path.join(process.cwd(), 'workspaces', tenantId);
  
  // 1. .pi Kernel isolation directory
  const piDir = path.join(userRoot, '.pi');
  const piAgentDir = path.join(piDir, 'agent');
  const piSkillsDir = path.join(piDir, 'skills');
  const piExtensionsDir = path.join(piDir, 'extensions');

  fs.mkdirSync(piAgentDir, { recursive: true });
  fs.mkdirSync(piSkillsDir, { recursive: true });
  fs.mkdirSync(piExtensionsDir, { recursive: true });

  // 2. Structured States and Mappings (db/)
  const dbDir = path.join(userRoot, 'db');
  fs.mkdirSync(dbDir, { recursive: true });

  const settingsPath = path.join(dbDir, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({
      language: "EN",
      internet_access: true,
      autonomy: "autonomous",
      capabilities: ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"],
      subscription: { plan: "Professional", active: true },
      quota: { monthly_tokens: 1000000, used_tokens: 0 },
      alerts: []
    }, null, 2), 'utf8');
  }

  const runtimePath = path.join(dbDir, 'runtime.json');
  if (!fs.existsSync(runtimePath)) {
    fs.writeFileSync(runtimePath, JSON.stringify({
      tenant_id: tenantId,
      status: "running",
      suggestions: [],
      backlogs: [],
      review_queues: [],
      recent_events: [
        { date: nowIso(), type: "system", description: "Workspace initialized successfully." }
      ],
      last_active: nowIso()
    }, null, 2), 'utf8');
  }

  const projectsPath = path.join(dbDir, 'projects.json');
  if (!fs.existsSync(projectsPath)) {
    fs.writeFileSync(projectsPath, JSON.stringify({ projects: [] }, null, 2), 'utf8');
  }

  const missionsPath = path.join(dbDir, 'missions.json');
  if (!fs.existsSync(missionsPath)) {
    fs.writeFileSync(missionsPath, JSON.stringify({ missions: [] }, null, 2), 'utf8');
  }

  // 4. Projects Directory
  const projectsDir = path.join(userRoot, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  syncProjectsDb(tenantId);

  // 5. Mission Planning Artifacts & Execution Space (missions/)
  const missionTypes = [
    'standard', 'analytics', 'deep_research', 'brainstorming', 'build',
    'build_from_data', 'optimization', 'optimization_from_data', 'test', 'test_from_data'
  ];
  const missionsDir = path.join(userRoot, 'missions');
  for (const mType of missionTypes) {
    const typeDir = path.join(missionsDir, mType);
    fs.mkdirSync(path.join(typeDir, 'planning'), { recursive: true });
    fs.mkdirSync(path.join(typeDir, 'execution'), { recursive: true });
  }

  // Clean up legacy harness or entities directories if they exist
  const harnessDir = path.join(userRoot, 'harness');
  const entitiesDir = path.join(userRoot, 'entities');
  if (fs.existsSync(harnessDir)) {
    try { fs.rmSync(harnessDir, { recursive: true, force: true }); } catch {}
  }
  if (fs.existsSync(entitiesDir)) {
    try { fs.rmSync(entitiesDir, { recursive: true, force: true }); } catch {}
  }

  const config: HarnessConfig = {
    harness: {
      version: "2.1.0",
      name: `PI Agent Harness [Tenant: ${tenantId}]`,
      architecture: "decoupled_pi_harness",
      mode: "per_user_isolated",
      model_preferences: {
        default_agent_model: "gemini-2.5-flash",
        research_model: "gemini-2.5-pro",
        sandbox_timeout_ms: 10000
      },
      memory: {
        context_window_tokens: 128000,
        persistence_mode: "hybrid_fs_db"
      },
      tools_sandbox: {
        isolation: "docker_wasm_vm",
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

export interface PiExecutionOptions {
  cwd: string;
  piCodingAgentDir: string;
  env: Record<string, string>;
  cliFlags: string[];
}

/**
 * Generates the environment variables and CLI execution flags for calling `pi`
 * for a specified tenant, ensuring multi-tenant isolation and global resource ingestion.
 */
export function getPiExecutionOptions(tenantId: string = 'default_user'): PiExecutionOptions {
  ensureUserHarness(tenantId);
  const userRoot = path.join(process.cwd(), 'workspaces', tenantId);
  const piAgentDir = path.join(userRoot, '.pi', 'agent');
  fs.mkdirSync(piAgentDir, { recursive: true });

  const cliFlags: string[] = [
    '--skill', path.join(process.cwd(), 'Fabrica_kernel', 'skills'),
    // context_injector: before_prompt hook — injects kernel prompts + workspace state every turn
    '--extension', path.join(process.cwd(), 'Fabrica_kernel', 'extensions', 'context_injector.js'),
    // workspace_sync: after_action hook — updates suggestions/backlogs/review_queues in db/runtime.json
    '--extension', path.join(process.cwd(), 'Fabrica_kernel', 'extensions', 'workspace_sync.js'),
    // registry_bridge: programmatic PI registry for skills & extensions discovery
    '--extension', path.join(process.cwd(), 'Fabrica_kernel', 'extensions', 'registry_bridge.js'),
  ];

  const userSkillsDir = path.join(userRoot, '.pi', 'skills');
  if (fs.existsSync(userSkillsDir)) {
    cliFlags.push('--skill', userSkillsDir);
  }

  const userExtDir = path.join(userRoot, '.pi', 'extensions');
  if (fs.existsSync(userExtDir)) {
    cliFlags.push('--extension', userExtDir);
  }

  return {
    cwd: userRoot,
    piCodingAgentDir: piAgentDir,
    env: {
      ...process.env,
      PI_CODING_AGENT_DIR: piAgentDir
    },
    cliFlags
  };
}

/**
 * Creates mission workspace folder structure matching:
 * missions/<mission_type>/<mission_id>/
 * ├── planning/
 * └── execution/
 */
export function ensureMissionWorkspaceDirs(tenantId: string, missionType: string, missionId: string) {
  ensureUserHarness(tenantId);
  const normType = (missionType || 'standard').replace(/^system_/, '');
  const baseDir = path.join(process.cwd(), 'workspaces', tenantId, 'missions', normType, missionId);
  const planningDir = path.join(baseDir, 'planning');
  const executionDir = path.join(baseDir, 'execution');
  
  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(executionDir, { recursive: true });
  
  return { baseDir, planningDir, executionDir, normType };
}

/**
 * Writes planning and execution artifacts into workspace/<mission_type>/<mission_id>/
 */
export function syncMissionWorkspaceArtifacts(mission: any) {
  if (!mission || !mission.id) return null;
  const tenantId = mission.user_id || 'default_user';
  const mType = mission.type || mission.category || 'standard';
  const { planningDir, executionDir, baseDir } = ensureMissionWorkspaceDirs(tenantId, mType, mission.id);

  try {
    // 1. Planning Artifacts
    const planJsonPath = path.join(planningDir, 'plan.json');
    const planMdPath = path.join(planningDir, 'blueprint.md');

    const tasks = mission.metadata?.tasks || [];
    const planData = {
      id: mission.id,
      title: mission.title || '',
      objective: mission.objective || '',
      type: mType,
      status: mission.status || 'drafting',
      phase: mission.phase || '',
      qa_state: mission.qa_state || null,
      tasks: tasks
    };

    fs.writeFileSync(planJsonPath, JSON.stringify(planData, null, 2), 'utf8');

    let tasksMd = '';
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasksMd = tasks.map((t: any) => `- [${t.completed ? 'x' : ' '}] **${t.title || t.id}** (Cost: ${t.cost || 'LOW'}, Benefit: ${t.benefit || 'HIGH'}, Worth It: ${t.worth_it || t.worthIt || 'YES'})`).join('\n');
    } else if (tasks && typeof tasks === 'object') {
      tasksMd = Object.values(tasks).map((t: any) => `- [${t.completed ? 'x' : ' '}] **${t.title || t.id}** (Cost: ${t.cost || 'LOW'}, Benefit: ${t.benefit || 'HIGH'}, Worth It: ${t.worth_it || t.worthIt || 'YES'})`).join('\n');
    }

    const blueprintMd = `# Mission Blueprint: ${mission.title || mission.id}
**Objective:** ${mission.objective || 'N/A'}
**Type:** ${mType}
**Status:** ${mission.status || 'drafting'} | **Phase:** ${mission.phase || 'N/A'}

## Tasks Roadmap
${tasksMd || 'No tasks generated yet.'}

## QA Verification State
${mission.qa_state ? JSON.stringify(mission.qa_state, null, 2) : 'Pending QA evaluation.'}
`;

    fs.writeFileSync(planMdPath, blueprintMd, 'utf8');

    // 2. Execution Artifacts
    const execJsonPath = path.join(executionDir, 'execution.json');
    const execLogsMdPath = path.join(executionDir, 'execution_history.md');

    const execData = {
      id: mission.id,
      status: mission.status || 'drafting',
      phase: mission.phase || '',
      workflow_history: mission.workflow_history || [],
      system_ids: mission.system_ids || [],
      input_data_ids: mission.input_data_ids || [],
      metrics: mission.metadata?.metrics || {}
    };

    fs.writeFileSync(execJsonPath, JSON.stringify(execData, null, 2), 'utf8');

    const historyLines = (mission.workflow_history || []).map((h: any) => `### [${h.timestamp || 'N/A'}] Phase: ${h.phase || ''}\n${h.status || ''}`).join('\n\n');

    const execMd = `# Mission Execution Logs: ${mission.title || mission.id}
**Current Status:** ${mission.status || 'drafting'}
**System Component Artifacts:** ${(mission.system_ids || []).join(', ') || 'None generated yet'}

## Workflow Execution History
${historyLines || 'No execution events logged yet.'}
`;

    fs.writeFileSync(execLogsMdPath, execMd, 'utf8');
    syncMissionsDb(tenantId);
  } catch (err) {
    console.warn(`⚠️ Failed to write mission workspace artifacts:`, err);
  }

  return { baseDir, planningDir, executionDir };
}

/**
 * Syncs the missions/ directory structure with db/missions.json in real time
 */
export function syncMissionsDb(tenantId: string = 'default_user') {
  const userRoot = path.join(process.cwd(), 'workspaces', tenantId);
  const missionsDir = path.join(userRoot, 'missions');
  const dbMissionsPath = path.join(userRoot, 'db', 'missions.json');

  if (!fs.existsSync(missionsDir)) {
    fs.mkdirSync(missionsDir, { recursive: true });
  }

  const missions: any[] = [];

  const mTypes = fs.readdirSync(missionsDir).filter(f => {
    return fs.statSync(path.join(missionsDir, f)).isDirectory();
  });

  for (const mType of mTypes) {
    const typeDir = path.join(missionsDir, mType);
    const mDirs = fs.readdirSync(typeDir).filter(f => {
      return fs.statSync(path.join(typeDir, f)).isDirectory();
    });

    for (const mId of mDirs) {
      const mPath = path.join(typeDir, mId);
      const planJsonPath = path.join(mPath, 'planning', 'plan.json');
      const planMdPath = path.join(mPath, 'planning', 'blueprint.md');
      const execJsonPath = path.join(mPath, 'execution', 'execution.json');
      const execMdPath = path.join(mPath, 'execution', 'execution_history.md');

      let planData: any = {};
      let execData: any = {};

      if (fs.existsSync(planJsonPath)) {
        try {
          planData = JSON.parse(fs.readFileSync(planJsonPath, 'utf8'));
        } catch (_) {}
      }

      if (fs.existsSync(execJsonPath)) {
        try {
          execData = JSON.parse(fs.readFileSync(execJsonPath, 'utf8'));
        } catch (_) {}
      }

      const collectFiles = (dir: string): any[] => {
        if (!fs.existsSync(dir)) return [];
        let list: any[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          const rel = path.relative(userRoot, full);
          if (entry.isDirectory()) {
            list = list.concat(collectFiles(full));
          } else if (!entry.name.startsWith('.')) {
            list.push({
              name: entry.name,
              path: rel
            });
          }
        }
        return list;
      };

      const workspaceFiles = collectFiles(mPath);

      missions.push({
        id: mId,
        title: planData.title || mId,
        objective: planData.objective || '',
        type: mType,
        user_id: tenantId,
        status: planData.status || execData.status || 'drafting',
        phase: planData.phase || execData.phase || 'planning',
        planning_artifacts: {
          plan_json: fs.existsSync(planJsonPath) ? `missions/${mType}/${mId}/planning/plan.json` : null,
          blueprint_md: fs.existsSync(planMdPath) ? `missions/${mType}/${mId}/planning/blueprint.md` : null
        },
        execution_artifacts: {
          execution_json: fs.existsSync(execJsonPath) ? `missions/${mType}/${mId}/execution/execution.json` : null,
          execution_history_md: fs.existsSync(execMdPath) ? `missions/${mType}/${mId}/execution/execution_history.md` : null
        },
        workspace_files: workspaceFiles,
        metadata: {
          tasks: planData.tasks || [],
          metrics: execData.metrics || {}
        },
        workflow_history: execData.workflow_history || [],
        updated_at: new Date().toISOString()
      });
    }
  }

  fs.mkdirSync(path.join(userRoot, 'db'), { recursive: true });
  fs.writeFileSync(dbMissionsPath, JSON.stringify({ missions }, null, 2), 'utf8');
  return missions;
}

/**
 * Syncs the projects/ directory structure with db/projects.json
 */
export function syncProjectsDb(tenantId: string = 'default_user') {
  const userRoot = path.join(process.cwd(), 'workspaces', tenantId);
  const projectsDir = path.join(userRoot, 'projects');
  const dbProjectsPath = path.join(userRoot, 'db', 'projects.json');

  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }

  // Ensure default_project folder exists
  const defaultProjData = path.join(projectsDir, 'default_project', 'data');
  const defaultProjSystems = path.join(projectsDir, 'default_project', 'systems');
  fs.mkdirSync(defaultProjData, { recursive: true });
  fs.mkdirSync(defaultProjSystems, { recursive: true });

  const projectFolders = fs.readdirSync(projectsDir).filter(f => {
    return fs.statSync(path.join(projectsDir, f)).isDirectory();
  });

  const projects = projectFolders.map(pName => {
    const pPath = path.join(projectsDir, pName);
    const dataPath = path.join(pPath, 'data');
    const systemsPath = path.join(pPath, 'systems');

    const scanFiles = (dirPath: string, prefix: string) => {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return [];
      }
      return fs.readdirSync(dirPath, { withFileTypes: true })
        .filter(item => !item.name.startsWith('.'))
        .map(item => ({
          name: item.name,
          path: `${prefix}/${item.name}`,
          isDirectory: item.isDirectory()
        }));
    };

    const dataFiles = scanFiles(dataPath, `projects/${pName}/data`);
    const systemsList = scanFiles(systemsPath, `projects/${pName}/systems`);

    return {
      id: `proj_${pName}`,
      name: pName,
      path: `projects/${pName}`,
      data: dataFiles,
      systems: systemsList,
      updated_at: new Date().toISOString()
    };
  });

  fs.mkdirSync(path.join(userRoot, 'db'), { recursive: true });
  fs.writeFileSync(dbProjectsPath, JSON.stringify({ projects }, null, 2), 'utf8');
  return projects;
}

/**
 * Creates project folder structure matching:
 * projects/<project_name>/
 * ├── data/
 * └── systems/<system_name>/
 */
export function ensureProjectDirs(tenantId: string, projectName: string, systemName?: string) {
  ensureUserHarness(tenantId);
  const safeProjectName = (projectName || 'default_project').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const projectDir = path.join(process.cwd(), 'workspaces', tenantId, 'projects', safeProjectName);
  const dataDir = path.join(projectDir, 'data');
  
  fs.mkdirSync(dataDir, { recursive: true });

  let systemDir: string | null = null;
  if (systemName) {
    const safeSystemName = systemName.replace(/[^a-zA-Z0-9_\-]/g, '_');
    systemDir = path.join(projectDir, 'systems', safeSystemName);
    fs.mkdirSync(systemDir, { recursive: true });
  } else {
    fs.mkdirSync(path.join(projectDir, 'systems'), { recursive: true });
  }

  syncProjectsDb(tenantId);

  return { projectDir, dataDir, systemDir, projectName: safeProjectName };
}

/**
 * Returns or initializes the dedicated folder for the single user workspace entity under workspaces/<tenant_id>/entities/_os/
 * Subfolders created:
 * - storage/  (for files and assets)
 * - systems/  (for toolboxes, agents, skills)
 * - db/       (for db.json structured store)
 */
export function getEntityDir(entityName: string, tenantId: string = 'default_user'): string {
  // Single workspace entity model: always map to _os workspace
  const normName = '_os';
  const userEntityDir = path.join(process.cwd(), 'workspaces', tenantId, 'entities', normName);

  if (!fs.existsSync(userEntityDir)) {
    fs.mkdirSync(userEntityDir, { recursive: true });

    // Copy legacy files if available at process.cwd()/normName
    const legacyDir = path.join(process.cwd(), normName);
    if (fs.existsSync(legacyDir) && fs.statSync(legacyDir).isDirectory()) {
      try {
        copyDirSync(legacyDir, userEntityDir);
      } catch (err) {
        console.warn(`[Harness] Migration copy warning for ${normName}:`, err);
      }
    }
  }

  // Create standard subdirectories: .pi/, storage/data/, projects/, scratch/, db/
  const storageDir = path.join(userEntityDir, 'storage');
  const storageDataDir = path.join(storageDir, 'data');
  const projectsDir = path.join(userEntityDir, 'projects');
  const systemsDir = path.join(userEntityDir, 'systems');
  const scratchDir = path.join(userEntityDir, 'scratch');
  const dbDir = path.join(userEntityDir, 'db');
  const piDir = path.join(userEntityDir, '.pi');

  fs.mkdirSync(storageDir, { recursive: true });
  fs.mkdirSync(storageDataDir, { recursive: true });
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.mkdirSync(systemsDir, { recursive: true });
  fs.mkdirSync(scratchDir, { recursive: true });
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(piDir, { recursive: true });

  // Initialize .pi/ subdirectories
  const piPromptsDir = path.join(piDir, 'prompts');
  const piSkillsDir = path.join(piDir, 'skills');
  const piToolsDir = path.join(piDir, 'tools');
  const piAgentsDir = path.join(piDir, 'agents');
  const piSessionsDir = path.join(piDir, 'sessions');

  fs.mkdirSync(piPromptsDir, { recursive: true });
  fs.mkdirSync(piSkillsDir, { recursive: true });
  fs.mkdirSync(piToolsDir, { recursive: true });
  fs.mkdirSync(piAgentsDir, { recursive: true });
  fs.mkdirSync(piSessionsDir, { recursive: true });

  const piConfigPath = path.join(piDir, 'config.json');
  if (!fs.existsSync(piConfigPath)) {
    fs.writeFileSync(piConfigPath, JSON.stringify({
      version: "1.0.0",
      tenantId,
      shared_dir: "/Fabrica_kernel",
      skills_dirs: ["/Fabrica_kernel/skills", ".pi/skills"],
      tools_dirs: ["/Fabrica_kernel/tools", ".pi/tools"],
      prompts_dirs: ["/Fabrica_kernel/prompts", ".pi/prompts"],
      agents_dirs: ["/Fabrica_kernel/agents", ".pi/agents"],
      defaults: {
        model: "gemini-2.5-flash",
        temperature: 0.2,
        thinking_level: "medium"
      }
    }, null, 2), 'utf8');
  }

  const piSecurityPath = path.join(piDir, 'security.json');
  if (!fs.existsSync(piSecurityPath)) {
    fs.writeFileSync(piSecurityPath, JSON.stringify({
      version: "1.0.0",
      auto_approve_read_only: true,
      sandbox_timeout_ms: 10000
    }, null, 2), 'utf8');
  }

  // Ensure required files exist inside entity folder
  const boardYaml = path.join(userEntityDir, 'board.yaml');
  const missionsYaml = path.join(userEntityDir, 'missions.yaml');
  const runtimeYaml = path.join(userEntityDir, 'runtime.yaml');
  const dbJson = path.join(dbDir, 'db.json');

  if (!fs.existsSync(boardYaml)) {
    const legacyBoard = path.join(process.cwd(), normName, `${normName === '_os' ? 'os' : normName}-board.md`);
    let desc = `Entity workspace for ${normName} managed by PI Agent Harness`;
    if (fs.existsSync(legacyBoard)) {
      desc = fs.readFileSync(legacyBoard, 'utf8');
    }
    writeYaml(boardYaml, {
      entity: normName,
      description: desc,
      status: true,
      aspects: ["Architecture", "Capabilities", "Monetization"],
      created_at: nowIso(),
      freshness: { sync_status: 'fresh', last_synced: nowIso() }
    });
  }

  if (!fs.existsSync(missionsYaml)) {
    writeYaml(missionsYaml, {
      entity: normName,
      active_missions: [],
      history: [],
      freshness: { sync_status: 'fresh', last_synced: nowIso() }
    });
  }

  if (!fs.existsSync(runtimeYaml)) {
    writeYaml(runtimeYaml, {
      entity: normName,
      runtime_status: "active",
      model: "gemini-2.5-flash",
      freshness: { sync_status: 'fresh', last_synced: nowIso() }
    });
  }

  if (!fs.existsSync(dbJson)) {
    fs.writeFileSync(dbJson, JSON.stringify({
      entity: normName,
      documents: [],
      kv_store: {},
      created_at: nowIso()
    }, null, 2), 'utf8');
  }

  return userEntityDir;
}

/**
 * Returns entity sub-paths
 */
export function getEntityStorageDir(entityName: string, tenantId: string = 'default_user'): string {
  const entityDir = getEntityDir(entityName, tenantId);
  return path.join(entityDir, 'storage');
}

export function getEntitySystemsDir(entityName: string, tenantId: string = 'default_user'): string {
  const entityDir = getEntityDir(entityName, tenantId);
  return path.join(entityDir, 'systems');
}

export function getEntityDbFile(entityName: string, tenantId: string = 'default_user'): string {
  const entityDir = getEntityDir(entityName, tenantId);
  return path.join(entityDir, 'db', 'db.json');
}

export function updateHarnessConfig(tenantId: string = 'default_user', updates: Partial<HarnessConfig['harness']>): HarnessConfig {
  const info = ensureUserHarness(tenantId);
  return info.config;
}

/**
 * Returns absolute root directory for a user/tenant, ensuring path traversal protection
 */
export function getUserRoot(tenantId: string = 'default_user'): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const userRoot = path.join(process.cwd(), 'workspaces', safeTenant);
  if (!fs.existsSync(userRoot)) {
    ensureUserHarness(safeTenant);
  }
  return userRoot;
}

/**
 * Safely resolves a relative path within a user's isolated workspace directory
 */
export function resolveUserPath(tenantId: string, relativePath: string = ''): string {
  const userRoot = getUserRoot(tenantId);
  const normalizedRel = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const resolved = path.join(userRoot, normalizedRel);

  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Access denied outside user workspace directory.`);
  }
  return resolved;
}

export interface UserFileItem {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  updatedAt: string;
}

/**
 * Lists contents of a user's isolated directory
 */
export function listUserFiles(tenantId: string = 'default_user', subDir: string = ''): UserFileItem[] {
  ensureUserHarness(tenantId);
  const targetDir = resolveUserPath(tenantId, subDir);

  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return [];
  }

  const userRoot = getUserRoot(tenantId);
  const entries = fs.readdirSync(targetDir, { withFileTypes: true });

  return entries.map(entry => {
    const fullPath = path.join(targetDir, entry.name);
    const relPath = path.relative(userRoot, fullPath);
    let size = 0;
    let updatedAt = nowIso();

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

/**
 * Reads content of a file inside the user's isolated directory
 */
export function readUserFile(tenantId: string, relativePath: string): { content: string; path: string; size: number } {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
    throw new Error(`File not found or is a directory: ${relativePath}`);
  }
  const content = fs.readFileSync(targetPath, 'utf8');
  const userRoot = getUserRoot(tenantId);
  return {
    content,
    path: path.relative(userRoot, targetPath),
    size: Buffer.byteLength(content, 'utf8')
  };
}

/**
 * Writes or creates a file inside the user's isolated workspace directory
 */
export function writeUserFile(tenantId: string, relativePath: string, content: string): { path: string; size: number } {
  const targetPath = resolveUserPath(tenantId, relativePath);
  const parentDir = path.dirname(targetPath);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');

  const userRoot = getUserRoot(tenantId);
  const normPath = path.relative(userRoot, targetPath);

  // Trigger real-time DB synchronization
  if (normPath.startsWith('projects/')) {
    syncProjectsDb(tenantId);
  } else if (normPath.startsWith('missions/') || normPath.startsWith('workspace/')) {
    syncMissionsDb(tenantId);
  }

  recordUserHarnessActivity(tenantId);

  return {
    path: normPath,
    size: Buffer.byteLength(content, 'utf8')
  };
}

/**
 * Moves a file or directory inside the user's isolated workspace.
 * Automatically handles transfers between projects/ and missions/ and triggers real-time DB sync.
 */
export function moveUserFile(tenantId: string, srcRelativePath: string, destRelativePath: string): { src: string; dest: string; size: number } {
  const srcPath = resolveUserPath(tenantId, srcRelativePath);
  const destPath = resolveUserPath(tenantId, destRelativePath);

  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source file or folder does not exist: ${srcRelativePath}`);
  }

  const destParent = path.dirname(destPath);
  fs.mkdirSync(destParent, { recursive: true });

  fs.renameSync(srcPath, destPath);

  const userRoot = getUserRoot(tenantId);
  const normSrc = path.relative(userRoot, srcPath);
  const normDest = path.relative(userRoot, destPath);

  // Trigger real-time DB updates for affected storage regions
  if (normSrc.startsWith('projects/') || normDest.startsWith('projects/')) {
    syncProjectsDb(tenantId);
  }
  if (normSrc.startsWith('missions/') || normDest.startsWith('missions/') || normSrc.startsWith('workspace/') || normDest.startsWith('workspace/')) {
    syncMissionsDb(tenantId);
  }

  recordUserHarnessActivity(tenantId);

  let size = 0;
  try {
    const stat = fs.statSync(destPath);
    size = stat.size;
  } catch (_) {}

  return { src: normSrc, dest: normDest, size };
}

/**
 * Deletes a file or directory inside the user's isolated workspace
 */
export function deleteUserFile(tenantId: string, relativePath: string): boolean {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!fs.existsSync(targetPath)) return false;

  const userRoot = getUserRoot(tenantId);
  const normPath = path.relative(userRoot, targetPath);

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }

  if (normPath.startsWith('projects/')) {
    syncProjectsDb(tenantId);
  } else if (normPath.startsWith('missions/') || normPath.startsWith('workspace/')) {
    syncMissionsDb(tenantId);
  }

  recordUserHarnessActivity(tenantId);
  return true;
}

/**
 * Updates last active timestamp and increments total runs in runtime.json
 */
export function recordUserHarnessActivity(tenantId: string, runIncrement: number = 0) {
  const runtimePath = path.join(process.cwd(), 'workspaces', tenantId, 'db', 'runtime.json');
  try {
    let runtimeData = {
      tenant_id: tenantId,
      status: "running",
      active_sessions: 1,
      total_runs: 0,
      last_active: nowIso()
    };
    if (fs.existsSync(runtimePath)) {
      runtimeData = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    }
    runtimeData.total_runs = (runtimeData.total_runs || 0) + runIncrement;
    runtimeData.last_active = nowIso();
    fs.writeFileSync(runtimePath, JSON.stringify(runtimeData, null, 2), 'utf8');
  } catch (err) {
    console.warn(`[Harness] Failed updating runtime activity for ${tenantId}:`, err);
  }
}

