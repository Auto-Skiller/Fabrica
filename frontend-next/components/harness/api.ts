import { request } from '../auth/api';

export const harnessApi = {
  runHarnessAgent: (
    prompt: string,
    sessionId?: string,
    model?: string,
    customKey?: string,
    agentLang?: string,
    webSearchEnabled?: boolean,
    thinkingLevel?: string
  ) =>
    request<{ ok: boolean; text: string; suggestions: string[]; sessionId: string; usage?: any; error?: string }>('/api/harness/run', {
      method: 'POST',
      body: JSON.stringify({ prompt, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel }),
    }),
  chatAgent: (
    message: string,
    history?: any[],
    customKey?: string,
    model?: string,
    webSearchEnabled?: boolean,
    agentLang?: string,
    sessionId?: string,
    tenantId?: string,
    isHeartbeat?: boolean,
    signal?: AbortSignal,
    thinkingLevel?: string
  ) =>
    request<{ ok: boolean; text: string; suggestions: string[]; sessionId: string; usage?: any; error?: string }>('/api/harness/run', {
      method: 'POST',
      body: JSON.stringify({ prompt: message, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel }),
      signal
    }),
  chatAgentStream: async (
    message: string,
    history?: any[],
    customKey?: string,
    model?: string,
    webSearchEnabled?: boolean,
    agentLang?: string,
    sessionId?: string,
    tenantId?: string,
    isHeartbeat?: boolean,
    signal?: AbortSignal,
    thinkingLevel?: string,
    onChunk?: (data: any) => void
  ) => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('fabrica_auth_token') || '') : '';
    const res = await fetch('/api/harness/run-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ prompt: message, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel }),
      signal
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, text: text || 'Stream request failed', error: 'HTTP_ERROR' };
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    if (reader) {
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') break;
          try {
            const parsed = JSON.parse(rawData);
            if (onChunk) onChunk(parsed);
            if (parsed.type === 'turn_end' && parsed.message) {
              const content = parsed.message.content;
              if (typeof content === 'string') accumulatedText = content;
              else if (Array.isArray(content)) {
                accumulatedText = content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
              }
            } else if (parsed.text) {
              accumulatedText = parsed.text;
            }
          } catch (_) {}
        }
      }
    }

    return { ok: true, text: accumulatedText || 'Agent response finished', sessionId: sessionId || '' };
  },
  stopAgent: (tenantId?: string, sessionId?: string) => request<{ ok: boolean }>('/api/harness/stop', { method: 'POST', body: JSON.stringify({ tenantId, sessionId }) }),
  getPiSessions: (tenantId: string = 'default_user') => request<{ ok: boolean; sessions: any[] }>(`/api/harness/sessions?tenantId=${encodeURIComponent(tenantId)}`),
  createPiSession: (tenantId: string = 'default_user', name?: string) => request<{ ok: boolean; session: any }>('/api/harness/sessions/create', { method: 'POST', body: JSON.stringify({ tenantId, name }) }),
  deletePiSession: (sessionId: string) => request<{ ok: boolean }>('/api/harness/sessions/delete', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  getPiModels: () => request<{ ok: boolean; models: any[] }>('/api/harness/models'),
  getHarnessLogs: () => request<{ ok: boolean; logs: any[] }>('/api/harness/logs'),
  getKernelSkills: () => request<{ ok: boolean; skills: any[] }>('/api/harness/skills'),
  getHarnessConfig: () => request<{ ok: boolean; config: any }>('/api/harness/config'),
  getHarnessState: (tenantId: string = 'default_user') => request<{ ok: boolean; harness: any }>(`/api/harness/state?tenantId=${encodeURIComponent(tenantId)}`),
  updateHarnessState: (updates: Record<string, any>) => request<{ ok: boolean; harness: any }>('/api/harness/state', { method: 'POST', body: JSON.stringify(updates) }),
  getModels: () => harnessApi.getPiModels().then(res => res.models || []).catch(() => []),
  appendUserAction: (category: string, action: string) =>
    request<{ ok: boolean }>('/api/harness/user-action', { method: 'POST', body: JSON.stringify({ category, action }) }),
  ignoreReviewItem: (itemId: string) =>
    request<{ ok: boolean }>('/api/harness/reviews/ignore', { method: 'POST', body: JSON.stringify({ itemId }) }),
  submitReviewFeedback: (itemId: string, feedback: string) =>
    request<{ ok: boolean }>('/api/harness/reviews/feedback', { method: 'POST', body: JSON.stringify({ itemId, feedback }) }),

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
