import {
  ConfigYaml,
  EntityData,
  EcosystemData,
  Priority,
  MissionClass
} from './types';
import { supabase } from './supabase';

// In production, the Next.js app is exported as static files and served by the Express server on port 3000.
// Thus, the API calls can be made to the same origin.
const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  
  // Dynamically attach bearer tokens and tenant isolation keys if Supabase Auth is active
  const authHeaders: Record<string, string> = {};
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        // Enforce the backend to map operations to this exact authenticated user_id
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
    } catch {
      // Ignored
    }

    if (
      path.includes('/agent') ||
      path.includes('/context') ||
      path.includes('/discovery') ||
      path.includes('/deep-research') ||
      path.includes('/toolbox') ||
      path.includes('/paug') ||
      errMsg.toLowerCase().includes('key') ||
      errMsg.toLowerCase().includes('unauthorized') ||
      errMsg.toLowerCase().includes('quota') ||
      errMsg.toLowerCase().includes('api') ||
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
  // Config
  getConfig: () => request<ConfigYaml>('/api/config'),
  getAppConfig: (tenantId?: string) => request<any>(`/api/db/app-config?tenantId=${encodeURIComponent(tenantId || 'default_user')}`),
  saveAppConfig: (config: any) =>
    request<any>('/api/db/app-config', {
      method: 'POST',
      body: JSON.stringify(config),
    }),
  getProvidersConfig: () => request<{ gemini: boolean; openrouter: boolean; anthropic: boolean }>('/api/config/providers'),
  getModels: (geminiApiKey?: string, openrouterApiKey?: string, anthropicApiKey?: string, openaiApiKey?: string, groqApiKey?: string, deepseekApiKey?: string) =>
    request<{ ok: boolean; providers: { gemini: any[]; openrouter: any[]; anthropic: any[]; openai: any[]; groq: any[]; deepseek: any[] } }>('/api/config/models', {
      method: 'POST',
      body: JSON.stringify({ geminiApiKey, openrouterApiKey, anthropicApiKey, openaiApiKey, groqApiKey, deepseekApiKey }),
    }),
  getPiSessions: (tenantId: string = 'default_user') =>
    request<{ ok: boolean; tenantId: string; sessions: any[] }>(`/api/pi/sessions?tenantId=${encodeURIComponent(tenantId)}`),
  createPiSession: (tenantId: string = 'default_user', name?: string) =>
    request<{ ok: boolean; tenantId: string; session: any }>('/api/pi/sessions', {
      method: 'POST',
      body: JSON.stringify({ tenantId, name }),
    }),
  deletePiSession: (sessionId: string, tenantId: string = 'default_user') =>
    request<{ ok: boolean; tenantId: string; sessionId: string }>(`/api/pi/sessions/${encodeURIComponent(sessionId)}?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'DELETE',
    }),
  getPiModels: () =>
    request<{ ok: boolean; models: any[] }>('/api/pi/models'),
  getPiContext: (tenantId: string = 'default_user', sessionId?: string) =>
    request<{ ok: boolean; tenantId: string; sessionId: string; tokensUsed: number; maxTokens: number; percentUsed: number; messageCount: number }>(`/api/pi/context?tenantId=${encodeURIComponent(tenantId)}&sessionId=${encodeURIComponent(sessionId || '')}`),
  updateConfig: (path: string[], value: any) =>
    request<{ ok: boolean }>('/api/config', {
      method: 'POST',
      body: JSON.stringify({ path, value }),
    }),

  // Entity Core CRUD
  getEntity: (name: string) => request<EntityData>(`/api/entity/${name}`),
  updateBoard: (name: string, content: string) =>
    request<{ ok: boolean }>(`/api/entity/${name}/board`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  updateToolboxStatus: (name: string, path: string[], status: boolean) =>
    request<{ ok: boolean }>(`/api/entity/${name}/toolboxes`, {
      method: 'POST',
      body: JSON.stringify({ path, status }),
    }),
  mutateToolbox: (
    name: string,
    op: 'create' | 'edit' | 'move' | 'delete',
    kind: 'domain' | 'toolbox' | 'skill' | 'agent',
    parents: string[],
    tbName: string,
    fields?: Record<string, any>
  ) =>
    request<{ ok: boolean }>(`/api/entity/${name}/toolboxes/mutate`, {
      method: 'POST',
      body: JSON.stringify({ op, kind, parents, name: tbName, fields }),
    }),
  patchEntity: (
    entityName: string,
    file: 'runtime' | 'inbox' | 'missions' | 'toolboxes' | 'prompts',
    path: string[],
    value: any,
    op?: 'set' | 'delete'
  ) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/patch`, {
      method: 'POST',
      body: JSON.stringify({ file, path, value, op }),
    }),
  saveDbMission: (mission: any) =>
    request<any>('/api/db/missions', {
      method: 'POST',
      body: JSON.stringify(mission),
    }),

  // Ecosystem
  getEcosystem: () => request<EcosystemData>('/api/ecosystem'),

  // Discovery & Roadmap Ingestion
  uploadDiscovery: (content: string, fileName: string, model?: string, customKey?: string) =>
    request<{ ok: boolean; result: { summary: string; pillars: any[]; missions: any[] } }>(
      '/api/upload-discovery',
      {
        method: 'POST',
        body: JSON.stringify({ content, fileName, model, customKey }),
      }
    ),
  applyRoadmap: (entityName: string, missions: any[], pillars: any[]) =>
    request<{ ok: boolean }>('/api/discovery/apply-roadmap', {
      method: 'POST',
      body: JSON.stringify({ entityName, missions, pillars }),
    }),

  // PAUG Studio (Consulting Reports)
  generatePaugReport: (
    templateName: string,
    companyName: string,
    extraContext?: string,
    model?: string,
    customKey?: string
  ) =>
    request<{ ok: boolean; report: string }>('/api/paug/generate', {
      method: 'POST',
      body: JSON.stringify({ templateName, companyName, extraContext, model, customKey }),
    }),
  exportPaugReport: (
    entityName: string,
    templateName: string,
    companyName: string,
    report: string
  ) =>
    request<{ ok: boolean }>('/api/paug/export', {
      method: 'POST',
      body: JSON.stringify({ entityName, templateName, companyName, report }),
    }),

  // Agent Chat / Boot
  bootAgent: () => request<string[]>('/api/agent/boot', { method: 'POST' }),
  stopAgent: (tenantId?: string, sessionId?: string) =>
    request<{ ok: boolean; stopped: boolean }>('/api/agent/stop', {
      method: 'POST',
      body: JSON.stringify({ tenantId, sessionId }),
    }),
  chatAgent: (
    message: string,
    history: { sender: string; text: string }[],
    customKey?: string,
    model?: string,
    webSearchEnabled?: boolean,
    agentLang?: string,
    sessionId?: string,
    tenantId?: string,
    toolsEnabled?: boolean,
    signal?: AbortSignal
  ) =>
    request<{ ok: boolean; text: string; suggestions: string[]; sessionId?: string; usage?: any }>('/api/agent/chat', {
      method: 'POST',
      signal,
      body: JSON.stringify({ message, history, customKey, model, webSearchEnabled, agentLang, sessionId, tenantId, tools_enabled: toolsEnabled }),
    }),

  // Context Pipeline Ingestion
  distillContext: (
    answers?: { who: string; workaround: string; success: string; musthave: string },
    raw_text?: string,
    customKey?: string,
    model?: string,
    sessionId?: string,
    tenantId?: string
  ) => {
    const prompt = answers
      ? `📋 [CONTEXT DISTILLATION REQUEST]\nPlease distill these PM interview answers into an agent-readable specification:\nWHO: ${answers.who}\nWORKAROUND: ${answers.workaround}\nSUCCESS: ${answers.success}\nMUST-HAVE: ${answers.musthave}`
      : `📋 [SIGNAL DISTILLATION REQUEST]\nPlease convert this user signal text into an agent-readable spec card:\n${raw_text}`;
    return api.chatAgent(prompt, [], customKey, model, false, 'en', sessionId, tenantId, true).then(res => ({
      ok: res.ok,
      spec: res.text || ''
    }));
  },
  validateDiscovery: (feature: string, email?: string, sessionId?: string, tenantId?: string) => {
    const prompt = `🎯 [ROADMAP VALIDATION REQUEST]\nPlease validate interest and technical feasibility for feature "${feature}"${email ? ` (Requested by: ${email})` : ''}. Output validation criteria and actionable implementation steps.`;
    return api.chatAgent(prompt, [], undefined, undefined, false, 'en', sessionId, tenantId, true).then(res => ({
      ok: res.ok,
      total: 1
    }));
  },

  // Toolbox workspace file system and LLM auditing
  getToolboxFiles: (entityName: string, kind: string, parents: string[], entryName: string, source?: string) =>
    request<{ ok: boolean; files: { name: string; path: string; type: 'file' | 'folder'; content?: string }[] }>(
      `/api/entity/${entityName}/toolboxes/files?kind=${kind}&entry_name=${entryName}&parents=${encodeURIComponent(JSON.stringify(parents))}${source ? `&source=${encodeURIComponent(source)}` : ''}`
    ),
  saveToolboxFile: (entityName: string, kind: string, parents: string[], entryName: string, filename: string, content: string, source?: string) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/toolboxes/files`, {
      method: 'POST',
      body: JSON.stringify({ kind, parents, entry_name: entryName, filename, content, source }),
    }),
  deleteToolboxFile: (entityName: string, kind: string, parents: string[], entryName: string, relPath: string, source?: string) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/toolboxes/files/delete`, {
      method: 'POST',
      body: JSON.stringify({ kind, parents, entry_name: entryName, relPath, source }),
    }),
  renameToolboxFile: (entityName: string, kind: string, parents: string[], entryName: string, oldPath: string, newPath: string, source?: string) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/toolboxes/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ kind, parents, entry_name: entryName, oldPath, newPath, source }),
    }),
  createToolboxFolder: (entityName: string, kind: string, parents: string[], entryName: string, folderPath: string, source?: string) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/toolboxes/files/create-folder`, {
      method: 'POST',
      body: JSON.stringify({ kind, parents, entry_name: entryName, folderPath, source }),
    }),
  renameSkillFolder: (entityName: string, kind: string, parents: string[], oldName: string, newName: string, source?: string) =>
    request<{ ok: boolean }>(`/api/entity/${entityName}/toolboxes/files/rename-folder`, {
      method: 'POST',
      body: JSON.stringify({ kind, parents, oldName, newName, source }),
    }),
  auditToolboxFile: (entityName: string, kind: string, entryName: string, filename: string, content: string, description?: string, model?: string, customKey?: string) =>
    request<{ ok: boolean; report: string }>(`/api/entity/${entityName}/toolboxes/files/audit`, {
      method: 'POST',
      body: JSON.stringify({ kind, entry_name: entryName, filename, content, description, model, customKey }),
    }),

  // System Commands
  restartDaemon: () =>
    request<{ ok: boolean }>('/api/command', {
      method: 'POST',
      body: JSON.stringify({ cmd: 'restart_daemon' }),
    }),

  // Deep Research agentic loop (routed via active Pi CLI session)
  deepResearch: (query: string, model?: string, customKey?: string, sessionId?: string, tenantId?: string) => {
    const prompt = `🔍 [DEEP RESEARCH INITIATED]\n\nPlease perform an extensive Deep Research analysis on the following topic:\n"${query}"\n\nDirectives:\n1. Execute real-time web search grounding to gather verified primary source references.\n2. Cross-examine facts, detect domain gaps, and synthesize key insights.\n3. Output a comprehensive, structured Deep Research Report with source citations e.g. [1] (URL).`;
    return api.chatAgent(prompt, [], customKey, model, true, 'en', sessionId, tenantId, true).then(res => ({
      ok: res.ok,
      report: res.text || '',
      sources: [],
      steps: ['1. Deep Research query submitted to active Pi CLI agent session...']
    }));
  },

  // Workspace Directives (AGENTS.md)
  getAgentsMd: () =>
    request<{ ok: boolean; content: string; path: string }>('/api/context/agents-md'),
  saveAgentsMd: (content: string) =>
    request<{ ok: boolean; message: string }>('/api/context/agents-md', {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  // Projects & Multi-Project DB Sync
  getProjects: (tenantId?: string) =>
    request<{ ok: boolean; projects: any[] }>(`/api/db/projects${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`),
  createProject: (projectName: string, tenantId?: string) =>
    request<{ ok: boolean; projects: any[]; projectName: string }>('/api/db/projects', {
      method: 'POST',
      body: JSON.stringify({ projectName, tenantId }),
    }),

  // Workspace DB State (agent-managed runtime.json & read-only settings.json)
  getWorkspaceRuntime: (tenantId?: string) =>
    request<{ ok: boolean; tenantId: string; runtime: any }>(
      `/api/user/${encodeURIComponent(tenantId || 'default_user')}/db/runtime`
    ),
  saveWorkspaceRuntime: (updates: any, tenantId?: string) =>
    request<{ ok: boolean; tenantId: string; runtime: any }>(
      `/api/user/${encodeURIComponent(tenantId || 'default_user')}/db/runtime`,
      {
        method: 'POST',
        body: JSON.stringify(updates),
      }
    ),
  getWorkspaceSettings: (tenantId?: string) =>
    request<{ ok: boolean; tenantId: string; settings: any }>(
      `/api/user/${encodeURIComponent(tenantId || 'default_user')}/db/settings`
    ),
};
