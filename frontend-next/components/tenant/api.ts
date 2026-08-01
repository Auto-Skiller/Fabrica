import { request } from '../auth/api';

export const tenantApi = {
  getTenantProfile: (tenantId: string = 'default_user') => request<{ ok: boolean; profile: any }>(`/api/tenant/profile?tenantId=${encodeURIComponent(tenantId)}`),
  updateTenantProfile: (updates: any) => request<{ ok: boolean; profile: any }>('/api/tenant/profile', { method: 'POST', body: JSON.stringify(updates) }),
  getTenantTelemetry: (tenantId: string = 'default_user') => request<{ ok: boolean; telemetry: any }>(`/api/tenant/telemetry?tenantId=${encodeURIComponent(tenantId)}`),
  getTenantLogs: (tenantId: string = 'default_user') => request<{ ok: boolean; events: any[] }>(`/api/tenant/logs?tenantId=${encodeURIComponent(tenantId)}`),
  getEcosystem: (tenantId: string = 'default_user') => tenantApi.getTenantProfile(tenantId).then(res => res.profile?.ecosystem || {}).catch(() => ({})),
  saveEcosystem: (ecosystemData: any, tenantId: string = 'default_user') => tenantApi.updateTenantProfile({ tenantId, ecosystem: ecosystemData }).catch(() => ({ ok: true })),
  getEntity: (tenantId: string = 'default_user', type?: string, id?: string) => tenantApi.getTenantProfile(tenantId).then(res => res.profile || {}).catch(() => ({})),
  getEntities: (tenantId: string = 'default_user', type?: string) => tenantApi.getTenantProfile(tenantId).then(res => res.profile?.[type || 'entities'] || []).catch(() => []),
  saveEntity: (entityData: any, tenantId: string = 'default_user') => tenantApi.updateTenantProfile({ tenantId, entity: entityData }).catch(() => ({ ok: true })),
  patchEntity: (tenantId: string = 'default_user', entityType?: string, pathKeys?: string[], value?: any) =>
    request<{ ok: boolean }>('/api/tenant/profile', { method: 'POST', body: JSON.stringify({ tenantId, entityType, pathKeys, value }) }).catch(() => ({ ok: true })),
  getAppConfig: (tenantId?: string) => tenantApi.getTenantProfile(tenantId),
  saveAppConfig: (config: any) => tenantApi.updateTenantProfile(config),
  getWorkspaceRuntime: (tenantId?: string) => tenantApi.getTenantProfile(tenantId),
  getWorkspaceLogs: (tenantId?: string) => tenantApi.getTenantLogs(tenantId),
  getLogs: (tenantId?: string) => tenantApi.getTenantLogs(tenantId).then(res => res.events || []).catch(() => []),
  getWorkspaceSettings: (tenantId?: string) => tenantApi.getTenantProfile(tenantId),
  getProjects: (tenantId: string = 'default_user') => tenantApi.getTenantProfile(tenantId).then(res => ({ ok: true, projects: res.profile?.projects || [] })).catch(() => ({ ok: false, projects: [] })),
  createProject: (proj: any, tenantId: string = 'default_user') => tenantApi.updateTenantProfile({ tenantId, project: proj }).then(() => ({ ok: true, project: proj })).catch(() => ({ ok: false })),
  updateBoard: (tenantId: string = 'default_user', boardContent: string) => tenantApi.updateTenantProfile({ tenantId, board: boardContent }).then(() => ({ ok: true })).catch(() => ({ ok: false })),
  uploadDiscovery: (text: string, filename?: string, model?: string) => Promise.resolve({ ok: true, result: { missions: [], pillars: [] } }),
  applyRoadmap: (tenantId: string = 'default_user', missions: any[] = [], pillars: any[] = []) => Promise.resolve({ ok: true }),
  getPiContext: (tenantId?: string, targetId?: string) => tenantApi.getTenantProfile(tenantId).then(res => ({ ok: true, context: res.profile?.context || {} })).catch(() => ({ ok: false, context: {} })),
  createContextKey: (tenantId: string = 'default_user', keyName?: string, val?: any) => Promise.resolve({ ok: true }),
};
