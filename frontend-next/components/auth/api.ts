import { supabase } from './supabase';

const BASE_URL = '';

export function getActiveTenantId(): string {
  if (typeof window === 'undefined') return 'usr_default';
  
  const activeEntity = localStorage.getItem('fabrica_active_entity');
  if (activeEntity && activeEntity.trim() && activeEntity !== 'default_user') {
    return activeEntity.trim();
  }

  const userId = localStorage.getItem('fabrica_user_id');
  if (userId && userId.trim() && userId !== 'default_user') {
    return userId.trim();
  }

  const sbAuth = localStorage.getItem('sb-pmcnripjowwvtncgflpc-auth-token');
  if (sbAuth) {
    try {
      const parsed = JSON.parse(sbAuth);
      if (parsed?.user?.id) {
        localStorage.setItem('fabrica_user_id', parsed.user.id);
        localStorage.setItem('fabrica_active_entity', parsed.user.id);
        return parsed.user.id;
      }
    } catch (_) {}
  }

  const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  localStorage.setItem('fabrica_user_id', newUserId);
  localStorage.setItem('fabrica_active_entity', newUserId);
  return newUserId;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const tenantId = getActiveTenantId();
  
  const authHeaders: Record<string, string> = {
    'x-tenant-id': tenantId,
    'x-user-id': tenantId,
  };
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
        authHeaders['x-tenant-id'] = session.user.id;
        authHeaders['x-user-id'] = session.user.id;
      }
    } catch (e) {
      console.warn('[auth-api] Failed to fetch active Supabase auth session:', e);
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

export const authApi = {
  getTier: (tenantId: string = 'default_user') => request<{ ok: boolean; tier: any }>(`/api/auth/tier?tenantId=${encodeURIComponent(tenantId)}`),
  getQuota: (tenantId: string = 'default_user') => request<{ ok: boolean; quota: any }>(`/api/auth/quota?tenantId=${encodeURIComponent(tenantId)}`),
  verifyCard: (cardLast4?: string, provider?: string) => request<{ ok: boolean; tier: any }>('/api/auth/verify-card', { method: 'POST', body: JSON.stringify({ cardLast4, provider }) }),
  updateByok: (customApiKey: string, customProvider?: string) => request<{ ok: boolean; tier: any }>('/api/auth/byok', { method: 'POST', body: JSON.stringify({ customApiKey, customProvider }) }),
  getKeyPool: () => request<{ ok: boolean; status: any; keys: any[]; freeModels: any[] }>('/api/auth/key-pool'),
  addKeyPoolItem: (key: string, provider: string, label?: string) => request<{ ok: boolean; keyItem: any }>('/api/auth/key-pool/add', { method: 'POST', body: JSON.stringify({ key, provider, label }) }),
  removeKeyPoolItem: (id: string) => request<{ ok: boolean }>('/api/auth/key-pool/remove', { method: 'POST', body: JSON.stringify({ id }) }),
  getProvidersConfig: () => request<{ ok: boolean; status?: any; keys?: any[]; freeModels?: any[] }>('/api/auth/key-pool').then(res => ({ ok: true, providers: {}, keys: res.keys || [] })),
  getProviders: () => request<{ ok: boolean; status?: any; keys?: any[]; freeModels?: any[] }>('/api/auth/key-pool').then(res => ({ ok: true, providers: {} })),
};
