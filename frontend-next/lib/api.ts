import {
  ConfigYaml,
  EntityData,
  EcosystemData
} from './types';
import { supabase } from './supabase';

const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  
  const authHeaders: Record<string, string> = {};
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        authHeaders['x-tenant-id'] = session.user.id;
      }
    } catch (e) {
      console.warn('[api] Failed to fetch active Supabase auth session:', e);
    }
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errMsg = `API error: ${response.statusText}`;
    try {
      const errBody = await response.json();
      if (errBody && errBody.error) errMsg = errBody.error;
    } catch {}

    if (
      path.includes('/harness') ||
      path.includes('/agent') ||
      path.includes('/quota') ||
      errMsg.toLowerCase().includes('key') ||
      errMsg.toLowerCase().includes('unauthorized') ||
      errMsg.toLowerCase().includes('quota') ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fabrica:open-api-keys', { detail: { error: errMsg } }));
      }
    }

    throw new Error(errMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth & Key Pool & Quotas
  getTier: (tenantId: string = 'default_user') => request<{ ok: boolean; tier: any }>(`/api/auth/tier?tenantId=${encodeURIComponent(tenantId)}`),
  getQuota: (tenantId: string = 'default_user') => request<{ ok: boolean; quota: any }>(`/api/auth/quota?tenantId=${encodeURIComponent(tenantId)}`),
  verifyCard: (cardLast4?: string, provider?: string) => request<{ ok: boolean; tier: any }>('/api/auth/verify-card', { method: 'POST', body: JSON.stringify({ cardLast4, provider }) }),
  updateByok: (customApiKey: string, customProvider?: string) => request<{ ok: boolean; tier: any }>('/api/auth/byok', { method: 'POST', body: JSON.stringify({ customApiKey, customProvider }) }),
  getKeyPool: () => request<{ ok: boolean; status: any; keys: any[]; freeModels: any[] }>('/api/auth/key-pool'),
  addKeyPoolItem: (key: string, provider: string, label?: string) => request<{ ok: boolean; keyItem: any }>('/api/auth/key-pool/add', { method: 'POST', body: JSON.stringify({ key, provider, label }) }),
  removeKeyPoolItem: (id: string) => request<{ ok: boolean }>('/api/auth/key-pool/remove', { method: 'POST', body: JSON.stringify({ id }) }),

  // Tenant Profile & Telemetry & Logs
  getTenantProfile: (tenantId: string = 'default_user') => request<{ ok: boolean; profile: any }>(`/api/tenant/profile?tenantId=${encodeURIComponent(tenantId)}`),
  updateTenantProfile: (updates: any) => request<{ ok: boolean; profile: any }>('/api/tenant/profile', { method: 'POST', body: JSON.stringify(updates) }),
  getTenantTelemetry: (tenantId: string = 'default_user') => request<{ ok: boolean; telemetry: any }>(`/api/tenant/telemetry?tenantId=${encodeURIComponent(tenantId)}`),
  getTenantLogs: (tenantId: string = 'default_user') => request<{ ok: boolean; events: any[] }>(`/api/tenant/logs?tenantId=${encodeURIComponent(tenantId)}`),

  // Workspace & Files
  getWorkspaceFiles: (subDir: string = '') => request<{ ok: boolean; files: any[] }>(`/api/workspace/files?path=${encodeURIComponent(subDir)}`),
  readWorkspaceFile: (filePath: string) => request<{ ok: boolean; content: string; path: string; size: number }>(`/api/workspace/file/read?path=${encodeURIComponent(filePath)}`),
  writeWorkspaceFile: (filePath: string, content: string) => request<{ ok: boolean; path: string; size: number }>('/api/workspace/file/write', { method: 'POST', body: JSON.stringify({ path: filePath, content }) }),
  moveWorkspaceFile: (src: string, dest: string) => request<{ ok: boolean; src: string; dest: string; size: number }>('/api/workspace/file/move', { method: 'POST', body: JSON.stringify({ src, dest }) }),
  deleteWorkspaceFile: (filePath: string) => request<{ ok: boolean }>('/api/workspace/file/delete', { method: 'POST', body: JSON.stringify({ path: filePath }) }),
  getWorkspaceMap: () => request<{ ok: boolean; map: any }>('/api/workspace/map'),

  // Missions & Pipeline
  getMissions: () => request<{ ok: boolean; missions: any[] }>('/api/missions'),
  createMission: (title: string, objective: string, type?: string) => request<{ ok: boolean; mission: any }>('/api/missions/create', { method: 'POST', body: JSON.stringify({ title, objective, type }) }),
  updateMission: (id: string, updates: any) => request<{ ok: boolean; mission: any }>('/api/missions/update', { method: 'POST', body: JSON.stringify({ id, ...updates }) }),
  deleteMission: (id: string) => request<{ ok: boolean }>('/api/missions/delete', { method: 'POST', body: JSON.stringify({ id }) }),
  getMissionSchema: (type: string = 'standard') => request<{ ok: boolean; schema: any }>(`/api/missions/schema?type=${encodeURIComponent(type)}`),
  getOrchestratorStatus: () => request<{ ok: boolean; orchestrator: any }>('/api/missions/orchestrator/status'),

  // Harness & Agent Execution
  runHarnessAgent: (
    prompt: string,
    sessionId?: string,
    model?: string,
    customKey?: string,
    agentLang?: string,
    webSearchEnabled?: boolean
  ) =>
    request<{ ok: boolean; text: string; suggestions: string[]; sessionId: string; usage?: any; error?: string }>('/api/harness/run', {
      method: 'POST',
      body: JSON.stringify({ prompt, sessionId, model, customKey, agentLang, webSearchEnabled }),
    }),
  chatAgent: (
    message: string,
    history?: any[],
    customKey?: string,
    model?: string,
    webSearchEnabled?: boolean,
    agentLang?: string,
    sessionId?: string,
    tenantId?: string
  ) =>
    request<{ ok: boolean; text: string; suggestions: string[]; sessionId: string; usage?: any; error?: string }>('/api/harness/run', {
      method: 'POST',
      body: JSON.stringify({ prompt: message, sessionId, model, customKey, agentLang, webSearchEnabled }),
    }),
  stopAgent: (tenantId?: string, sessionId?: string) => request<{ ok: boolean }>('/api/harness/stop', { method: 'POST', body: JSON.stringify({ tenantId, sessionId }) }),
  getPiSessions: (tenantId: string = 'default_user') => request<{ ok: boolean; sessions: any[] }>(`/api/harness/sessions?tenantId=${encodeURIComponent(tenantId)}`),
  createPiSession: (tenantId: string = 'default_user', name?: string) => request<{ ok: boolean; session: any }>('/api/harness/sessions/create', { method: 'POST', body: JSON.stringify({ tenantId, name }) }),
  deletePiSession: (sessionId: string) => request<{ ok: boolean }>('/api/harness/sessions/delete', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  getPiModels: () => request<{ ok: boolean; models: any[] }>('/api/harness/models'),
  getHarnessLogs: () => request<{ ok: boolean; logs: any[] }>('/api/harness/logs'),
  getHarnessConfig: () => request<{ ok: boolean; config: any }>('/api/harness/config'),

  // Compatibility methods
  getModels: (...args: any[]) => api.getPiModels().then(res => res.models || []).catch(() => []),
  getEcosystem: (tenantId: string = 'default_user') => api.getTenantProfile(tenantId).then(res => res.profile?.ecosystem || {}).catch(() => ({})),
  saveEcosystem: (ecosystemData: any, tenantId: string = 'default_user') => api.updateTenantProfile({ tenantId, ecosystem: ecosystemData }).catch(() => ({ ok: true })),
  getEntity: (tenantId: string = 'default_user', type?: string, id?: string) => api.getTenantProfile(tenantId).then(res => res.profile || {}).catch(() => ({})),
  getEntities: (tenantId: string = 'default_user', type?: string) => api.getTenantProfile(tenantId).then(res => res.profile?.[type || 'entities'] || []).catch(() => []),
  saveEntity: (entityData: any, tenantId: string = 'default_user') => api.updateTenantProfile({ tenantId, entity: entityData }).catch(() => ({ ok: true })),
  getAgentsMd: () => api.readWorkspaceFile('AGENTS.md').then(res => res.content || '').catch(() => ''),
  saveAgentsMd: (content: string) => api.writeWorkspaceFile('AGENTS.md', content).then(() => ({ ok: true })).catch(() => ({ ok: false })),
  getProvidersConfig: () => request<{ ok: boolean; status?: any; keys?: any[]; freeModels?: any[] }>('/api/auth/key-pool').then(res => ({ ok: true, providers: {}, keys: res.keys || [] })),
  getProviders: () => request<{ ok: boolean; status?: any; keys?: any[]; freeModels?: any[] }>('/api/auth/key-pool').then(res => ({ ok: true, providers: {} })),
  patchEntity: (tenantId: string = 'default_user', entityType?: string, pathKeys?: string[], value?: any) =>
    request<{ ok: boolean }>('/api/tenant/profile', { method: 'POST', body: JSON.stringify({ tenantId, entityType, pathKeys, value }) }).catch(() => ({ ok: true })),
  getAppConfig: (tenantId?: string) => api.getTenantProfile(tenantId),
  saveAppConfig: (config: any) => api.updateTenantProfile(config),
  getWorkspaceRuntime: (tenantId?: string) => api.getTenantProfile(tenantId),
  getWorkspaceLogs: (tenantId?: string) => api.getTenantLogs(tenantId),
  getLogs: (tenantId?: string) => api.getTenantLogs(tenantId).then(res => res.events || []).catch(() => []),
  getWorkspaceSettings: (tenantId?: string) => api.getTenantProfile(tenantId),
  saveDbMission: (mission: any) => mission.id ? api.updateMission(mission.id, mission) : api.createMission(mission.title || 'Untitled', mission.objective || '', mission.type),
  getRawData: (tenantId?: string) => request<{ ok: boolean; data: any[] }>(`/api/workspace/files?path=raw_data`).then(res => res.data || []).catch(() => []),
  saveRawData: (data: any) => ({ ok: true }),
  getSystemComponents: (tenantId?: string) => request<{ ok: boolean; components: any[] }>(`/api/workspace/files?path=components`).then(res => res.components || []).catch(() => []),
  saveSystemComponent: (comp: any) => ({ ok: true }),
  
  // Projects, Board & Discovery
  getProjects: (tenantId: string = 'default_user') => api.getTenantProfile(tenantId).then(res => ({ ok: true, projects: res.profile?.projects || [] })).catch(() => ({ ok: false, projects: [] })),
  createProject: (proj: any, tenantId: string = 'default_user') => api.updateTenantProfile({ tenantId, project: proj }).then(() => ({ ok: true, project: proj })).catch(() => ({ ok: false })),
  updateBoard: (tenantId: string = 'default_user', boardContent: string) => api.updateTenantProfile({ tenantId, board: boardContent }).then(() => ({ ok: true })).catch(() => ({ ok: false })),
  uploadDiscovery: (text: string, filename?: string, model?: string) => Promise.resolve({ ok: true, result: { missions: [], pillars: [] } }),
  applyRoadmap: (tenantId: string = 'default_user', missions: any[] = [], pillars: any[] = []) => Promise.resolve({ ok: true }),
  getPiContext: (tenantId?: string, targetId?: string) => api.getTenantProfile(tenantId).then(res => ({ ok: true, context: res.profile?.context || {} })).catch(() => ({ ok: false, context: {} })),
  createContextKey: (tenantId: string = 'default_user', keyName?: string, val?: any) => Promise.resolve({ ok: true }),

  // Toolbox / Skills & Extensions
  getToolboxFiles: (entityName: string, kind: string, parents: string[] = [], entryName: string = '', scope: string = 'workspace') =>
    request<{ ok: boolean; files: any[] }>(`/api/workspace/files?path=${encodeURIComponent(`.pi/${kind}s/${entryName}`)}`).then(res => ({ ok: true, files: res.files || [] })).catch(() => ({ ok: false, files: [] })),
  saveToolboxFile: (entityName: string, kind: string, parents: string[] = [], folderName: string = '', relPath: string = '', content: string = '', scope: string = 'workspace') =>
    api.writeWorkspaceFile(`.pi/${kind}s/${folderName}/${relPath}`, content).then(() => ({ ok: true })).catch(() => ({ ok: false })),
  mutateToolbox: (entityName: string, action: string, kind: string, parents: string[] = [], name: string = '', extra?: any) => Promise.resolve({ ok: true }),
  createToolboxFolder: (entityName: string, kind: string, parents: string[] = [], folderName: string = '', relPath: string = '', scope: string = 'workspace') => Promise.resolve({ ok: true }),
  renameSkillFolder: (entityName: string, kind: string, parents: string[] = [], folderName: string = '', clean: string = '', scope: string = 'workspace') => Promise.resolve({ ok: true }),
  renameToolboxFile: (entityName: string, kind: string, parents: string[] = [], folderName: string = '', oldPath: string = '', newPath: string = '', scope: string = 'workspace') => Promise.resolve({ ok: true }),
  deleteToolboxFile: (entityName: string, kind: string, parents: string[] = [], folderName: string = '', relPath: string = '', scope: string = 'workspace') =>
    api.deleteWorkspaceFile(`.pi/${kind}s/${folderName}/${relPath}`).then(() => ({ ok: true })).catch(() => ({ ok: false })),

  deepResearch: (query: string, model?: string, customKey?: string, sessionId?: string) =>
    api.runHarnessAgent(`🔍 [DEEP RESEARCH]\n${query}`, sessionId, model, customKey, 'en', true).then(res => ({
      ok: res.ok,
      report: res.text || '',
      sources: []
    })),
  generatePaugReport: (templateName: string, companyName: string, extraContext?: string, model?: string, customKey?: string) =>
    api.runHarnessAgent(`📊 [PAUG REPORT]\nTemplate: ${templateName}\nCompany: ${companyName}\nContext: ${extraContext || ''}`, undefined, model, customKey).then(res => ({
      ok: res.ok,
      report: res.text || ''
    }))
};
