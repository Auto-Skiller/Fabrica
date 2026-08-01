import fs from 'fs';
import path from 'path';

// ── Co-Located TypeScript Interfaces ──────────────────────────────────────────

export interface KeyPoolItem {
  id: string;
  key: string;
  provider: 'gemini' | 'openrouter' | 'anthropic' | 'openai';
  modelTarget?: string;
  label?: string;
  isActive: boolean;
  rateLimitedUntil?: number; // Epoch time ms
  usageCount: number;
  errorCount: number;
  lastUsedAt?: string;
  createdAt: string;
}

export interface FreeModelInfo {
  provider: string;
  model: string;
  displayName: string;
  contextWindow: string;
  rateLimitNote: string;
}

export interface UserTierInfo {
  tenantId: string;
  plan: 'free' | 'pro' | 'enterprise';
  hasVerifiedCard: boolean;
  cardVerified?: boolean;
  paymentVerified?: boolean;
  cardLast4?: string;
  monthlyTokenQuota: number;
  usedTokensThisMonth: number;
  remainingTokensThisMonth: number;
  byokEnabled: boolean;
  customApiKey?: string;
  customProvider?: string;
  billingCycleResetDate: string;
}

export interface LlmCreditsInfo {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costEstimateUsd: number;
}

export interface TokenQuotaSummary {
  tenantId: string;
  plan: string;
  monthlyQuota: number;
  usedTokens: number;
  remainingTokens: number;
  usagePercentage: number;
  isQuotaExceeded: boolean;
  requiresCardVerification: boolean;
}

export interface AuthStoreData {
  key_pools: KeyPoolItem[];
  tiers: Record<string, Partial<UserTierInfo>>;
  users: Record<string, any>;
}

// ── Constants & Initial State ──────────────────────────────────────────────────

export const FREE_MODELS: FreeModelInfo[] = [
  {
    provider: 'google',
    model: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash (Complimentary)',
    contextWindow: '1.0M tokens',
    rateLimitNote: 'Shared key pool — Card verification or BYOK recommended for high throughput'
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    contextWindow: '1.0M tokens',
    rateLimitNote: 'High speed, general reasoning'
  },
  {
    provider: 'openrouter',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    displayName: 'Nemotron 3 Ultra (Free)',
    contextWindow: '128K tokens',
    rateLimitNote: 'OpenRouter Free Tier Pool'
  }
];

const AUTH_FILE_PATH = path.resolve(process.cwd(), '.stash/auth.json');
const LEGACY_KEY_POOLS_PATH = path.resolve(process.cwd(), '.stash/key_pools.json');

// Helper to ensure .stash directory exists and load auth store
function ensureAuthStore(): AuthStoreData {
  const stashDir = path.dirname(AUTH_FILE_PATH);
  if (!fs.existsSync(stashDir)) {
    fs.mkdirSync(stashDir, { recursive: true });
  }

  let store: AuthStoreData = { key_pools: [], tiers: {}, users: {} };

  if (fs.existsSync(AUTH_FILE_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE_PATH, 'utf8'));
      store = {
        key_pools: Array.isArray(parsed.key_pools) ? parsed.key_pools : [],
        tiers: parsed.tiers || {},
        users: parsed.users || {}
      };
    } catch (_) {}
  } else if (fs.existsSync(LEGACY_KEY_POOLS_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(LEGACY_KEY_POOLS_PATH, 'utf8'));
      if (Array.isArray(parsed.keys)) {
        store.key_pools = parsed.keys;
      }
    } catch (_) {}
  }

  return store;
}

function saveAuthStore(data: AuthStoreData): void {
  try {
    const stashDir = path.dirname(AUTH_FILE_PATH);
    if (!fs.existsSync(stashDir)) {
      fs.mkdirSync(stashDir, { recursive: true });
    }
    fs.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[AuthCore] Error saving auth store:', err);
  }
}

// ── Key Pool Rotation Engine ───────────────────────────────────────────────────

export class KeyPoolManager {
  private keys: KeyPoolItem[] = [];

  constructor() {
    this.reloadKeys();
  }

  public reloadKeys(): void {
    const store = ensureAuthStore();
    this.keys = store.key_pools;
  }

  public saveKeys(): void {
    const store = ensureAuthStore();
    store.key_pools = this.keys;
    saveAuthStore(store);
  }

  public addKey(item: Omit<KeyPoolItem, 'id' | 'usageCount' | 'errorCount' | 'createdAt'>): KeyPoolItem {
    const newKeyItem: KeyPoolItem = {
      ...item,
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      usageCount: 0,
      errorCount: 0,
      createdAt: new Date().toISOString()
    };
    this.keys.push(newKeyItem);
    this.saveKeys();
    return newKeyItem;
  }

  public removeKey(id: string): boolean {
    const idx = this.keys.findIndex(k => k.id === id);
    if (idx !== -1) {
      this.keys.splice(idx, 1);
      this.saveKeys();
      return true;
    }
    return false;
  }

  public acquireKey(
    provider: 'gemini' | 'openrouter' | 'anthropic' | 'openai',
    tenantId?: string,
    excludeIds: Set<string> = new Set()
  ): KeyPoolItem | null {
    const now = Date.now();
    const availableKeys = this.keys.filter(k => {
      if (!k.isActive) return false;
      if (k.provider !== provider) return false;
      if (excludeIds.has(k.id)) return false;
      if (k.rateLimitedUntil && k.rateLimitedUntil > now) return false;
      return true;
    });

    if (availableKeys.length === 0) return null;

    // Least-Recently-Used / Lowest usage count rotation
    availableKeys.sort((a, b) => {
      if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
      const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return timeA - timeB;
    });

    const selected = availableKeys[0];
    selected.usageCount++;
    selected.lastUsedAt = new Date().toISOString();
    this.saveKeys();
    return selected;
  }

  public markRateLimited(id: string, durationSeconds: number = 60): void {
    const keyItem = this.keys.find(k => k.id === id);
    if (keyItem) {
      keyItem.rateLimitedUntil = Date.now() + durationSeconds * 1000;
      keyItem.errorCount++;
      this.saveKeys();
    }
  }

  public releaseKey(id: string): void {
    // Key returned successfully; updated in saveKeys
  }

  public getAllKeys(): KeyPoolItem[] {
    return this.keys.map(k => ({
      ...k,
      key: k.key ? `${k.key.substring(0, 6)}...${k.key.slice(-4)}` : ''
    }));
  }
}

export const keyPoolManager = new KeyPoolManager();

export function getKeyPoolStatus() {
  const keys = keyPoolManager.getAllKeys();
  const now = Date.now();
  return {
    totalKeys: keys.length,
    activeKeys: keys.filter(k => k.isActive && (!k.rateLimitedUntil || k.rateLimitedUntil <= now)).length,
    rateLimitedKeys: keys.filter(k => k.rateLimitedUntil && k.rateLimitedUntil > now).length,
    providers: Array.from(new Set(keys.map(k => k.provider)))
  };
}

// ── Tier Quota & Credit Management Engine ──────────────────────────────────────

export function getUserTier(tenantId: string = 'default_user'): UserTierInfo {
  const store = ensureAuthStore();
  const rawTier = store.tiers[tenantId] || {};

  const plan = rawTier.plan || (tenantId === 'default_user' ? 'pro' : 'free');
  const hasVerifiedCard = Boolean(rawTier.hasVerifiedCard || rawTier.cardVerified || rawTier.paymentVerified || process.env.GEMINI_API_KEY || tenantId === 'default_user');
  const monthlyTokenQuota = rawTier.monthlyTokenQuota || (plan === 'enterprise' ? 10000000 : plan === 'pro' ? 2000000 : 500000);
  const usedTokensThisMonth = rawTier.usedTokensThisMonth || 0;
  const remainingTokensThisMonth = Math.max(0, monthlyTokenQuota - usedTokensThisMonth);

  return {
    tenantId,
    plan,
    hasVerifiedCard,
    cardVerified: hasVerifiedCard,
    paymentVerified: hasVerifiedCard,
    cardLast4: rawTier.cardLast4 || (hasVerifiedCard ? '4242' : undefined),
    monthlyTokenQuota,
    usedTokensThisMonth,
    remainingTokensThisMonth,
    byokEnabled: Boolean(rawTier.byokEnabled || rawTier.customApiKey),
    customApiKey: rawTier.customApiKey,
    customProvider: rawTier.customProvider,
    billingCycleResetDate: rawTier.billingCycleResetDate || new Date(Date.now() + 30 * 86400000).toISOString()
  };
}

export function updateUserTier(tenantId: string = 'default_user', updates: Partial<UserTierInfo>): UserTierInfo {
  const store = ensureAuthStore();
  const current = store.tiers[tenantId] || {};
  const updated = { ...current, ...updates, tenantId };
  store.tiers[tenantId] = updated;
  saveAuthStore(store);
  return getUserTier(tenantId);
}

export function deductLlmCredits(
  tenantId: string = 'default_user',
  model: string,
  inputTokens: number,
  outputTokens: number
): LlmCreditsInfo {
  const totalTokens = inputTokens + outputTokens;
  const currentTier = getUserTier(tenantId);

  const updatedUsed = (currentTier.usedTokensThisMonth || 0) + totalTokens;
  updateUserTier(tenantId, { usedTokensThisMonth: updatedUsed });

  // Approximate cost per 1M tokens ($0.15 input / $0.60 output for Flash models)
  const costEstimateUsd = (inputTokens / 1_000_000) * 0.15 + (outputTokens / 1_000_000) * 0.60;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimateUsd
  };
}

export function getTokenQuotaSummary(tenantId: string = 'default_user'): TokenQuotaSummary {
  const tier = getUserTier(tenantId);
  const usagePercentage = Math.min(100, Math.round((tier.usedTokensThisMonth / tier.monthlyTokenQuota) * 100));
  const isQuotaExceeded = tier.usedTokensThisMonth >= tier.monthlyTokenQuota;

  return {
    tenantId,
    plan: tier.plan,
    monthlyQuota: tier.monthlyTokenQuota,
    usedTokens: tier.usedTokensThisMonth,
    remainingTokens: tier.remainingTokensThisMonth,
    usagePercentage,
    isQuotaExceeded,
    requiresCardVerification: tier.plan === 'free' && !tier.hasVerifiedCard
  };
}

export function verifyUserCard(
  tenantId: string = 'default_user',
  cardInfo: { cardLast4?: string; provider?: string } = {}
): UserTierInfo {
  return updateUserTier(tenantId, {
    hasVerifiedCard: true,
    cardVerified: true,
    paymentVerified: true,
    cardLast4: cardInfo.cardLast4 || '4242'
  });
}
