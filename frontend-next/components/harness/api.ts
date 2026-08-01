import { request } from '../auth/api';

export const harnessApi = {
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
  getModels: () => harnessApi.getPiModels().then(res => res.models || []).catch(() => []),

  deepResearch: (query: string, model?: string, customKey?: string, sessionId?: string) =>
    harnessApi.runHarnessAgent(`🔍 [DEEP RESEARCH]\n${query}`, sessionId, model, customKey, 'en', true).then(res => ({
      ok: res.ok,
      report: res.text || '',
      sources: []
    })),
  generatePaugReport: (templateName: string, companyName: string, extraContext?: string, model?: string, customKey?: string) =>
    harnessApi.runHarnessAgent(`📊 [PAUG REPORT]\nTemplate: ${templateName}\nCompany: ${companyName}\nContext: ${extraContext || ''}`, undefined, model, customKey).then(res => ({
      ok: res.ok,
      report: res.text || ''
    }))
};
