import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import YAML from 'yaml';

// Configuration interface matching Table 5: app_config
export interface AppConfig {
  id?: string;
  user_id: string;
  settings: {
    autonomy: 'autonomous' | 'semi-autonomous' | 'manual';
    notifications: Record<string, any>;
    sync_daemon: boolean;
  };
  updated_at?: string;
}

// RuntimeState matching Table 6: runtime_state
export interface RuntimeState {
  id?: string;
  user_id: string;
  recent_events: Array<{
    date: string;
    type: string;
    description: string;
    details?: string;
  }>;
  active_mission_id: string | null;
  pillars?: Array<{ id?: string; title?: string; description?: string }>;
  updated_at?: string;
}

// RawData matching Table 1: raw_data
export interface RawData {
  id?: string;
  user_id: string;
  name: string;
  content: string;
  mime_type: string;
  metadata: Record<string, any>;
  created_at?: string;
}

// Artifact Types representing modular deliverables in a project
export type ArtifactType = 'codebase' | 'document' | 'plan' | 'workflow' | 'component' | 'pipeline' | 'spec' | 'other';

// Artifact (formerly SystemComponent) matching Table: artifacts / system_components
export interface Artifact {
  id?: string;
  user_id: string;
  name: string;
  role?: string;
  artifact_type?: ArtifactType;
  code_snapshot: string;
  metadata: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export type SystemComponent = Artifact;

// Mission matching Table 3: missions
export interface Mission {
  id?: string;
  user_id: string;
  type: string;
  category?: string;
  created_by?: string;
  user_created?: boolean;
  status: 'drafting' | 'planning' | 'execution' | 'archive';
  phase: 'analytics_1' | 'research_1' | 'analytics_2' | 'qa' | 'analytics_3' | 'research_2' | 'analytics_4' | 'planning' | 'execution';
  title: string;
  objective: string;
  input_data_ids: string[];
  system_ids: string[];
  qa_state: {
    options?: string[];
    why?: string;
    user_selection?: string;
    custom_input?: string;
    resolved?: boolean;
  };
  workflow_history: Array<{
    timestamp: string;
    phase: string;
    status: string;
    step_outputs?: Record<string, any>;
    case_score?: {
      benefit: number;
      cost: number;
      worth_it: boolean;
    };
  }>;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

// Tool matching Table 4: tools
export interface Tool {
  id?: string;
  user_id?: string;
  name: string;
  type: 'plugin' | 'mcp' | 'domain_skill' | 'agent';
  metadata: {
    description: string;
    role?: string;
    when_to_use?: string;
    triggers?: string[];
    inputs?: string[];
    outputs?: string[];
    maturity?: string;
    active?: boolean;
    uses?: number;
    created_at?: string;
    edited_at?: string;
  };
  created_at?: string;
}

class SimpleCache {
  private store = new Map<string, { value: any; expiresAt: number }>();

  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = 30000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class DatabaseEngine {
  private useSupabase = false;
  private supabaseClient: any = null;
  private localDbPath = path.join(process.cwd(), '.stash', 'local_db.json');
  private dbCache = new SimpleCache();

  public getIsSupabaseEnabled(): boolean {
    return !!this.supabaseClient;
  }

  public getSupabaseClient(): any {
    return this.supabaseClient;
  }

  
  // Local Database Cache for zero-config fallback
  private cache: {
    raw_data: RawData[];
    system_components: SystemComponent[];
    missions: Mission[];
    tools: Tool[];
    app_config: AppConfig[];
    runtime_state: RuntimeState[];
  } = {
    raw_data: [],
    system_components: [],
    missions: [],
    tools: [],
    app_config: [],
    runtime_state: [],
  };

  constructor() {
    const sbUrl = process.env.SUPABASE_URL || '';
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
    
    if (sbUrl && sbKey) {
      console.log('🔌 [db] Supabase Auth keys detected. Initializing Supabase Auth client for user logins.');
      this.supabaseClient = createClient(sbUrl, sbKey);
    } else {
      console.log('🔌 [db] No Supabase keys found in environment.');
    }
    
    // Always use file-backed local JSON persistence for all app data
    this.useSupabase = false;
    this.loadLocalDb();
    
    // Seed database if empty
    this.seedIfEmpty();
  }

  private validateTenantId(userId?: string): string {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('Tenant Security Policy Violation: Access denied. Valid user_id / tenantId is required to write entries.');
    }
    return userId.trim();
  }

  private getTenantDbPath(tenantId: string, filename: string): string {
    const safeTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const dbDir = path.join(process.cwd(), 'workspaces', safeTenant, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    return path.join(dbDir, filename);
  }

  private readTenantDbFile<T>(tenantId: string, filename: string, defaultValue: T): T {
    try {
      const filePath = this.getTenantDbPath(tenantId, filename);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
    } catch (err) {
      console.warn(`[db-engine] Failed reading tenant DB file ${filename} for ${tenantId}:`, err);
    }
    return defaultValue;
  }

  private writeTenantDbFile<T>(tenantId: string, filename: string, data: T): void {
    try {
      const filePath = this.getTenantDbPath(tenantId, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[db-engine] Failed writing tenant DB file ${filename} for ${tenantId}:`, err);
    }
  }

  private loadLocalDb() {
    try {
      const dir = path.dirname(this.localDbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.localDbPath)) {
        const data = fs.readFileSync(this.localDbPath, 'utf8');
        this.cache = JSON.parse(data);
      } else {
        this.saveLocalDb();
      }
    } catch (e: any) {
      console.error('[db-engine] Error loading local DB file:', e.message);
    }
  }

  private saveLocalDb() {
    try {
      const dir = path.dirname(this.localDbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.localDbPath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (e: any) {
      console.error('[db-engine] Error saving local DB file:', e.message);
    }
  }

  private seedIfEmpty() {
    // We are going production, so no mocks are seeded. Everything is initialized as clean and empty.
    if (!this.useSupabase) {
      this.cache.tools = [];
      this.cache.raw_data = [];
      this.cache.system_components = [];
      this.cache.missions = [];

      // Seed default app_config and runtime_state for core infrastructure operation
      if (this.cache.app_config.length === 0) {
        this.cache.app_config.push({
          user_id: 'default_user',
          settings: {
            autonomy: 'autonomous',
            notifications: {},
            sync_daemon: true
          }
        });
      }
      if (this.cache.runtime_state.length === 0) {
        this.cache.runtime_state.push({
          user_id: 'default_user',
          recent_events: [
            { date: new Date().toISOString(), type: 'system', description: 'Fabrica Relational Database engine active.' }
          ],
          active_mission_id: null
        });
      }

      this.saveLocalDb();
    }
  }

  // Tenant Discovery helper for autonomous 24/7 simulation
  async getAllUsers(): Promise<string[]> {
    if (this.useSupabase) {
      try {
        const { data, error } = await this.supabaseClient
          .from('app_config')
          .select('user_id');
        if (error) throw error;
        const list = (data || []).map((x: any) => x.user_id as string);
        if (!list.includes('default_user')) {
          list.push('default_user');
        }
        return Array.from(new Set(list));
      } catch {
        return ['default_user'];
      }
    } else {
      const users = this.cache.app_config.map(c => c.user_id);
      if (!users.includes('default_user')) users.push('default_user');
      for (const m of this.cache.missions) {
        if (!users.includes(m.user_id)) users.push(m.user_id);
      }
      return Array.from(new Set(users));
    }
  }

  // APP_CONFIG CRUD
  async getAppConfig(userId: string): Promise<AppConfig> {
    const cacheKey = `config:${userId}`;
    const cached = this.dbCache.get<AppConfig>(cacheKey);
    if (cached) return cached;

    let result: AppConfig;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('app_config')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      result = data || { user_id: userId, settings: { autonomy: 'autonomous', notifications: {}, sync_daemon: true } };
    } else {
      const found = this.cache.app_config.find(c => c.user_id === userId);
      result = found || { user_id: userId, settings: { autonomy: 'autonomous', notifications: {}, sync_daemon: true } };
    }

    this.dbCache.set(cacheKey, result, 30000);
    return result;
  }

  async saveAppConfig(config: AppConfig): Promise<AppConfig> {
    config.user_id = this.validateTenantId(config.user_id);
    config.updated_at = new Date().toISOString();
    let result: AppConfig;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('app_config')
        .upsert(config, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const idx = this.cache.app_config.findIndex(c => c.user_id === config.user_id);
      if (idx >= 0) {
        this.cache.app_config[idx] = config;
      } else {
        this.cache.app_config.push(config);
      }
      this.saveLocalDb();
      result = config;
    }

    // Sync to workspace db/settings.json
    this.writeTenantDbFile(config.user_id, 'settings.json', {
      language: "EN",
      internet_access: true,
      capabilities: ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"],
      subscription: { plan: "Professional", active: true },
      quota: { monthly_tokens: 1000000, used_tokens: 0 },
      alerts: [],
      ...(config.settings || { autonomy: 'autonomous' })
    });

    this.dbCache.delete(`config:${config.user_id}`);
    this.dbCache.set(`config:${config.user_id}`, result, 30000);
    return result;
  }

  // RUNTIME_STATE CRUD
  async getRuntimeState(userId: string): Promise<RuntimeState> {
    const cacheKey = `state:${userId}`;
    const cached = this.dbCache.get<RuntimeState>(cacheKey);
    if (cached) return cached;

    let result: RuntimeState;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('runtime_state')
        .select('*')
        .eq('user_id', userId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      result = data || { user_id: userId, recent_events: [], active_mission_id: null };
    } else {
      const found = this.cache.runtime_state.find(s => s.user_id === userId);
      result = found || { user_id: userId, recent_events: [], active_mission_id: null };
    }

    this.dbCache.set(cacheKey, result, 30000);
    return result;
  }

  async saveRuntimeState(state: RuntimeState): Promise<RuntimeState> {
    state.user_id = this.validateTenantId(state.user_id);
    state.updated_at = new Date().toISOString();
    let result: RuntimeState;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('runtime_state')
        .upsert(state, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const idx = this.cache.runtime_state.findIndex(s => s.user_id === state.user_id);
      if (idx >= 0) {
        this.cache.runtime_state[idx] = state;
      } else {
        this.cache.runtime_state.push(state);
      }
      this.saveLocalDb();
      result = state;
    }

    // Sync to workspace db/runtime.json
    this.writeTenantDbFile(state.user_id, 'runtime.json', {
      tenant_id: state.user_id,
      status: "running",
      suggestions: [],
      backlogs: [],
      review_queues: [],
      recent_events: state.recent_events || [],
      active_mission_id: state.active_mission_id || null,
      last_active: state.updated_at
    });

    this.dbCache.delete(`state:${state.user_id}`);
    this.dbCache.set(`state:${state.user_id}`, result, 30000);
    return result;
  }

  // MISSIONS CRUD
  async getMissions(userId: string): Promise<Mission[]> {
    const cacheKey = `missions:${userId}`;
    const cached = this.dbCache.get<Mission[]>(cacheKey);
    if (cached) return cached;

    let result: Mission[];
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('missions')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      result = data || [];
    } else {
      const tenantData = this.readTenantDbFile<any>(userId, 'missions.json', { missions: [] });
      const diskMissions: Mission[] = Array.isArray(tenantData) ? tenantData : (tenantData?.missions || []);
      const memoryMissions = this.cache.missions.filter(m => m.user_id === userId);

      const map = new Map<string, Mission>();
      for (const m of diskMissions) {
        if (m && m.id && m.id !== 'planning' && m.id !== 'execution') {
          map.set(m.id, {
            ...m,
            user_id: m.user_id || userId,
            title: m.title || m.objective || m.id,
            objective: m.objective || m.title || m.id,
            type: m.type || 'standard',
            status: m.status || 'drafting',
            phase: m.phase || 'planning',
            input_data_ids: m.input_data_ids || [],
            system_ids: m.system_ids || [],
            qa_state: m.qa_state || {},
            workflow_history: m.workflow_history || []
          });
        }
      }
      for (const m of memoryMissions) {
        if (m && m.id) map.set(m.id, m);
      }
      result = Array.from(map.values());
    }

    this.dbCache.set(cacheKey, result, 15000); // 15s cache for missions is highly responsive
    return result;
  }

  async getMission(userId: string, missionId: string): Promise<Mission | null> {
    const cacheKey = `mission:${userId}:${missionId}`;
    const cached = this.dbCache.get<Mission>(cacheKey);
    if (cached) return cached;

    let result: Mission | null = null;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('missions')
        .select('*')
        .eq('user_id', userId)
        .eq('id', missionId)
        .single();
      if (!error) result = data;
    } else {
      const found = this.cache.missions.find(m => m.user_id === userId && m.id === missionId);
      result = found || null;
    }

    if (result) {
      this.dbCache.set(cacheKey, result, 30000);
    }
    return result;
  }

  async saveMission(mission: Mission): Promise<Mission> {
    mission.user_id = this.validateTenantId(mission.user_id);
    mission.updated_at = new Date().toISOString();
    if (!mission.id) {
      mission.id = 'mission_' + Math.random().toString(36).substring(2, 11);
    }
    let result: Mission;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('missions')
        .upsert(mission)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const idx = this.cache.missions.findIndex(m => m.user_id === mission.user_id && m.id === mission.id);
      if (idx >= 0) {
        this.cache.missions[idx] = mission;
      } else {
        this.cache.missions.push(mission);
      }
      this.saveLocalDb();
      result = mission;
    }

    // Sync to workspace db/missions.json
    const allTenantMissions = await this.getMissions(mission.user_id);
    this.writeTenantDbFile(mission.user_id || 'default_user', 'missions.json', { missions: allTenantMissions });

    // Sync planning and execution artifacts into workspace/<type>/<mission_id>/
    try {
      const { syncMissionWorkspaceArtifacts } = await import('../harness.js');
      syncMissionWorkspaceArtifacts(result);
    } catch {
      // ignore if harness import fails
    }

    this.dbCache.clear();
    return result;
  }

  async deleteMission(userId: string, missionId: string): Promise<boolean> {
    let success = false;
    if (this.useSupabase) {
      const { error } = await this.supabaseClient
        .from('missions')
        .delete()
        .eq('user_id', userId)
        .eq('id', missionId);
      if (error) throw error;
      success = true;
    } else {
      const initialLen = this.cache.missions.length;
      this.cache.missions = this.cache.missions.filter(m => !(m.user_id === userId && m.id === missionId));
      this.saveLocalDb();
      success = this.cache.missions.length < initialLen;
    }

    this.dbCache.clear();
    
    // Sync updated missions list and clean missions folder
    try {
      const { syncMissionsDb } = await import('../harness.js');
      for (const dirName of ['missions', 'workspace']) {
        const targetDir = path.join(process.cwd(), 'workspaces', userId, dirName);
        if (fs.existsSync(targetDir)) {
          const types = fs.readdirSync(targetDir);
          for (const t of types) {
            const mPath = path.join(targetDir, t, missionId);
            if (fs.existsSync(mPath)) {
              fs.rmSync(mPath, { recursive: true, force: true });
            }
          }
        }
      }
      syncMissionsDb(userId);
    } catch (_) {}

    const remainingMissions = await this.getMissions(userId);
    this.writeTenantDbFile(userId || 'default_user', 'missions.json', { missions: remainingMissions });
    return success;
  }

  async clearAllMissions(userId?: string): Promise<boolean> {
    if (this.useSupabase) {
      let query = this.supabaseClient.from('missions').delete();
      if (userId) {
        query = query.eq('user_id', userId);
      } else {
        query = query.neq('id', '');
      }
      const { error } = await query;
      if (error) throw error;
    } else {
      if (userId) {
        this.cache.missions = this.cache.missions.filter(m => m.user_id !== userId);
        this.writeTenantDbFile(userId, 'missions.json', { missions: [] });
      } else {
        this.cache.missions = [];
        const allUsers = await this.getAllUsers();
        for (const u of allUsers) {
          this.writeTenantDbFile(u, 'missions.json', { missions: [] });
        }
      }
      this.saveLocalDb();
    }

    this.dbCache.clear();
    return true;
  }

  // TOOLS CRUD
  async getTools(userId?: string): Promise<Tool[]> {
    const cacheKey = userId ? `tools:${userId}` : 'tools:all';
    const cached = this.dbCache.get<Tool[]>(cacheKey);
    if (cached) return cached;

    let result: Tool[];
    if (this.useSupabase) {
      let queryBuilder = this.supabaseClient.from('tools').select('*');
      if (userId) {
        queryBuilder = queryBuilder.or(`user_id.is.null,user_id.eq.${userId}`);
      }
      const { data, error } = await queryBuilder;
      if (error) throw error;
      result = data || [];
    } else {
      if (userId) {
        result = this.cache.tools.filter(t => !t.user_id || t.user_id === userId);
      } else {
        result = this.cache.tools;
      }
    }

    this.dbCache.set(cacheKey, result, 60000); // Tools are highly stable, cache for 1 minute
    return result;
  }

  async saveTool(tool: Tool): Promise<Tool> {
    if (!tool.id) {
      tool.id = 'tool_' + Math.random().toString(36).substring(2, 11);
    }
    let result: Tool;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('tools')
        .upsert(tool)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const idx = this.cache.tools.findIndex(t => t.id === tool.id);
      if (idx >= 0) {
        this.cache.tools[idx] = tool;
      } else {
        this.cache.tools.push(tool);
      }
      this.saveLocalDb();
      result = tool;
    }

    this.dbCache.delete('tools:all');
    if (tool.user_id) {
      this.dbCache.delete(`tools:${tool.user_id}`);
    }
    return result;
  }

  async deleteTool(toolId: string): Promise<boolean> {
    let success = false;
    if (this.useSupabase) {
      const { error } = await this.supabaseClient
        .from('tools')
        .delete()
        .eq('id', toolId);
      if (error) throw error;
      success = true;
    } else {
      const initialLen = this.cache.tools.length;
      this.cache.tools = this.cache.tools.filter(t => t.id !== toolId);
      this.saveLocalDb();
      success = this.cache.tools.length < initialLen;
    }

    this.dbCache.clear(); // Safely invalidate all tools caches
    return success;
  }

  // RAW_DATA CRUD
  async getRawDataList(userId: string): Promise<RawData[]> {
    const cacheKey = `raw_data:${userId}`;
    const cached = this.dbCache.get<RawData[]>(cacheKey);
    if (cached) return cached;

    let result: RawData[];
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('raw_data')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      result = data || [];
    } else {
      const memoryRaw = this.cache.raw_data.filter(r => r.user_id === userId);
      const diskRaw: RawData[] = [];
      const userProjectsDir = path.join(process.cwd(), 'workspaces', userId, 'projects');
      if (fs.existsSync(userProjectsDir)) {
        try {
          const projs = fs.readdirSync(userProjectsDir);
          for (const pName of projs) {
            const dataDir = path.join(userProjectsDir, pName, 'data');
            if (fs.existsSync(dataDir)) {
              const files = fs.readdirSync(dataDir);
              for (const f of files) {
                if (f.startsWith('.')) continue;
                const filePath = path.join(dataDir, f);
                let content = '';
                try { content = fs.readFileSync(filePath, 'utf8'); } catch {}
                diskRaw.push({
                  id: `raw_${pName}_${f.replace(/[^a-zA-Z0-9]/g, '_')}`,
                  user_id: userId,
                  name: f,
                  mime_type: f.endsWith('.json') ? 'application/json' : f.endsWith('.csv') ? 'text/csv' : 'text/plain',
                  content,
                  metadata: { project_name: pName, project: pName, status: 'active' }
                });
              }
            }
          }
        } catch {}
      }
      const map = new Map<string, RawData>();
      for (const r of diskRaw) { if (r.id) map.set(r.id, r); }
      for (const r of memoryRaw) { if (r.id) map.set(r.id, r); }
      result = Array.from(map.values());
    }

    this.dbCache.set(cacheKey, result, 30000);
    return result;
  }

  async saveRawData(rawData: RawData): Promise<RawData> {
    rawData.user_id = this.validateTenantId(rawData.user_id);
    if (!rawData.id) {
      rawData.id = 'raw_' + Math.random().toString(36).substring(2, 11);
    }
    let result: RawData;
    if (this.useSupabase) {
      const { data, error } = await this.supabaseClient
        .from('raw_data')
        .upsert(rawData)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const idx = this.cache.raw_data.findIndex(r => r.user_id === rawData.user_id && r.id === rawData.id);
      if (idx >= 0) {
        this.cache.raw_data[idx] = rawData;
      } else {
        this.cache.raw_data.push(rawData);
      }
      this.saveLocalDb();
      result = rawData;
    }

    this.dbCache.delete(`raw_data:${rawData.user_id}`);
    return result;
  }

  async deleteRawData(userId: string, rawDataId: string): Promise<boolean> {
    let success = false;
    if (this.useSupabase) {
      const { error } = await this.supabaseClient
        .from('raw_data')
        .delete()
        .eq('user_id', userId)
        .eq('id', rawDataId);
      if (error) throw error;
      success = true;
    } else {
      const initialLen = this.cache.raw_data.length;
      this.cache.raw_data = this.cache.raw_data.filter(r => !(r.user_id === userId && r.id === rawDataId));
      this.saveLocalDb();
      success = this.cache.raw_data.length < initialLen;
    }

    this.dbCache.delete(`raw_data:${userId}`);
    return success;
  }

  // ARTIFACTS / SYSTEM_COMPONENTS CRUD
  async getArtifacts(userId: string): Promise<Artifact[]> {
    const cacheKey = `artifacts:${userId}`;
    const cached = this.dbCache.get<Artifact[]>(cacheKey);
    if (cached) return cached;

    let result: Artifact[];
    if (this.useSupabase) {
      let data: any[] | null = null;
      let error: any = null;
      try {
        const res = await this.supabaseClient.from('artifacts').select('*').eq('user_id', userId);
        data = res.data;
        error = res.error;
      } catch {
        const res = await this.supabaseClient.from('system_components').select('*').eq('user_id', userId);
        data = res.data;
        error = res.error;
      }
      if (error && !data) throw error;
      result = (data || []).map(item => ({
        ...item,
        artifact_type: item.artifact_type || item.metadata?.artifact_type || 'codebase'
      }));
    } else {
      const memorySys = this.cache.system_components.filter(s => s.user_id === userId);
      const diskSys: Artifact[] = [];
      const userProjectsDir = path.join(process.cwd(), 'workspaces', userId, 'projects');
      if (fs.existsSync(userProjectsDir)) {
        try {
          const projs = fs.readdirSync(userProjectsDir);
          for (const pName of projs) {
            // Check both artifacts/ and legacy systems/
            const dirsToScan = [
              { dirPath: path.join(userProjectsDir, pName, 'artifacts'), isLegacy: false },
              { dirPath: path.join(userProjectsDir, pName, 'systems'), isLegacy: true }
            ];

            for (const { dirPath } of dirsToScan) {
              if (fs.existsSync(dirPath)) {
                const items = fs.readdirSync(dirPath);
                for (const item of items) {
                  if (item.startsWith('.')) continue;
                  const itemPath = path.join(dirPath, item);
                  const stat = fs.statSync(itemPath);
                  let code_snapshot = '';
                  let fileTitle = item;
                  let detectedType: ArtifactType = 'codebase';

                  if (stat.isFile()) {
                    try { code_snapshot = fs.readFileSync(itemPath, 'utf8'); } catch {}
                    if (item.endsWith('.md') || item.endsWith('.txt')) {
                      detectedType = item.toLowerCase().includes('plan') ? 'plan' : 'document';
                    } else if (item.endsWith('.yaml') || item.endsWith('.yml') || item.endsWith('.json')) {
                      detectedType = 'workflow';
                    } else if (item.endsWith('.spec.ts') || item.endsWith('.schema.ts')) {
                      detectedType = 'spec';
                    }
                  } else if (stat.isDirectory()) {
                    const subFiles = fs.readdirSync(itemPath);
                    for (const sub of subFiles) {
                      if (sub.endsWith('.ts') || sub.endsWith('.js') || sub.endsWith('.json') || sub.endsWith('.md')) {
                        try { code_snapshot = fs.readFileSync(path.join(itemPath, sub), 'utf8'); } catch {}
                        fileTitle = `${item}/${sub}`;
                        if (sub.endsWith('.md')) detectedType = 'document';
                        break;
                      }
                    }
                  }

                  diskSys.push({
                    id: `art_${pName}_${item.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    user_id: userId,
                    name: fileTitle,
                    role: 'service',
                    artifact_type: detectedType,
                    code_snapshot,
                    metadata: { project_name: pName, project: pName, artifact_type: detectedType, status: 'active' }
                  });
                }
              }
            }
          }
        } catch {}
      }
      const map = new Map<string, Artifact>();
      for (const s of diskSys) { if (s.id) map.set(s.id, s); }
      for (const s of memorySys) { if (s.id) map.set(s.id, s); }
      result = Array.from(map.values());
    }

    this.dbCache.set(cacheKey, result, 30000);
    return result;
  }

  async getSystemComponents(userId: string): Promise<SystemComponent[]> {
    return this.getArtifacts(userId);
  }

  async saveArtifact(art: Artifact): Promise<Artifact> {
    art.user_id = this.validateTenantId(art.user_id);
    if (!art.id) {
      art.id = 'art_' + Math.random().toString(36).substring(2, 11);
    }
    if (!art.artifact_type) {
      art.artifact_type = art.metadata?.artifact_type || 'codebase';
    }
    let result: Artifact;
    if (this.useSupabase) {
      let data: any = null;
      let error: any = null;
      try {
        const res = await this.supabaseClient.from('artifacts').upsert(art).select().single();
        data = res.data;
        error = res.error;
      } catch {
        const res = await this.supabaseClient.from('system_components').upsert(art).select().single();
        data = res.data;
        error = res.error;
      }
      if (error && !data) throw error;
      result = data || art;
    } else {
      const idx = this.cache.system_components.findIndex(s => s.user_id === art.user_id && s.id === art.id);
      if (idx >= 0) {
        this.cache.system_components[idx] = art;
      } else {
        this.cache.system_components.push(art);
      }
      this.saveLocalDb();
      result = art;
    }

    this.dbCache.delete(`artifacts:${art.user_id}`);
    this.dbCache.delete(`system_components:${art.user_id}`);
    return result;
  }

  async saveSystemComponent(comp: SystemComponent): Promise<SystemComponent> {
    return this.saveArtifact(comp);
  }

  async deleteArtifact(userId: string, artId: string): Promise<boolean> {
    let success = false;
    if (this.useSupabase) {
      try {
        await this.supabaseClient.from('artifacts').delete().eq('user_id', userId).eq('id', artId);
      } catch {}
      const { error } = await this.supabaseClient
        .from('system_components')
        .delete()
        .eq('user_id', userId)
        .eq('id', artId);
      if (error) throw error;
      success = true;
    } else {
      const initialLen = this.cache.system_components.length;
      this.cache.system_components = this.cache.system_components.filter(s => !(s.user_id === userId && s.id === artId));
      this.saveLocalDb();
      success = this.cache.system_components.length < initialLen;
    }

    this.dbCache.delete(`artifacts:${userId}`);
    this.dbCache.delete(`system_components:${userId}`);
    return success;
  }

  async deleteSystemComponent(userId: string, compId: string): Promise<boolean> {
    return this.deleteArtifact(userId, compId);
  }
}

export const db = new DatabaseEngine();
