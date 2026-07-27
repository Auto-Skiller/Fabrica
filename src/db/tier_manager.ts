import fs from 'fs';
import path from 'path';

export interface LlmCreditTransaction {
  id: string;
  timestamp: string;
  type: 'topup' | 'subscription_grant' | 'usage_deduction' | 'refund';
  amountUSD: number;
  description: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  remainingBalanceUSD: number;
}

export interface LlmCreditsInfo {
  balanceUSD: number;
  autoTopUp: boolean;
  autoTopUpThresholdUSD: number;
  autoTopUpAmountUSD: number;
  totalTokensUsed: number;
  totalSpentUSD: number;
  activePlan: 'byok_or_free' | 'credit_subscription_10' | 'credit_subscription_19' | 'credit_subscription_25' | 'credit_subscription_50';
  transactions: LlmCreditTransaction[];
}

export interface TokenQuotaSummary {
  monthlyQuotaTokens: number;
  monthlyQuotaUSD: number;
  usedTokensThisMonth: number;
  remainingTokensThisMonth: number;
  remainingCreditsUSD: number;
  percentRemaining: number;
  percentUsed: number;
  statusColor: string;
  statusLabel: string;
  tierName: string;
}

export interface UserTierInfo {
  tenantId: string;
  plan: 'free' | 'paug';
  status: 'active' | 'upgrading' | 'downgrading';
  createdAt: string;
  updatedAt: string;
  hasVerifiedCard?: boolean;
  cardVerified?: boolean;
  paymentVerified?: boolean;
  cardDetails?: {
    last4?: string;
    brand?: string;
    verifiedAt?: string;
  };
  llmConfig: {
    requiresByokOrFree: boolean;
    activeProvider: string;
  };
  llmCredits: LlmCreditsInfo;
  quotaSummary?: TokenQuotaSummary;
  features: {
    database: {
      type: 'shared_row_isolated' | 'dedicated_schema_paug';
      allocatedName: string;
      costMonthly: number;
      status: 'provisioned' | 'ready';
    };
    storage: {
      type: 'shared_namespace_pool' | 'dedicated_bucket_paug';
      namespace: string;
      costMonthly: number;
      status: 'provisioned' | 'ready';
    };
    executionSpace: {
      type: 'shared_worker_queue' | 'dedicated_container_runner';
      runnerId: string;
      costMonthly: number;
      status: 'provisioned' | 'ready';
    };
  };
  billingSummary: {
    monthlyTotalCost: number;
    currency: string;
    billingCycle: 'monthly' | 'pay_as_you_go';
    atCostPricingBreakdown: {
      database: string;
      storage: string;
      executionSpace: string;
    };
  };
}

const TIER_FILE_PATH = path.join(process.cwd(), '.stash', 'user_tiers.json');

function ensureTierFileExists() {
  const dir = path.dirname(TIER_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(TIER_FILE_PATH)) {
    fs.writeFileSync(TIER_FILE_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

export function loadUserTierStore(): Record<string, UserTierInfo> {
  try {
    ensureTierFileExists();
    const raw = fs.readFileSync(TIER_FILE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return data.users || {};
  } catch (err) {
    console.error('[TierManager] Error reading tier file:', err);
    return {};
  }
}

export function saveUserTierStore(store: Record<string, UserTierInfo>) {
  try {
    ensureTierFileExists();
    fs.writeFileSync(TIER_FILE_PATH, JSON.stringify({ users: store }, null, 2));
  } catch (err) {
    console.error('[TierManager] Error writing tier file:', err);
  }
}

function getDefaultLlmCredits(): LlmCreditsInfo {
  return {
    balanceUSD: 5.00, // $5.00 complimentary starter credits for new users
    autoTopUp: false,
    autoTopUpThresholdUSD: 2.00,
    autoTopUpAmountUSD: 10.00,
    totalTokensUsed: 0,
    totalSpentUSD: 0.00,
    activePlan: 'byok_or_free',
    transactions: [
      {
        id: `tx_welcome_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'topup',
        amountUSD: 5.00,
        description: 'Starter Complimentary Managed LLM Credits ($5.00 Grant)',
        remainingBalanceUSD: 5.00
      }
    ]
  };
}

export function getTokenQuotaSummary(userTier: UserTierInfo): TokenQuotaSummary {
  const credits = userTier?.llmCredits || { balanceUSD: 5.00, totalTokensUsed: 0 };
  const plan = userTier?.plan || 'free';
  const activePlan = credits.activePlan || 'byok_or_free';

  let monthlyQuotaUSD = 5.00; // Free Starter default ($5.00 starter credits)
  let monthlyQuotaTokens = 500000; // 500,000 tokens
  let tierName = 'Free Starter Tier ($0)';

  if (activePlan === 'credit_subscription_10') {
    monthlyQuotaUSD = 10.00;
    monthlyQuotaTokens = 1000000;
    tierName = 'Token Starter Plan ($10/mo)';
  } else if (activePlan === 'credit_subscription_25' || activePlan === 'credit_subscription_19') {
    monthlyQuotaUSD = 25.00;
    monthlyQuotaTokens = 2500000;
    tierName = 'Token Pro Plan ($19/mo)';
  } else if (activePlan === 'credit_subscription_50') {
    monthlyQuotaUSD = 50.00;
    monthlyQuotaTokens = 5000000;
    tierName = 'Token Scale Plan ($50/mo)';
  } else if (plan === 'paug') {
    monthlyQuotaUSD = 15.00;
    monthlyQuotaTokens = 1500000;
    tierName = 'Developer Pro (At-Cost $15/mo)';
  }

  const remainingCreditsUSD = Math.max(0, credits.balanceUSD ?? 5.00);
  const rawRatio = remainingCreditsUSD / monthlyQuotaUSD;
  const percentRemaining = Math.min(100, Math.max(0, Math.round(rawRatio * 100)));
  const percentUsed = Math.min(100, Math.max(0, 100 - percentRemaining));
  const remainingTokensThisMonth = Math.round((percentRemaining / 100) * monthlyQuotaTokens);
  const usedTokensThisMonth = credits.totalTokensUsed || Math.max(0, monthlyQuotaTokens - remainingTokensThisMonth);

  let statusColor = '#10b981'; // Green
  let statusLabel = 'OPTIMAL BALANCE';

  if (percentRemaining <= 10) {
    statusColor = '#ef4444'; // Red
    statusLabel = 'CRITICAL EXHAUSTION (<10%)';
  } else if (percentRemaining <= 25) {
    statusColor = '#f59e0b'; // Amber
    statusLabel = 'LOW QUOTA ALERT (<25%)';
  } else if (percentRemaining <= 50) {
    statusColor = '#3b82f6'; // Blue
    statusLabel = 'QUOTA NOTICE (<50%)';
  }

  return {
    monthlyQuotaTokens,
    monthlyQuotaUSD,
    usedTokensThisMonth,
    remainingTokensThisMonth,
    remainingCreditsUSD,
    percentRemaining,
    percentUsed,
    statusColor,
    statusLabel,
    tierName
  };
}

export function getUserTier(tenantId: string = 'default_user'): UserTierInfo {
  const cleanId = tenantId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'default_user';
  const store = loadUserTierStore();
  
  let resultTier: UserTierInfo;

  if (store[cleanId]) {
    // Backwards compatibility migration for existing stored user records
    if (!store[cleanId].llmCredits) {
      store[cleanId].llmCredits = getDefaultLlmCredits();
      saveUserTierStore(store);
    }
    resultTier = store[cleanId];
  } else {
    // Default Free Tier Configuration ($0/mo)
    const defaultFreeTier: UserTierInfo = {
      tenantId: cleanId,
      plan: 'free',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      llmConfig: {
        requiresByokOrFree: true,
        activeProvider: 'gemini'
      },
      llmCredits: getDefaultLlmCredits(),
      features: {
        database: {
          type: 'shared_row_isolated',
          allocatedName: `shared_db_tenant_${cleanId}`,
          costMonthly: 0.00,
          status: 'ready'
        },
        storage: {
          type: 'shared_namespace_pool',
          namespace: `/storage_shared_pool/tenants/${cleanId}/`,
          costMonthly: 0.00,
          status: 'ready'
        },
        executionSpace: {
          type: 'shared_worker_queue',
          runnerId: `shared_runner_worker_pool_v1`,
          costMonthly: 0.00,
          status: 'ready'
        }
      },
      billingSummary: {
        monthlyTotalCost: 0.00,
        currency: 'USD',
        billingCycle: 'pay_as_you_go',
        atCostPricingBreakdown: {
          database: '$0.00 (Shared row-level DB pool)',
          storage: '$0.00 (Shared tenant prefix bucket)',
          executionSpace: '$0.00 (Shared worker execution sandbox)'
        }
      }
    };

    store[cleanId] = defaultFreeTier;
    saveUserTierStore(store);
    resultTier = defaultFreeTier;
  }

  resultTier.quotaSummary = getTokenQuotaSummary(resultTier);
  return resultTier;
}

export function upgradeUserToPaug(tenantId: string = 'default_user'): UserTierInfo {
  const cleanId = tenantId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'default_user';
  const store = loadUserTierStore();
  const existing = getUserTier(cleanId);

  const paugTier: UserTierInfo = {
    tenantId: cleanId,
    plan: 'paug',
    status: 'active',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    llmConfig: {
      requiresByokOrFree: false,
      activeProvider: existing.llmConfig?.activeProvider || 'gemini'
    },
    llmCredits: existing.llmCredits || getDefaultLlmCredits(),
    features: {
      database: {
        type: 'dedicated_schema_paug',
        allocatedName: `paug_dedicated_db_schema_${cleanId}`,
        costMonthly: 5.00,
        status: 'provisioned'
      },
      storage: {
        type: 'dedicated_bucket_paug',
        namespace: `paug-isolated-bucket-${cleanId}`,
        costMonthly: 2.50,
        status: 'provisioned'
      },
      executionSpace: {
        type: 'dedicated_container_runner',
        runnerId: `paug-runner-node-${cleanId}.internal.cluster`,
        costMonthly: 5.00,
        status: 'provisioned'
      }
    },
    billingSummary: {
      monthlyTotalCost: 12.50,
      currency: 'USD',
      billingCycle: 'pay_as_you_go',
      atCostPricingBreakdown: {
        database: '$5.00/mo (Dedicated Isolated PostgreSQL Schema)',
        storage: '$2.50/mo (Dedicated Object Storage Bucket & CDN)',
        executionSpace: '$5.00/mo (Dedicated Isolated Worker Runner Container)'
      }
    }
  };

  store[cleanId] = paugTier;
  saveUserTierStore(store);
  return paugTier;
}

export function downgradeUserToFree(tenantId: string = 'default_user'): UserTierInfo {
  const cleanId = tenantId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'default_user';
  const store = loadUserTierStore();
  const existing = getUserTier(cleanId);

  const freeTier: UserTierInfo = {
    tenantId: cleanId,
    plan: 'free',
    status: 'active',
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    llmConfig: {
      requiresByokOrFree: true,
      activeProvider: existing.llmConfig?.activeProvider || 'gemini'
    },
    llmCredits: existing.llmCredits || getDefaultLlmCredits(),
    features: {
      database: {
        type: 'shared_row_isolated',
        allocatedName: `shared_db_tenant_${cleanId}`,
        costMonthly: 0.00,
        status: 'ready'
      },
      storage: {
        type: 'shared_namespace_pool',
        namespace: `/storage_shared_pool/tenants/${cleanId}/`,
        costMonthly: 0.00,
        status: 'ready'
      },
      executionSpace: {
        type: 'shared_worker_queue',
        runnerId: `shared_runner_worker_pool_v1`,
        costMonthly: 0.00,
        status: 'ready'
      }
    },
    billingSummary: {
      monthlyTotalCost: 0.00,
      currency: 'USD',
      billingCycle: 'pay_as_you_go',
      atCostPricingBreakdown: {
        database: '$0.00 (Shared row-level DB pool)',
        storage: '$0.00 (Shared tenant prefix bucket)',
        executionSpace: '$0.00 (Shared worker execution sandbox)'
      }
    }
  };

  store[cleanId] = freeTier;
  saveUserTierStore(store);
  return freeTier;
}

// ── OPTION A: MANAGED LLM CREDITS & TOP-UP LOGIC ──

export function topUpUserCredits(tenantId: string = 'default_user', amountUSD: number, description?: string): UserTierInfo {
  const user = getUserTier(tenantId);
  const store = loadUserTierStore();

  const validAmount = Math.max(1, Number(amountUSD) || 10);
  const credits = user.llmCredits;
  credits.balanceUSD = parseFloat((credits.balanceUSD + validAmount).toFixed(4));
  
  const tx: LlmCreditTransaction = {
    id: `tx_topup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: 'topup',
    amountUSD: validAmount,
    description: description || `Managed Credit Top-Up (+$${validAmount.toFixed(2)})`,
    remainingBalanceUSD: credits.balanceUSD
  };

  credits.transactions.unshift(tx);
  // keep last 50 transactions
  if (credits.transactions.length > 50) {
    credits.transactions = credits.transactions.slice(0, 50);
  }

  user.updatedAt = new Date().toISOString();
  store[user.tenantId] = user;
  saveUserTierStore(store);
  return user;
}

export function subscribeToCreditPlan(tenantId: string = 'default_user', planId: 'credit_subscription_10' | 'credit_subscription_25' | 'credit_subscription_50' | 'byok_or_free'): UserTierInfo {
  const user = getUserTier(tenantId);
  const store = loadUserTierStore();

  let creditGrant = 0;
  let planName = 'BYOK / Free Models';
  if (planId === 'credit_subscription_10') {
    creditGrant = 10.00;
    planName = 'Managed LLM Token Starter Plan ($10/mo)';
  } else if (planId === 'credit_subscription_25') {
    creditGrant = 25.00;
    planName = 'Managed LLM Token Pro Plan ($25/mo)';
  } else if (planId === 'credit_subscription_50') {
    creditGrant = 50.00;
    planName = 'Managed LLM Token Scale Plan ($50/mo)';
  }

  user.llmCredits.activePlan = planId;

  if (creditGrant > 0) {
    user.llmCredits.balanceUSD = parseFloat((user.llmCredits.balanceUSD + creditGrant).toFixed(4));
    const tx: LlmCreditTransaction = {
      id: `tx_sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'subscription_grant',
      amountUSD: creditGrant,
      description: `Monthly Subscription Credit Grant: ${planName}`,
      remainingBalanceUSD: user.llmCredits.balanceUSD
    };
    user.llmCredits.transactions.unshift(tx);
    if (user.llmCredits.transactions.length > 50) {
      user.llmCredits.transactions = user.llmCredits.transactions.slice(0, 50);
    }
  }

  user.updatedAt = new Date().toISOString();
  store[user.tenantId] = user;
  saveUserTierStore(store);
  return user;
}

export function updateAutoTopUpSettings(tenantId: string = 'default_user', enabled: boolean, thresholdUSD?: number, amountUSD?: number): UserTierInfo {
  const user = getUserTier(tenantId);
  const store = loadUserTierStore();

  user.llmCredits.autoTopUp = Boolean(enabled);
  if (thresholdUSD !== undefined && thresholdUSD >= 0) {
    user.llmCredits.autoTopUpThresholdUSD = parseFloat(thresholdUSD.toFixed(2));
  }
  if (amountUSD !== undefined && amountUSD > 0) {
    user.llmCredits.autoTopUpAmountUSD = parseFloat(amountUSD.toFixed(2));
  }

  user.updatedAt = new Date().toISOString();
  store[user.tenantId] = user;
  saveUserTierStore(store);
  return user;
}

export function verifyUserCard(tenantId: string = 'default_user', cardLast4: string = '4242', brand: string = 'Visa'): UserTierInfo {
  const user = getUserTier(tenantId);
  const store = loadUserTierStore();

  user.hasVerifiedCard = true;
  user.cardVerified = true;
  user.paymentVerified = true;
  user.cardDetails = {
    last4: cardLast4,
    brand,
    verifiedAt: new Date().toISOString()
  };

  user.updatedAt = new Date().toISOString();
  store[user.tenantId] = user;
  saveUserTierStore(store);
  return user;
}

// Exact at-cost LLM pricing table per 1 Million Tokens
const MODEL_PRICING_PER_1M: Record<string, { inputUSD: number; outputUSD: number }> = {
  'gemini-3.5-flash': { inputUSD: 0.10, outputUSD: 0.40 },
  'gemini-2.5-flash': { inputUSD: 0.10, outputUSD: 0.40 },
  'gemini-2.0-flash': { inputUSD: 0.10, outputUSD: 0.40 },
  'gemini-1.5-flash': { inputUSD: 0.10, outputUSD: 0.40 },
  'gemini-2.0-pro': { inputUSD: 1.25, outputUSD: 5.00 },
  'gemini-1.5-pro': { inputUSD: 1.25, outputUSD: 5.00 },
  'claude-3-5-sonnet': { inputUSD: 3.00, outputUSD: 15.00 },
  'claude-3-7-sonnet': { inputUSD: 3.00, outputUSD: 15.00 },
  'gpt-4o': { inputUSD: 2.50, outputUSD: 10.00 },
  'deepseek-r1': { inputUSD: 0.55, outputUSD: 2.19 },
  'deepseek-v3': { inputUSD: 0.27, outputUSD: 1.10 }
};

export function calculateLlmCostUSD(model: string, inputTokens: number, outputTokens: number): { costUSD: number; rateInputUSD: number; rateOutputUSD: number } {
  const cleanModel = model.toLowerCase().replace(/^(openrouter\/|anthropic\/|google\/)/, '');
  
  let rate = MODEL_PRICING_PER_1M[cleanModel];
  if (!rate) {
    // Find partial match
    for (const k of Object.keys(MODEL_PRICING_PER_1M)) {
      if (cleanModel.includes(k)) {
        rate = MODEL_PRICING_PER_1M[k];
        break;
      }
    }
  }

  if (!rate) {
    rate = { inputUSD: 0.50, outputUSD: 1.50 }; // reasonable default
  }

  const inputCost = (inputTokens / 1_000_000) * rate.inputUSD;
  const outputCost = (outputTokens / 1_000_000) * rate.outputUSD;
  const totalCost = parseFloat((inputCost + outputCost).toFixed(6));

  return {
    costUSD: Math.max(0.000001, totalCost),
    rateInputUSD: rate.inputUSD,
    rateOutputUSD: rate.outputUSD
  };
}

export function deductLlmCredits(
  tenantId: string = 'default_user',
  model: string,
  inputTokens: number,
  outputTokens: number
): { deductedUSD: number; remainingBalanceUSD: number; autoToppedUp: boolean } {
  const user = getUserTier(tenantId);
  const store = loadUserTierStore();
  const credits = user.llmCredits;

  const { costUSD } = calculateLlmCostUSD(model, inputTokens, outputTokens);
  const totalTokens = inputTokens + outputTokens;

  credits.balanceUSD = parseFloat((credits.balanceUSD - costUSD).toFixed(6));
  credits.totalTokensUsed += totalTokens;
  credits.totalSpentUSD = parseFloat((credits.totalSpentUSD + costUSD).toFixed(6));

  const tx: LlmCreditTransaction = {
    id: `tx_usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    type: 'usage_deduction',
    amountUSD: costUSD,
    description: `Token usage on ${model} (${inputTokens} prompt / ${outputTokens} completion)`,
    model,
    inputTokens,
    outputTokens,
    remainingBalanceUSD: credits.balanceUSD
  };

  credits.transactions.unshift(tx);

  let autoToppedUp = false;
  // Trigger Auto Top-Up if enabled and balance falls below threshold
  if (credits.autoTopUp && credits.balanceUSD <= credits.autoTopUpThresholdUSD) {
    const topUpAmount = credits.autoTopUpAmountUSD || 10.00;
    credits.balanceUSD = parseFloat((credits.balanceUSD + topUpAmount).toFixed(4));
    autoToppedUp = true;

    const topUpTx: LlmCreditTransaction = {
      id: `tx_autotopup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      type: 'topup',
      amountUSD: topUpAmount,
      description: `Auto Top-Up Triggered (Balance was below $${credits.autoTopUpThresholdUSD.toFixed(2)})`,
      remainingBalanceUSD: credits.balanceUSD
    };
    credits.transactions.unshift(topUpTx);
  }

  if (credits.transactions.length > 50) {
    credits.transactions = credits.transactions.slice(0, 50);
  }

  user.updatedAt = new Date().toISOString();
  store[user.tenantId] = user;
  saveUserTierStore(store);

  return {
    deductedUSD: costUSD,
    remainingBalanceUSD: credits.balanceUSD,
    autoToppedUp
  };
}
