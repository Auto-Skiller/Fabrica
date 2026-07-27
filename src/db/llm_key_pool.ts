import fs from 'fs';
import path from 'path';

export interface KeyPoolItem {
  id: string;
  provider: 'gemini' | 'openrouter';
  key: string;
  label: string;
  isCustomAdded?: boolean;
  activeLocks: number; // Current active concurrent requests
  lastUsedAt?: string;
  cooldownedUntil?: number; // Timestamp ms when cooldown expires
  totalRequests: number;
  totalFailures: number;
  rateLimitHits: number;
}

export interface FreeModelInfo {
  id: string;
  name: string;
  provider: 'gemini' | 'openrouter';
  modelId: string;
  description: string;
  isFree: boolean;
}

export const FREE_MODELS: FreeModelInfo[] = [
  // Gemini Free Tier Models
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash (Free Rate Limits)',
    provider: 'gemini',
    modelId: 'gemini-3.6-flash',
    description: 'Google flagship Gemini 3.6 Flash with free rate limits.',
    isFree: true
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (Free)',
    provider: 'gemini',
    modelId: 'gemini-1.5-flash',
    description: 'Lightweight fast response Google Gemini engine with free tier limits.',
    isFree: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (Free Quota)',
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
    description: 'High-reasoning 2M context Gemini model under free rate limits.',
    isFree: true
  },
  // OpenRouter Free Tier Models (:free)
  {
    id: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nvidia Nemotron 3 Ultra 550B (Free)',
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    description: 'Nvidia flagship 550B architecture on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nvidia Nemotron 3 Super 120B (Free)',
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3-super-120b-a12b:free',
    description: 'Nvidia 120B super model on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/poolside/laguna-s-2.1:free',
    name: 'Poolside Laguna S 2.1 (Free)',
    provider: 'openrouter',
    modelId: 'poolside/laguna-s-2.1:free',
    description: 'Poolside AI code generation & reasoning model on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/google/gemma-4-31b-it:free',
    name: 'Google Gemma 4 31B IT (Free)',
    provider: 'openrouter',
    modelId: 'google/gemma-4-31b-it:free',
    description: 'Google Gemma 4 31B instruction-tuned model on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/google/gemini-2.0-flash-lite-001:free',
    name: 'Gemini 2.0 Flash Lite (OpenRouter Free)',
    provider: 'openrouter',
    modelId: 'google/gemini-2.0-flash-lite-001:free',
    description: 'Ultra-fast lightweight Gemini model hosted on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/google/gemini-2.0-pro-exp-02-05:free',
    name: 'Gemini 2.0 Pro Exp (OpenRouter Free)',
    provider: 'openrouter',
    modelId: 'google/gemini-2.0-pro-exp-02-05:free',
    description: 'Experimental Gemini 2.0 Pro frontier model on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B Instruct (Free)',
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.3-70b-instruct:free',
    description: 'Meta high-capacity open-weight 70B instruction-tuned model.',
    isFree: true
  },
  {
    id: 'openrouter/deepseek/deepseek-r1:free',
    name: 'DeepSeek R1 Reasoning (Free)',
    provider: 'openrouter',
    modelId: 'deepseek/deepseek-r1:free',
    description: 'DeepSeek frontier open reasoning model with chain-of-thought processing.',
    isFree: true
  },
  {
    id: 'openrouter/qwen/qwen-2.5-coder-32b-instruct:free',
    name: 'Qwen 2.5 Coder 32B (Free)',
    provider: 'openrouter',
    modelId: 'qwen/qwen-2.5-coder-32b-instruct:free',
    description: 'Alibaba Qwen specialized code-generation & architecture model.',
    isFree: true
  },
  {
    id: 'openrouter/mistralai/mistral-7b-instruct:free',
    name: 'Mistral 7B Instruct (Free)',
    provider: 'openrouter',
    modelId: 'mistralai/mistral-7b-instruct:free',
    description: 'Fast, compact open-weights instructor model from Mistral AI.',
    isFree: true
  },
  {
    id: 'openrouter/google/gemma-2-9b-it:free',
    name: 'Gemma 2 9B IT (Free)',
    provider: 'openrouter',
    modelId: 'google/gemma-2-9b-it:free',
    description: 'Google Gemma lightweight open model hosted on OpenRouter free tier.',
    isFree: true
  },
  {
    id: 'openrouter/meta-llama/llama-3.1-8b-instruct:free',
    name: 'Llama 3.1 8B Instruct (Free)',
    provider: 'openrouter',
    modelId: 'meta-llama/llama-3.1-8b-instruct:free',
    description: 'Meta compact fast inference 8B instruction model.',
    isFree: true
  },
  {
    id: 'openrouter/cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    name: 'Dolphin 3.0 R1 Mistral 24B (Free)',
    provider: 'openrouter',
    modelId: 'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    description: 'Uncensored reasoning model built on Mistral 24B architecture.',
    isFree: true
  }
];

const POOL_FILE_PATH = path.join(process.cwd(), '.stash', 'key_pools.json');

function ensurePoolFileExists() {
  const dir = path.dirname(POOL_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(POOL_FILE_PATH)) {
    fs.writeFileSync(POOL_FILE_PATH, JSON.stringify({ keys: [] }, null, 2));
  }
}

class LlmKeyPoolManager {
  private googleKeys: KeyPoolItem[] = [];
  private openRouterKeys: KeyPoolItem[] = [];
  private tenantAssignedKey: Map<string, string> = new Map(); // tenantId -> keyId

  constructor() {
    this.reloadPools();
  }

  public reloadPools() {
    ensurePoolFileExists();
    let fileKeys: KeyPoolItem[] = [];
    try {
      const raw = fs.readFileSync(POOL_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      fileKeys = parsed.keys || [];
    } catch (e) {
      console.error('[KeyPool] Failed to read key pool file:', e);
    }

    // Static server-side embedded key pool defaults (never sent to client)
    const staticGoogleKeys = [];

    const staticOpenRouterKeys = [];

    // Load from environment variables
    const envGoogleKeys = (process.env.GOOGLE_AI_KEYS_POOL || process.env.GEMINI_API_KEY || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 5);

    const envOpenRouterKeys = (process.env.OPENROUTER_KEYS_POOL || process.env.OPENROUTER_API_KEY || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 5);

    const allGoogleCandidateKeys = Array.from(new Set([...staticGoogleKeys, ...envGoogleKeys]));
    const allOpenRouterCandidateKeys = Array.from(new Set([...staticOpenRouterKeys, ...envOpenRouterKeys]));

    const mergedGoogle: KeyPoolItem[] = [];
    const mergedOpenRouter: KeyPoolItem[] = [];

    // Add Google keys
    allGoogleCandidateKeys.forEach((key, idx) => {
      mergedGoogle.push({
        id: `g_key_${idx}_${key.substring(0, 8)}`,
        provider: 'gemini',
        key,
        label: `Google AI Key #${idx + 1} (${key.substring(0, 8)}...)`,
        activeLocks: 0,
        totalRequests: 0,
        totalFailures: 0,
        rateLimitHits: 0
      });
    });

    // Add OpenRouter keys
    allOpenRouterCandidateKeys.forEach((key, idx) => {
      mergedOpenRouter.push({
        id: `or_key_${idx}_${key.substring(0, 10)}`,
        provider: 'openrouter',
        key,
        label: `OpenRouter Key #${idx + 1} (${key.substring(0, 10)}...)`,
        activeLocks: 0,
        totalRequests: 0,
        totalFailures: 0,
        rateLimitHits: 0
      });
    });

    // Merge file keys
    fileKeys.forEach((fk) => {
      if (fk.provider === 'gemini' && !mergedGoogle.some(k => k.key === fk.key)) {
        mergedGoogle.push({ ...fk, activeLocks: 0 });
      } else if (fk.provider === 'openrouter' && !mergedOpenRouter.some(k => k.key === fk.key)) {
        mergedOpenRouter.push({ ...fk, activeLocks: 0 });
      }
    });

    this.googleKeys = mergedGoogle;
    this.openRouterKeys = mergedOpenRouter;

    console.log(`[KeyPool] Initialized pool: ${this.googleKeys.length} Google AI Keys, ${this.openRouterKeys.length} OpenRouter Keys.`);
  }

  public addCustomKey(provider: 'gemini' | 'openrouter', key: string, label?: string) {
    ensurePoolFileExists();
    const cleanKey = key.trim();
    if (!cleanKey) return;

    let fileKeys: KeyPoolItem[] = [];
    try {
      const raw = fs.readFileSync(POOL_FILE_PATH, 'utf8');
      fileKeys = JSON.parse(raw).keys || [];
    } catch (e) {}

    const newItem: KeyPoolItem = {
      id: `custom_${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      provider,
      key: cleanKey,
      label: label || `${provider === 'gemini' ? 'Google AI' : 'OpenRouter'} Custom Key (${cleanKey.substring(0, 6)}...)`,
      isCustomAdded: true,
      activeLocks: 0,
      totalRequests: 0,
      totalFailures: 0,
      rateLimitHits: 0
    };

    fileKeys.push(newItem);
    fs.writeFileSync(POOL_FILE_PATH, JSON.stringify({ keys: fileKeys }, null, 2));
    this.reloadPools();
    return newItem;
  }

  public getPoolStats() {
    return {
      googleKeysCount: this.googleKeys.length,
      googleActiveLocks: this.googleKeys.reduce((a, b) => a + b.activeLocks, 0),
      openRouterKeysCount: this.openRouterKeys.length,
      openRouterActiveLocks: this.openRouterKeys.reduce((a, b) => a + b.activeLocks, 0),
      googleKeys: this.googleKeys.map(k => ({
        id: k.id,
        label: k.label,
        activeLocks: k.activeLocks,
        cooldowned: Boolean(k.cooldownedUntil && k.cooldownedUntil > Date.now()),
        cooldownedSecondsRemaining: k.cooldownedUntil && k.cooldownedUntil > Date.now() ? Math.ceil((k.cooldownedUntil - Date.now()) / 1000) : 0,
        rateLimitHits: k.rateLimitHits,
        totalRequests: k.totalRequests
      })),
      openRouterKeys: this.openRouterKeys.map(k => ({
        id: k.id,
        label: k.label,
        activeLocks: k.activeLocks,
        cooldowned: Boolean(k.cooldownedUntil && k.cooldownedUntil > Date.now()),
        cooldownedSecondsRemaining: k.cooldownedUntil && k.cooldownedUntil > Date.now() ? Math.ceil((k.cooldownedUntil - Date.now()) / 1000) : 0,
        rateLimitHits: k.rateLimitHits,
        totalRequests: k.totalRequests
      }))
    };
  }

  /**
   * Acquire a key for a given provider and tenant.
   * Ensures rule: "2 users should never use the same API key simultaneously"
   * Selects an un-locked, non-cooldowned key.
   */
  public acquireKey(provider: 'gemini' | 'openrouter', tenantId: string = 'default_user', excludedKeyIds: Set<string> = new Set()): KeyPoolItem | null {
    const pool = provider === 'gemini' ? this.googleKeys : this.openRouterKeys;
    const now = Date.now();

    // Clean up expired cooldowns
    pool.forEach(k => {
      if (k.cooldownedUntil && k.cooldownedUntil <= now) {
        k.cooldownedUntil = undefined;
      }
    });

    // Filter available keys (not cooldowned, not excluded)
    const available = pool.filter(k => (!k.cooldownedUntil || k.cooldownedUntil <= now) && !excludedKeyIds.has(k.id));
    if (available.length === 0) {
      return null;
    }

    // Priority 1: Unlocked keys (activeLocks === 0) that are not currently used by another tenant
    const unlocked = available.filter(k => k.activeLocks === 0);
    let selected: KeyPoolItem | undefined;

    if (unlocked.length > 0) {
      // Pick the least recently used unlocked key
      unlocked.sort((a, b) => (a.lastUsedAt || '').localeCompare(b.lastUsedAt || ''));
      selected = unlocked[0];
    } else {
      // If all keys are currently processing a request, pick the one with lowest activeLocks
      available.sort((a, b) => a.activeLocks - b.activeLocks);
      selected = available[0];
    }

    if (selected) {
      selected.activeLocks += 1;
      selected.totalRequests += 1;
      selected.lastUsedAt = new Date().toISOString();
      this.tenantAssignedKey.set(tenantId, selected.id);
    }

    return selected || null;
  }

  public releaseKey(keyId: string) {
    const all = [...this.googleKeys, ...this.openRouterKeys];
    const found = all.find(k => k.id === keyId);
    if (found) {
      found.activeLocks = Math.max(0, found.activeLocks - 1);
    }
  }

  public markRateLimited(keyId: string, cooldownSeconds: number = 60) {
    const all = [...this.googleKeys, ...this.openRouterKeys];
    const found = all.find(k => k.id === keyId);
    if (found) {
      found.rateLimitHits += 1;
      found.cooldownedUntil = Date.now() + (cooldownSeconds * 1000);
      found.activeLocks = Math.max(0, found.activeLocks - 1);
      console.warn(`[KeyPool] Key '${found.label}' marked as RATE LIMITED. Cooldowned for ${cooldownSeconds}s.`);
    }
  }
}

export const keyPoolManager = new LlmKeyPoolManager();
