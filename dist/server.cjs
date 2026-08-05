"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express6 = __toESM(require("express"), 1);
var import_path6 = __toESM(require("path"), 1);
var import_fs6 = __toESM(require("fs"), 1);
var import_child_process2 = require("child_process");

// src/api/middlewares/auth.middleware.ts
function authMiddleware(req, res, next) {
  const headerTenant = req.headers["x-tenant-id"] || req.headers["x-user-id"];
  const queryTenant = req.query.tenantId || req.query.userId;
  const tenantId = (typeof headerTenant === "string" ? headerTenant : typeof queryTenant === "string" ? queryTenant : "default_user").replace(/[^a-zA-Z0-9_\-]/g, "_");
  req.tenantId = tenantId || "default_user";
  next();
}

// src/api/middlewares/error.middleware.ts
function errorMiddleware(err, req, res, next) {
  console.error("[API Error]:", err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({
    ok: false,
    error: message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}

// src/api/routes/auth.routes.ts
var import_express = require("express");

// src/core/auth.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var MASTER_ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || "fabrica_master_secure_secret_2026_aes256_gcm";
function encryptSecret(plainText) {
  if (!plainText) return "";
  try {
    const iv = import_crypto.default.randomBytes(12);
    const key = import_crypto.default.scryptSync(MASTER_ENCRYPTION_SECRET, "fabrica_salt", 32);
    const cipher = import_crypto.default.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  } catch (err) {
    return plainText;
  }
}
function decryptSecret(encryptedData) {
  if (!encryptedData) return "";
  if (!encryptedData.includes(":")) return encryptedData;
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return encryptedData;
    const [ivHex, tagHex, contentHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const content = Buffer.from(contentHex, "hex");
    const key = import_crypto.default.scryptSync(MASTER_ENCRYPTION_SECRET, "fabrica_salt", 32);
    const decipher = import_crypto.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    return encryptedData;
  }
}
function hashApiKey(rawKey) {
  if (!rawKey) return "";
  return import_crypto.default.createHash("sha256").update(rawKey).digest("hex");
}
function maskApiKey(rawKey) {
  if (!rawKey) return "";
  if (rawKey.length <= 10) return "****";
  return `${rawKey.substring(0, 6)}...${rawKey.slice(-4)}`;
}
var FREE_MODELS = [
  {
    provider: "google",
    model: "gemini-3.6-flash",
    displayName: "Gemini 3.6 Flash (Complimentary)",
    contextWindow: "1.0M tokens",
    rateLimitNote: "Shared key pool \u2014 Card verification or BYOK recommended for high throughput"
  },
  {
    provider: "google",
    model: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    contextWindow: "1.0M tokens",
    rateLimitNote: "High speed, general reasoning"
  },
  {
    provider: "openrouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    displayName: "Nemotron 3 Ultra (Free)",
    contextWindow: "128K tokens",
    rateLimitNote: "OpenRouter Free Tier Pool"
  }
];
var AUTH_FILE_PATH = import_path.default.resolve(process.cwd(), ".stash/auth.json");
var LEGACY_KEY_POOLS_PATH = import_path.default.resolve(process.cwd(), ".stash/key_pools.json");
function ensureAuthStore() {
  const stashDir = import_path.default.dirname(AUTH_FILE_PATH);
  if (!import_fs.default.existsSync(stashDir)) {
    import_fs.default.mkdirSync(stashDir, { recursive: true });
  }
  let store = { key_pools: [], tiers: {}, users: {} };
  if (import_fs.default.existsSync(AUTH_FILE_PATH)) {
    try {
      const parsed = JSON.parse(import_fs.default.readFileSync(AUTH_FILE_PATH, "utf8"));
      store = {
        key_pools: Array.isArray(parsed.key_pools) ? parsed.key_pools : [],
        tiers: parsed.tiers || {},
        users: parsed.users || {}
      };
    } catch (_) {
    }
  } else if (import_fs.default.existsSync(LEGACY_KEY_POOLS_PATH)) {
    try {
      const parsed = JSON.parse(import_fs.default.readFileSync(LEGACY_KEY_POOLS_PATH, "utf8"));
      if (Array.isArray(parsed.keys)) {
        store.key_pools = parsed.keys;
      }
    } catch (_) {
    }
  }
  return store;
}
function saveAuthStore(data) {
  try {
    const stashDir = import_path.default.dirname(AUTH_FILE_PATH);
    if (!import_fs.default.existsSync(stashDir)) {
      import_fs.default.mkdirSync(stashDir, { recursive: true });
    }
    import_fs.default.writeFileSync(AUTH_FILE_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.warn("[AuthCore] Error saving auth store:", err);
  }
}
var KeyPoolManager = class {
  keys = [];
  constructor() {
    this.reloadKeys();
  }
  reloadKeys() {
    const store = ensureAuthStore();
    this.keys = store.key_pools;
  }
  saveKeys() {
    const store = ensureAuthStore();
    store.key_pools = this.keys.map((k) => {
      const raw = k.key || "";
      const enc = k.encryptedKey || (raw ? encryptSecret(raw) : "");
      const hash = k.keyHash || (raw ? hashApiKey(raw) : "");
      const masked = k.maskedKey || (raw ? maskApiKey(raw) : "****");
      const { key, ...safeItem } = k;
      return {
        ...safeItem,
        encryptedKey: enc,
        keyHash: hash,
        maskedKey: masked
      };
    });
    saveAuthStore(store);
  }
  addKey(item) {
    const rawKey = item.key || "";
    const newKeyItem = {
      ...item,
      id: `key_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      keyHash: hashApiKey(rawKey),
      encryptedKey: encryptSecret(rawKey),
      maskedKey: maskApiKey(rawKey),
      isByok: item.isByok ?? true,
      usageCount: 0,
      errorCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    delete newKeyItem.key;
    this.keys.push(newKeyItem);
    this.saveKeys();
    return newKeyItem;
  }
  removeKey(id) {
    const idx = this.keys.findIndex((k) => k.id === id);
    if (idx !== -1) {
      this.keys.splice(idx, 1);
      this.saveKeys();
      return true;
    }
    return false;
  }
  acquireKey(provider, tenantId, excludeIds = /* @__PURE__ */ new Set()) {
    const now = Date.now();
    const availableKeys = this.keys.filter((k) => {
      if (!k.isActive) return false;
      if (k.provider !== provider) return false;
      if (excludeIds.has(k.id)) return false;
      if (k.rateLimitedUntil && k.rateLimitedUntil > now) return false;
      return true;
    });
    if (availableKeys.length === 0) return null;
    availableKeys.sort((a, b) => {
      if (a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
      const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
      return timeA - timeB;
    });
    const selected = availableKeys[0];
    selected.usageCount++;
    selected.lastUsedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveKeys();
    const rawDecryptedKey = selected.encryptedKey ? decryptSecret(selected.encryptedKey) : selected.key || "";
    return {
      ...selected,
      rawDecryptedKey
    };
  }
  markRateLimited(id, durationSeconds = 60) {
    const keyItem = this.keys.find((k) => k.id === id);
    if (keyItem) {
      keyItem.rateLimitedUntil = Date.now() + durationSeconds * 1e3;
      keyItem.errorCount++;
      this.saveKeys();
    }
  }
  releaseKey(id) {
  }
  getAllKeys() {
    return this.keys.map((k) => {
      const displayKey = k.maskedKey || (k.key ? maskApiKey(k.key) : "****");
      const { encryptedKey, key, ...safe } = k;
      return {
        ...safe,
        key: displayKey,
        maskedKey: displayKey
      };
    });
  }
};
var keyPoolManager = new KeyPoolManager();
function getKeyPoolStatus() {
  const keys = keyPoolManager.getAllKeys();
  const now = Date.now();
  return {
    totalKeys: keys.length,
    activeKeys: keys.filter((k) => k.isActive && (!k.rateLimitedUntil || k.rateLimitedUntil <= now)).length,
    rateLimitedKeys: keys.filter((k) => k.rateLimitedUntil && k.rateLimitedUntil > now).length,
    providers: Array.from(new Set(keys.map((k) => k.provider)))
  };
}
function getUserTier(tenantId = "default_user") {
  const store = ensureAuthStore();
  const rawTier = store.tiers[tenantId] || {};
  const plan = rawTier.plan || (tenantId === "default_user" ? "pro" : "free");
  const hasVerifiedCard = Boolean(rawTier.hasVerifiedCard || rawTier.cardVerified || rawTier.paymentVerified || process.env.GEMINI_API_KEY || tenantId === "default_user");
  const monthlyTokenQuota = rawTier.monthlyTokenQuota || (plan === "enterprise" ? 1e7 : plan === "pro" ? 2e6 : 5e5);
  const usedTokensThisMonth = rawTier.usedTokensThisMonth || 0;
  const remainingTokensThisMonth = Math.max(0, monthlyTokenQuota - usedTokensThisMonth);
  return {
    tenantId,
    plan,
    hasVerifiedCard,
    cardVerified: hasVerifiedCard,
    paymentVerified: hasVerifiedCard,
    cardLast4: rawTier.cardLast4 || (hasVerifiedCard ? "4242" : void 0),
    monthlyTokenQuota,
    usedTokensThisMonth,
    remainingTokensThisMonth,
    byokEnabled: Boolean(rawTier.byokEnabled || rawTier.customApiKey),
    customApiKey: rawTier.customApiKey ? maskApiKey(rawTier.customApiKey) : void 0,
    customProvider: rawTier.customProvider,
    billingCycleResetDate: rawTier.billingCycleResetDate || new Date(Date.now() + 30 * 864e5).toISOString()
  };
}
function updateUserTier(tenantId = "default_user", updates) {
  const store = ensureAuthStore();
  const current = store.tiers[tenantId] || {};
  const updated = { ...current, ...updates, tenantId };
  store.tiers[tenantId] = updated;
  saveAuthStore(store);
  return getUserTier(tenantId);
}
function deductLlmCredits(tenantId = "default_user", model, inputTokens, outputTokens) {
  const totalTokens = inputTokens + outputTokens;
  const currentTier = getUserTier(tenantId);
  const updatedUsed = (currentTier.usedTokensThisMonth || 0) + totalTokens;
  updateUserTier(tenantId, { usedTokensThisMonth: updatedUsed });
  const costEstimateUsd = inputTokens / 1e6 * 0.15 + outputTokens / 1e6 * 0.6;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    costEstimateUsd
  };
}
function getTokenQuotaSummary(tenantId = "default_user") {
  const tier = getUserTier(tenantId);
  const usagePercentage = Math.min(100, Math.round(tier.usedTokensThisMonth / tier.monthlyTokenQuota * 100));
  const isQuotaExceeded = tier.usedTokensThisMonth >= tier.monthlyTokenQuota;
  return {
    tenantId,
    plan: tier.plan,
    monthlyQuota: tier.monthlyTokenQuota,
    usedTokens: tier.usedTokensThisMonth,
    remainingTokens: tier.remainingTokensThisMonth,
    usagePercentage,
    isQuotaExceeded,
    requiresCardVerification: tier.plan === "free" && !tier.hasVerifiedCard
  };
}
function verifyUserCard(tenantId = "default_user", cardInfo = {}) {
  return updateUserTier(tenantId, {
    hasVerifiedCard: true,
    cardVerified: true,
    paymentVerified: true,
    cardLast4: cardInfo.cardLast4 || "4242"
  });
}

// src/api/routes/auth.routes.ts
var router = (0, import_express.Router)();
router.get("/tier", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const tier = getUserTier(tenantId);
  res.json({ ok: true, tier });
});
router.get("/quota", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const quota = getTokenQuotaSummary(tenantId);
  res.json({ ok: true, quota });
});
router.post("/verify-card", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { cardLast4, provider } = req.body || {};
  const updatedTier = verifyUserCard(tenantId, { cardLast4, provider });
  res.json({ ok: true, message: "Card verified successfully.", tier: updatedTier });
});
router.post("/byok", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { customApiKey, customProvider } = req.body || {};
  const updated = updateUserTier(tenantId, {
    customApiKey,
    customProvider: customProvider || "gemini",
    byokEnabled: Boolean(customApiKey)
  });
  res.json({ ok: true, tier: updated });
});
router.get("/key-pool", (req, res) => {
  const keys = keyPoolManager.getAllKeys();
  const status = getKeyPoolStatus();
  res.json({ ok: true, status, keys, freeModels: FREE_MODELS });
});
router.post("/key-pool/add", (req, res) => {
  const { key, provider, label, isByok } = req.body || {};
  if (!key || !provider) {
    res.status(400).json({ ok: false, error: "Key and provider are required." });
    return;
  }
  const added = keyPoolManager.addKey({
    key,
    provider,
    label: label || "BYOK User Key",
    isActive: true,
    isByok: isByok !== void 0 ? Boolean(isByok) : true
  });
  const { encryptedKey, ...safeKeyItem } = added;
  res.json({ ok: true, keyItem: { ...safeKeyItem, key: safeKeyItem.maskedKey || "****" } });
});
router.post("/key-pool/remove", (req, res) => {
  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ ok: false, error: "Key ID is required." });
    return;
  }
  const removed = keyPoolManager.removeKey(id);
  res.json({ ok: removed });
});
var auth_routes_default = router;

// src/api/routes/tenant.routes.ts
var import_express2 = require("express");

// src/core/tenant.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
function getTenantRoot(tenantId = "default_user") {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const userRoot = import_path2.default.resolve(process.cwd(), "workspaces", safeTenant);
  if (!import_fs2.default.existsSync(userRoot)) {
    import_fs2.default.mkdirSync(userRoot, { recursive: true });
  }
  return userRoot;
}
var DatabaseEngine = class {
  tenantId;
  constructor(tenantId = "default_user") {
    this.tenantId = tenantId;
  }
  getTenantFile(filename) {
    const root = getTenantRoot(this.tenantId);
    return import_path2.default.join(root, filename);
  }
  readJson(filename, fallback) {
    const filePath = this.getTenantFile(filename);
    if (!import_fs2.default.existsSync(filePath)) return fallback;
    try {
      return JSON.parse(import_fs2.default.readFileSync(filePath, "utf8"));
    } catch (_) {
      return fallback;
    }
  }
  writeJson(filename, data) {
    const filePath = this.getTenantFile(filename);
    try {
      import_fs2.default.mkdirSync(import_path2.default.dirname(filePath), { recursive: true });
      import_fs2.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
      console.warn(`[DatabaseEngine] Failed to write ${filename} for ${this.tenantId}:`, err);
    }
  }
};
var dbEngine = new DatabaseEngine("default_user");
function getTenantProfile(tenantId = "default_user") {
  const root = getTenantRoot(tenantId);
  const tenantJsonPath = import_path2.default.join(root, "tenant.json");
  if (import_fs2.default.existsSync(tenantJsonPath)) {
    try {
      const parsed = JSON.parse(import_fs2.default.readFileSync(tenantJsonPath, "utf8"));
      return {
        tenantId,
        name: parsed.name || (tenantId === "default_user" ? "Default Workspace" : `Tenant (${tenantId})`),
        email: parsed.email,
        plan: parsed.plan || parsed.subscription?.plan || "Professional",
        createdAt: parsed.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: parsed.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
        settings: parsed.settings || { language: "EN", internet_access: true }
      };
    } catch (_) {
    }
  }
  const defaultProfile = {
    tenantId,
    name: tenantId === "default_user" ? "Default Workspace" : `Tenant (${tenantId})`,
    plan: "Professional",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    settings: { language: "EN", internet_access: true }
  };
  try {
    const fullTenantData = {
      tenant_id: tenantId,
      ...defaultProfile,
      subscription: { plan: "Professional", active: true },
      telemetry: { total_runs: 0, last_active: (/* @__PURE__ */ new Date()).toISOString() },
      logs: [
        {
          id: `evt-init-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "system",
          event: "Workspace Initialized",
          details: "Unified audit event stream initialized in tenant.json."
        }
      ]
    };
    import_fs2.default.writeFileSync(tenantJsonPath, JSON.stringify(fullTenantData, null, 2), "utf8");
  } catch (_) {
  }
  return defaultProfile;
}
function updateTenantProfile(tenantId = "default_user", updates) {
  const root = getTenantRoot(tenantId);
  const tenantJsonPath = import_path2.default.join(root, "tenant.json");
  let fullTenantData = {};
  if (import_fs2.default.existsSync(tenantJsonPath)) {
    try {
      fullTenantData = JSON.parse(import_fs2.default.readFileSync(tenantJsonPath, "utf8"));
    } catch (_) {
    }
  }
  const current = getTenantProfile(tenantId);
  const updated = {
    ...current,
    ...updates,
    tenantId,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  fullTenantData = {
    ...fullTenantData,
    ...updated,
    tenant_id: tenantId,
    updatedAt: updated.updatedAt
  };
  import_fs2.default.writeFileSync(tenantJsonPath, JSON.stringify(fullTenantData, null, 2), "utf8");
  return updated;
}
function getTenantTelemetry(tenantId = "default_user") {
  const root = getTenantRoot(tenantId);
  let totalStorageBytes = 0;
  function calculateSize(dir) {
    if (!import_fs2.default.existsSync(dir)) return;
    try {
      const entries = import_fs2.default.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = import_path2.default.join(dir, entry.name);
        if (entry.isDirectory()) {
          calculateSize(full);
        } else {
          try {
            totalStorageBytes += import_fs2.default.statSync(full).size;
          } catch (_) {
          }
        }
      }
    } catch (_) {
    }
  }
  calculateSize(root);
  return {
    tenantId,
    cpuUsagePercent: Math.min(100, Math.round(Math.random() * 15 + 5)),
    memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeDaemonsCount: 1,
    totalMissionsCount: 0,
    totalStorageBytes,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function getTenantAuditLogs(tenantId = "default_user") {
  const root = getTenantRoot(tenantId);
  const tenantJsonPath = import_path2.default.join(root, "tenant.json");
  if (import_fs2.default.existsSync(tenantJsonPath)) {
    try {
      const parsed = JSON.parse(import_fs2.default.readFileSync(tenantJsonPath, "utf8"));
      if (Array.isArray(parsed.logs)) return parsed.logs;
    } catch (_) {
    }
  }
  const logsPath = import_path2.default.join(root, "logs.json");
  if (import_fs2.default.existsSync(logsPath)) {
    try {
      const parsed = JSON.parse(import_fs2.default.readFileSync(logsPath, "utf8"));
      return Array.isArray(parsed.events) ? parsed.events : [];
    } catch (_) {
    }
  }
  return [];
}
function appendTenantAuditLog(tenantId = "default_user", event) {
  const root = getTenantRoot(tenantId);
  const tenantJsonPath = import_path2.default.join(root, "tenant.json");
  let fullTenantData = { tenant_id: tenantId, logs: [] };
  if (import_fs2.default.existsSync(tenantJsonPath)) {
    try {
      const parsed = JSON.parse(import_fs2.default.readFileSync(tenantJsonPath, "utf8"));
      if (parsed && typeof parsed === "object") {
        fullTenantData = parsed;
      }
    } catch (_) {
    }
  }
  if (!Array.isArray(fullTenantData.logs)) {
    fullTenantData.logs = [];
  }
  const newEntry = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ...event
  };
  fullTenantData.logs.unshift(newEntry);
  if (fullTenantData.logs.length > 1e3) {
    fullTenantData.logs = fullTenantData.logs.slice(0, 1e3);
  }
  fullTenantData.last_event_at = newEntry.timestamp;
  try {
    import_fs2.default.writeFileSync(tenantJsonPath, JSON.stringify(fullTenantData, null, 2), "utf8");
  } catch (err) {
    console.warn(`[TenantCore] Error appending audit log for ${tenantId}:`, err);
  }
  return newEntry;
}

// src/api/routes/tenant.routes.ts
var router2 = (0, import_express2.Router)();
router2.get("/profile", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const profile = getTenantProfile(tenantId);
  res.json({ ok: true, profile });
});
router2.post("/profile", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const updates = req.body || {};
  const updated = updateTenantProfile(tenantId, updates);
  res.json({ ok: true, profile: updated });
});
router2.get("/telemetry", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const telemetry = getTenantTelemetry(tenantId);
  res.json({ ok: true, telemetry });
});
router2.get("/logs", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const logs = getTenantAuditLogs(tenantId);
  res.json({ ok: true, events: logs });
});
router2.post("/logs/event", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { type, event, details, mission_id } = req.body || {};
  if (!event) {
    res.status(400).json({ ok: false, error: "Event title is required." });
    return;
  }
  const entry = appendTenantAuditLog(tenantId, {
    type: type || "system",
    event,
    details,
    mission_id
  });
  res.json({ ok: true, entry });
});
var tenant_routes_default = router2;

// src/api/routes/workspace.routes.ts
var import_express3 = require("express");

// src/core/workspace.ts
var import_fs4 = __toESM(require("fs"), 1);
var import_path4 = __toESM(require("path"), 1);

// src/core/harness.ts
var import_child_process = require("child_process");
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var PiDaemonProcess = class {
  id;
  tenantId;
  sessionId;
  model;
  child = null;
  pid;
  status = "stopped";
  createdAt;
  lastActiveAt;
  apiKeyStrategy;
  constructor(tenantId, sessionId, model, apiKeyStrategy = "System Fallback") {
    this.id = tenantId;
    this.tenantId = tenantId;
    this.sessionId = sessionId;
    this.model = model;
    this.apiKeyStrategy = apiKeyStrategy;
    this.createdAt = (/* @__PURE__ */ new Date()).toISOString();
    this.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  getInfo() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      model: this.model,
      pid: this.pid,
      status: this.status,
      createdAt: this.createdAt,
      lastActiveAt: this.lastActiveAt,
      apiKeyStrategy: this.apiKeyStrategy
    };
  }
  kill() {
    if (this.child) {
      try {
        this.child.kill("SIGTERM");
        this.child.kill("SIGKILL");
      } catch (_) {
      }
    }
    this.status = "stopped";
    activePiDaemons.delete(this.tenantId);
    activePiChildProcesses.delete(this.tenantId);
    return true;
  }
};
var activePiDaemons = /* @__PURE__ */ new Map();
var activePiChildProcesses = /* @__PURE__ */ new Map();
var piProcessLogs = [];
function stopPiAgent(tenantId, sessionId) {
  let killed = false;
  const existingDaemon = activePiDaemons.get(tenantId);
  if (existingDaemon) {
    existingDaemon.kill();
    killed = true;
  }
  for (const [key, child] of activePiChildProcesses.entries()) {
    if (key === tenantId || key.startsWith(`${tenantId}:`)) {
      try {
        child.kill("SIGTERM");
        child.kill("SIGKILL");
        killed = true;
      } catch (err) {
        console.warn(`[harness] Failed to kill child process ${key}:`, err);
      }
      activePiChildProcesses.delete(key);
    }
  }
  return killed;
}
function listPiDaemons(tenantId) {
  const daemons = [];
  for (const daemon of activePiDaemons.values()) {
    if (!tenantId || tenantId === "all" || daemon.tenantId === tenantId) {
      daemons.push(daemon.getInfo());
    }
  }
  return daemons;
}
function getPiProcessLogs(tenantId) {
  if (!tenantId || tenantId === "all") return piProcessLogs;
  return piProcessLogs.filter((l) => l.tenantId === tenantId || l.tenantId === "default_user");
}
function recordPiProcessLog(item) {
  piProcessLogs.unshift(item);
  if (piProcessLogs.length > 100) {
    piProcessLogs.pop();
  }
}
function syncPiUserAuthKeys(tenantId = "default_user", customKey, customProvider) {
  const userRoot = getTenantRoot(tenantId);
  const piAgentDir = import_path3.default.join(userRoot, ".pi", "agent");
  import_fs3.default.mkdirSync(piAgentDir, { recursive: true });
  const authJsonPath = import_path3.default.join(piAgentDir, "auth.json");
  const modelsJsonPath = import_path3.default.join(piAgentDir, "models.json");
  let authData = {};
  if (import_fs3.default.existsSync(authJsonPath)) {
    try {
      authData = JSON.parse(import_fs3.default.readFileSync(authJsonPath, "utf8"));
    } catch (_) {
    }
  }
  const allKeys = keyPoolManager.getAllKeys();
  const byokKeys = allKeys.filter((k) => k.isByok && k.isActive);
  for (const k of byokKeys) {
    if (k.provider) {
      const decrypted = k.encryptedKey ? decryptSecret(k.encryptedKey) : k.key;
      if (decrypted && !decrypted.includes("****")) {
        authData[k.provider] = {
          type: "api_key",
          key: decrypted,
          label: k.label || "User BYOK Key"
        };
      }
    }
  }
  if (customKey && customProvider && !customKey.includes("****")) {
    authData[customProvider] = {
      type: "api_key",
      key: customKey,
      label: "Request Custom BYOK Key"
    };
  }
  import_fs3.default.writeFileSync(authJsonPath, JSON.stringify(authData, null, 2), "utf8");
  if (!import_fs3.default.existsSync(modelsJsonPath)) {
    import_fs3.default.writeFileSync(modelsJsonPath, JSON.stringify({
      providers: {
        google: { name: "Google Gemini", env_var: "GEMINI_API_KEY" },
        gemini: { name: "Google Gemini", env_var: "GEMINI_API_KEY" },
        openrouter: { name: "OpenRouter", env_var: "OPENROUTER_API_KEY" },
        anthropic: { name: "Anthropic Claude", env_var: "ANTHROPIC_API_KEY" },
        openai: { name: "OpenAI", env_var: "OPENAI_API_KEY" },
        mistral: { name: "Mistral AI", env_var: "MISTRAL_API_KEY" },
        groq: { name: "Groq", env_var: "GROQ_API_KEY" },
        deepseek: { name: "DeepSeek", env_var: "DEEPSEEK_API_KEY" },
        xai: { name: "xAI Grok", env_var: "XAI_API_KEY" },
        azure: { name: "Azure OpenAI", env_var: "AZURE_OPENAI_API_KEY" },
        together: { name: "Together AI", env_var: "TOGETHER_API_KEY" },
        fireworks: { name: "Fireworks AI", env_var: "FIREWORKS_API_KEY" },
        perplexity: { name: "Perplexity AI", env_var: "PERPLEXITY_API_KEY" }
      }
    }, null, 2), "utf8");
  }
}
function ensureUserHarness(tenantId = "default_user") {
  const userRoot = getTenantRoot(tenantId);
  const piDir = import_path3.default.join(userRoot, ".pi");
  const piAgentDir = import_path3.default.join(piDir, "agent");
  const piSkillsDir = import_path3.default.join(piDir, "skills");
  import_fs3.default.mkdirSync(piAgentDir, { recursive: true });
  import_fs3.default.mkdirSync(piSkillsDir, { recursive: true });
  syncPiUserAuthKeys(tenantId);
  const tenantJsonPath = import_path3.default.join(userRoot, "tenant.json");
  if (!import_fs3.default.existsSync(tenantJsonPath)) {
    import_fs3.default.writeFileSync(tenantJsonPath, JSON.stringify({
      tenant_id: tenantId,
      name: tenantId === "default_user" ? "Default Workspace" : `Tenant (${tenantId})`,
      plan: "Professional",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      settings: { language: "EN", internet_access: true },
      subscription: { plan: "Professional", active: true },
      telemetry: { total_runs: 0, last_active: (/* @__PURE__ */ new Date()).toISOString() },
      logs: [
        {
          id: `evt-init-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          type: "system",
          event: "Workspace Initialized",
          details: "Unified audit event stream initialized in tenant.json."
        }
      ]
    }, null, 2), "utf8");
  }
  const harnessJsonPath = import_path3.default.join(userRoot, "harness.json");
  if (!import_fs3.default.existsSync(harnessJsonPath)) {
    import_fs3.default.writeFileSync(harnessJsonPath, JSON.stringify({
      tenant_id: tenantId,
      status: "idle",
      selected_model: "gemini-3.6-flash",
      autonomy: "director",
      autonomy_interval: 20,
      agent_lang: "EN",
      output_language: "EN",
      web_search_enabled: true,
      suggestions: [],
      suggestion_cards: [],
      backlogs: [],
      backlog: [],
      review_queues: [],
      review: [],
      new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] },
      last_active: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), "utf8");
  }
  const singleMissionsPath = import_path3.default.join(userRoot, "missions.json");
  if (!import_fs3.default.existsSync(singleMissionsPath)) {
    import_fs3.default.writeFileSync(singleMissionsPath, JSON.stringify({ missions: [] }, null, 2), "utf8");
  }
  const workspaceJsonPath = import_path3.default.join(userRoot, "workspace.json");
  if (!import_fs3.default.existsSync(workspaceJsonPath)) {
    import_fs3.default.writeFileSync(workspaceJsonPath, JSON.stringify({
      sources: {},
      deliverables: {},
      last_synced_at: (/* @__PURE__ */ new Date()).toISOString()
    }, null, 2), "utf8");
  }
  const agentsMdPath = import_path3.default.join(userRoot, "AGENTS.md");
  if (!import_fs3.default.existsSync(agentsMdPath)) {
    import_fs3.default.writeFileSync(agentsMdPath, "", "utf8");
  }
  const workspaceDir = import_path3.default.join(userRoot, "workspace");
  const sourcesDir = import_path3.default.join(workspaceDir, "Sources");
  const deliverablesDir = import_path3.default.join(workspaceDir, "Deliverables");
  const sourceDirs = [
    "Discovery & Scoping",
    "Deep Research & Intelligence Gathering",
    "Data Analysis & Pattern Extraction",
    "Strategic Synthesis & Decision Support"
  ];
  const deliverableDirs = ["Executions", "Reviews", "Completed"];
  for (const sd of sourceDirs) {
    import_fs3.default.mkdirSync(import_path3.default.join(sourcesDir, sd), { recursive: true });
  }
  for (const dd of deliverableDirs) {
    import_fs3.default.mkdirSync(import_path3.default.join(deliverablesDir, dd), { recursive: true });
  }
  const missionsDir = import_path3.default.join(userRoot, "missions");
  import_fs3.default.mkdirSync(missionsDir, { recursive: true });
  const config = {
    harness: {
      version: "3.0.0",
      name: `Fabrica Harness [Tenant: ${tenantId}]`,
      architecture: "modular_core_harness",
      mode: "per_user_isolated",
      model_preferences: {
        default_agent_model: "gemini-3.6-flash",
        research_model: "gemini-3.6-flash",
        sandbox_timeout_ms: 1e4
      },
      memory: {
        context_window_tokens: 1e6,
        persistence_mode: "hybrid_fs_json"
      },
      tools_sandbox: {
        isolation: "isolated_v8_vm",
        allow_network: true
      }
    }
  };
  return {
    tenantId,
    harnessDir: "",
    entitiesDir: "",
    config,
    entities: []
  };
}
function getHarnessState(tenantId = "default_user") {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const harnessJsonPath = import_path3.default.join(userRoot, "harness.json");
  try {
    if (import_fs3.default.existsSync(harnessJsonPath)) {
      const data = JSON.parse(import_fs3.default.readFileSync(harnessJsonPath, "utf8"));
      const lang = data.agent_lang || data.output_language || "EN";
      const suggestions = data.suggestions || data.suggestion_cards || [];
      const rawBacklog = data.backlog || data.backlogs || [];
      const rawReview = data.review || data.review_queues || [];
      const interval = data.autonomy_interval ?? data.autonomyInterval ?? 20;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const backlog = rawBacklog.map(
        (item) => typeof item === "string" ? { id: `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item, type: "validated", created_at: now } : { id: item.id || `bl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item.text || item.label || String(item), type: item.type || "validated", created_at: item.created_at || now }
      );
      const review = rawReview.map(
        (item) => typeof item === "string" ? { id: `rv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item, type: "pending", created_at: now } : { id: item.id || `rv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: item.text || item.label || String(item), type: item.type || "pending", feedback: item.feedback, created_at: item.created_at || now }
      );
      const autoMissions = data.auto_missions_processing ?? data.autoMissionsProcessing ?? true;
      const autoImports = data.auto_imports_processing ?? data.autoImportsProcessing ?? true;
      const rawAutonomy = data.autonomy || "director";
      const autonomy = rawAutonomy === "autonomous" ? "director" : rawAutonomy === "semi-autonomous" ? "worker" : rawAutonomy === "manual" ? "off" : rawAutonomy;
      const newUserActions = data.new_user_actions || { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] };
      return {
        tenant_id: tenantId,
        status: data.status || "idle",
        selected_model: data.selected_model || "gemini-3.6-flash",
        autonomy,
        autonomy_interval: Number(interval),
        auto_missions_processing: Boolean(autoMissions),
        auto_imports_processing: Boolean(autoImports),
        agent_lang: lang,
        output_language: lang,
        web_search_enabled: data.web_search_enabled ?? true,
        suggestions,
        suggestion_cards: suggestions,
        backlogs: backlog,
        backlog,
        review_queues: review,
        review,
        new_user_actions: newUserActions,
        skills_enabled: data.skills_enabled || {},
        integrations_enabled: data.integrations_enabled || {},
        last_active: data.last_active || (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  } catch (_) {
  }
  return {
    tenant_id: tenantId,
    status: "idle",
    selected_model: "gemini-3.6-flash",
    autonomy: "director",
    autonomy_interval: 20,
    auto_missions_processing: true,
    auto_imports_processing: true,
    agent_lang: "EN",
    output_language: "EN",
    web_search_enabled: true,
    suggestions: [],
    suggestion_cards: [],
    backlogs: [],
    backlog: [],
    review_queues: [],
    review: [],
    new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] },
    skills_enabled: {},
    integrations_enabled: {},
    last_active: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function updateHarnessState(tenantId = "default_user", updates) {
  const current = getHarnessState(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const harnessJsonPath = import_path3.default.join(userRoot, "harness.json");
  const lang = updates.agent_lang || updates.output_language || current.agent_lang;
  const suggestionsList = updates.suggestions || updates.suggestion_cards || current.suggestions;
  const backlogList = updates.backlogs || updates.backlog || current.backlog;
  const reviewList = updates.review_queues || updates.review || current.review;
  const interval = updates.autonomy_interval ?? updates.autonomyInterval ?? current.autonomy_interval ?? 20;
  const autoMissions = updates.auto_missions_processing ?? updates.autoMissionsProcessing ?? current.auto_missions_processing ?? true;
  const autoImports = updates.auto_imports_processing ?? updates.autoImportsProcessing ?? current.auto_imports_processing ?? true;
  const merged = {
    ...current,
    ...updates,
    tenant_id: tenantId,
    agent_lang: lang,
    output_language: lang,
    autonomy_interval: Number(interval),
    auto_missions_processing: Boolean(autoMissions),
    auto_imports_processing: Boolean(autoImports),
    suggestions: suggestionsList,
    suggestion_cards: suggestionsList,
    backlogs: backlogList,
    backlog: backlogList,
    review_queues: reviewList,
    review: reviewList,
    last_active: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    import_fs3.default.writeFileSync(harnessJsonPath, JSON.stringify(merged, null, 2), "utf8");
  } catch (err) {
    console.warn(`[harness] Failed to update harness.json for tenant ${tenantId}:`, err);
  }
  return merged;
}
function appendUserAction(tenantId = "default_user", category, action) {
  const current = getHarnessState(tenantId);
  const actions = current.new_user_actions || { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] };
  if (!Array.isArray(actions[category])) actions[category] = [];
  actions[category] = [...actions[category], { action, timestamp: (/* @__PURE__ */ new Date()).toISOString() }];
  updateHarnessState(tenantId, { new_user_actions: actions });
}
function clearUserActions(tenantId = "default_user") {
  updateHarnessState(tenantId, { new_user_actions: { backlog_actions: [], reviews_actions: [], missions_actions: [], workspace_actions: [] } });
}
function buildRunDirectives(tenantId = "default_user") {
  const harnessData = getHarnessState(tenantId);
  let directives = "";
  const actions = harnessData.new_user_actions || {};
  const allActions = [
    ...actions.backlog_actions || [],
    ...actions.reviews_actions || [],
    ...actions.missions_actions || [],
    ...actions.workspace_actions || []
  ];
  if (allActions.length > 0) {
    directives += `

[USER ACTIONS SINCE LAST TURN]:
${allActions.map((a) => `- ${a.action} (${a.timestamp})`).join("\n")}`;
  }
  const backlog = harnessData.backlog || [];
  const validatedBacklog = backlog.filter((item) => typeof item === "string" || !item.type || item.type === "validated");
  if (validatedBacklog.length > 0) {
    const items = validatedBacklog.map((item, i) => `${i + 1}. ${typeof item === "string" ? item : item.text}`).join("\n");
    directives += `

[VALIDATED BACKLOGS - Prioritized Goals]:
${items}
(Monitor for drift \u2014 flag if your work deviates from these goals)`;
  }
  const review = harnessData.review || [];
  if (review.length > 0) {
    const pending = review.filter((r) => typeof r === "string" || !r.type || r.type === "pending");
    const reviewed = review.filter((r) => r.type === "reviewed");
    if (pending.length > 0) {
      directives += `

[PENDING REVIEWS - Awaiting Validation]:
${pending.map((r) => `- ${typeof r === "string" ? r : r.label || r.text}`).join("\n")}
(Address these in your next turn if relevant)`;
    }
    if (reviewed.length > 0) {
      directives += `

[REVIEWED ITEMS - User Feedback Applied]:
${reviewed.map((r) => `- ${r.label || r.text}${r.feedback ? ": " + r.feedback : ""}`).join("\n")}`;
    }
  }
  directives += "\n\n[SUGGESTIONS AUDIT]: Review your current suggestions in harness.json. Ensure they are relevant, actionable, and no more than 3. Replace stale suggestions with fresh ones based on current workspace context.";
  return directives;
}
function loadKernelSystemPrompts(tenantId = "default_user") {
  const kernelPromptsDir = import_path3.default.join(process.cwd(), "Fabrica_kernel", "system_prompts");
  let combinedPrompts = "";
  if (import_fs3.default.existsSync(kernelPromptsDir)) {
    const files = import_fs3.default.readdirSync(kernelPromptsDir).filter((f) => f.endsWith(".md")).sort();
    for (const f of files) {
      try {
        const content = import_fs3.default.readFileSync(import_path3.default.join(kernelPromptsDir, f), "utf8");
        if (content.trim()) {
          combinedPrompts += `

[SYSTEM DIRECTIVE (${f})]:
${content.trim()}`;
        }
      } catch (_) {
      }
    }
  }
  const harnessData = getHarnessState(tenantId);
  combinedPrompts += `

[HARNESS STATE]:
- Output Language: ${harnessData.output_language || harnessData.agent_lang || "EN"}`;
  if (harnessData.web_search_enabled) {
    combinedPrompts += "\n\n[CRITICAL WEB DIRECTIVE: Use live web tools for search and grounding when Needed.]";
  }
  combinedPrompts += buildRunDirectives(tenantId);
  return combinedPrompts;
}
function getPiExecutionOptions(tenantId = "default_user", _disableWorkspaceSkills = false, _disableWorkspaceExtensions = false) {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const piDir = import_path3.default.join(userRoot, ".pi");
  import_fs3.default.mkdirSync(import_path3.default.join(piDir, "agent", "sessions"), { recursive: true });
  const cliFlags = [];
  const kernelSkillsDir = import_path3.default.join(process.cwd(), "Fabrica_kernel", "skills");
  if (import_fs3.default.existsSync(kernelSkillsDir) && import_fs3.default.readdirSync(kernelSkillsDir).length > 0) {
    cliFlags.push("--skill", kernelSkillsDir);
  }
  const harnessData = getHarnessState(tenantId);
  const skillsEnabled = harnessData.skills_enabled || {};
  const userSkillsDir = import_path3.default.join(userRoot, ".pi", "skills");
  if (import_fs3.default.existsSync(userSkillsDir)) {
    const skillFolders = import_fs3.default.readdirSync(userSkillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const skillName of skillFolders) {
      if (skillsEnabled[skillName] !== false) {
        cliFlags.push("--skill", import_path3.default.join(userSkillsDir, skillName));
      }
    }
  }
  const integrationsDir = import_path3.default.join(process.cwd(), "Fabrica_kernel", "integrations");
  if (import_fs3.default.existsSync(integrationsDir)) {
    const integrationsEnabled = harnessData.integrations_enabled || {};
    const integrationDirs = import_fs3.default.readdirSync(integrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    for (const integrationName of integrationDirs) {
      if (!integrationsEnabled[integrationName]) continue;
      const integrationSkillsPath = import_path3.default.join(integrationsDir, integrationName, "skills");
      if (import_fs3.default.existsSync(integrationSkillsPath)) {
        cliFlags.push("--skill", integrationSkillsPath);
      }
      const integrationExtPath = import_path3.default.join(integrationsDir, integrationName, "extensions");
      if (import_fs3.default.existsSync(integrationExtPath)) {
        const extFiles = import_fs3.default.readdirSync(integrationExtPath).filter((f) => f.endsWith(".js"));
        for (const extFile of extFiles) {
          cliFlags.push("--extension", import_path3.default.join(integrationExtPath, extFile));
        }
      }
    }
  }
  cliFlags.push("--no-context-files");
  const agentsMdPath = import_path3.default.join(userRoot, "AGENTS.md");
  if (import_fs3.default.existsSync(agentsMdPath)) {
    const agentsMdContent = import_fs3.default.readFileSync(agentsMdPath, "utf8").trim();
    if (agentsMdContent) {
      cliFlags.push(
        "--append-system-prompt",
        `[CRITICAL MEMORY CONTEXT DIRECTIVE: AGENTS.md is your long-running memory. Read it via @${agentsMdPath} for context. Append important things (user preferences, project info, goals). Audit it if anything changes \u2014 no outdated info.]`
      );
    }
  }
  const systemPrompts = loadKernelSystemPrompts(tenantId);
  if (systemPrompts.trim()) {
    cliFlags.push("--append-system-prompt", systemPrompts.trim());
  }
  return {
    cwd: userRoot,
    piCodingAgentDir: piDir,
    env: {
      ...process.env,
      PI_CODING_AGENT_DIR: piDir
    },
    cliFlags
  };
}
async function runPiAgent(options) {
  const tenantId = options.tenantId || "default_user";
  ensureUserHarness(tenantId);
  updateHarnessState(tenantId, {
    status: "running",
    selected_model: options.model || "gemini-3.6-flash",
    agent_lang: options.agentLang || "EN",
    output_language: options.agentLang || "EN",
    web_search_enabled: options.webSearchEnabled ?? true
  });
  const userRoot = getTenantRoot(tenantId);
  const execOpts = getPiExecutionOptions(tenantId, options.disableWorkspaceSkills, options.disableWorkspaceExtensions);
  const sessionId = options.sessionId || `session_${Date.now()}`;
  const rawModel = options.model || "gemini-3.6-flash";
  let fullModel = rawModel;
  if (!rawModel.includes("/")) {
    if (rawModel.startsWith("gemini") || rawModel.startsWith("gemma") || rawModel.startsWith("deep-research")) {
      fullModel = `google/${rawModel}`;
    } else if (rawModel.startsWith("claude")) {
      fullModel = `anthropic/${rawModel}`;
    } else if (rawModel.startsWith("gpt") || rawModel.startsWith("o1") || rawModel.startsWith("o3")) {
      fullModel = `openai/${rawModel}`;
    } else {
      fullModel = `openrouter/${rawModel}`;
    }
  }
  const provider = fullModel.split("/")[0];
  syncPiUserAuthKeys(tenantId, options.customKey, provider);
  const piBin = import_fs3.default.existsSync(import_path3.default.resolve(process.cwd(), "node_modules/.bin/pi")) ? import_path3.default.resolve(process.cwd(), "node_modules/.bin/pi") : "pi";
  const executeAttempt = async (apiKey) => {
    const apiKeyStrategy = options.customKey ? "BYOK" : apiKey ? "Key Pool Rotation" : "System Fallback";
    const effectiveKey = apiKey || (options.customKey ? options.customKey : void 0) || (provider === "google" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY) || process.env.GEMINI_API_KEY;
    const env = {
      PATH: `${import_path3.default.resolve(process.cwd(), "node_modules/.bin")}:${process.env.PATH || "/usr/local/bin:/usr/bin:/bin"}`,
      HOME: process.env.HOME || "/tmp",
      TMPDIR: process.env.TMPDIR || "/tmp",
      NODE_ENV: process.env.NODE_ENV || "production",
      PI_CODING_AGENT_DIR: execOpts.piCodingAgentDir
    };
    if (effectiveKey) {
      if (provider === "google" || provider === "gemini") {
        env.GEMINI_API_KEY = effectiveKey;
        env.GOOGLE_GENERATIVE_AI_API_KEY = effectiveKey;
      } else if (provider === "openrouter") {
        env.OPENROUTER_API_KEY = effectiveKey;
      } else if (provider === "anthropic") {
        env.ANTHROPIC_API_KEY = effectiveKey;
      } else if (provider === "openai") {
        env.OPENAI_API_KEY = effectiveKey;
      } else if (provider === "mistral") {
        env.MISTRAL_API_KEY = effectiveKey;
      } else if (provider === "groq") {
        env.GROQ_API_KEY = effectiveKey;
      } else if (provider === "deepseek") {
        env.DEEPSEEK_API_KEY = effectiveKey;
      } else if (provider === "xai") {
        env.XAI_API_KEY = effectiveKey;
      } else if (provider === "azure") {
        env.AZURE_OPENAI_API_KEY = effectiveKey;
      } else if (provider === "together") {
        env.TOGETHER_API_KEY = effectiveKey;
      } else if (provider === "fireworks") {
        env.FIREWORKS_API_KEY = effectiveKey;
      } else if (provider === "perplexity") {
        env.PERPLEXITY_API_KEY = effectiveKey;
      } else {
        env.GEMINI_API_KEY = effectiveKey;
      }
    }
    let promptWithLang = options.prompt;
    if (options.agentLang === "FR") {
      promptWithLang += "\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in French (Fran\xE7ais).]";
    } else if (options.agentLang === "AR") {
      promptWithLang += "\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in Arabic (\u0627\u0644\u0639\u0631\u0628\u064A\u0629).]";
    } else if (options.agentLang === "EN") {
      promptWithLang += "\n\n[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in English.]";
    }
    const missionsPath = import_path3.default.join(userRoot, "missions.json");
    const workspacePath = import_path3.default.join(userRoot, "workspace.json");
    const harnessJsonPath2 = import_path3.default.join(userRoot, "harness.json");
    const filePaths = [missionsPath, workspacePath, harnessJsonPath2].filter((p) => import_fs3.default.existsSync(p)).map((p) => `@${p}`).join(" ");
    if (filePaths) {
      promptWithLang = `${filePaths}
${promptWithLang}`;
    }
    const args = [
      "-p",
      "--mode",
      "json",
      "--session-id",
      sessionId,
      "--model",
      fullModel,
      ...options.thinkingLevel && options.thinkingLevel !== "off" ? ["--thinking", options.thinkingLevel] : [],
      ...execOpts.cliFlags,
      promptWithLang
    ];
    const startTime = Date.now();
    const procKey = tenantId;
    let daemon = activePiDaemons.get(procKey);
    if (daemon && daemon.status !== "stopped") {
      if (daemon.sessionId !== sessionId || daemon.model !== fullModel) {
        daemon.kill();
        daemon = void 0;
      }
    }
    if (!daemon || daemon.status === "stopped") {
      daemon = new PiDaemonProcess(tenantId, sessionId, fullModel, apiKeyStrategy);
      activePiDaemons.set(procKey, daemon);
    }
    daemon.sessionId = sessionId;
    daemon.model = fullModel;
    daemon.status = "busy";
    daemon.lastActiveAt = (/* @__PURE__ */ new Date()).toISOString();
    return new Promise((resolve, reject) => {
      const child = (0, import_child_process.execFile)(piBin, args, {
        cwd: userRoot,
        env,
        maxBuffer: 20 * 1024 * 1024,
        timeout: 12e4
      }, (err, stdout, stderr) => {
        const executionTimeMs = Date.now() - startTime;
        if (daemon) {
          daemon.status = "idle";
          daemon.pid = child.pid;
        }
        recordPiProcessLog({
          id: `proc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          tenantId,
          sessionId,
          model: fullModel,
          prompt: options.prompt,
          command: "pi",
          args,
          executionTimeMs,
          stdout: stdout || "",
          stderr: stderr || "",
          ok: !err || Boolean(stdout),
          error: err ? err.message : void 0,
          apiKeyStrategy
        });
        if (err && !stdout) {
          if (daemon) daemon.status = "stopped";
          return reject(err);
        }
        resolve({ stdout, stderr });
      });
      if (daemon) daemon.child = child;
      activePiChildProcesses.set(procKey, child);
      if (child.stdin) {
        child.stdin.end();
      }
    });
  };
  if (options.customKey) {
    try {
      const { stdout } = await executeAttempt(options.customKey);
      const resParsed = parsePiJsonOutput(stdout, sessionId, fullModel);
      const inTokens = resParsed.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = resParsed.usage?.outputTokens || Math.max(20, Math.round((resParsed.text || "").length / 4));
      try {
        deductLlmCredits(tenantId, fullModel, inTokens, outTokens);
      } catch (_) {
      }
      updateHarnessState(tenantId, { status: "idle" });
      return resParsed;
    } catch (err) {
      const errRes = {
        ok: false,
        text: `Error executing pi agent: ${err.message}`,
        sessionId,
        model: fullModel,
        error: err.message
      };
      updateHarnessState(tenantId, { status: "idle" });
      return errRes;
    }
  }
  const userTier = getUserTier(tenantId);
  const isFreeTier = userTier.plan === "free";
  const isCardVerified = Boolean(userTier.hasVerifiedCard || userTier.cardVerified || userTier.paymentVerified || process.env.GEMINI_API_KEY || tenantId === "default_user");
  if (isFreeTier && !isCardVerified) {
    return {
      ok: false,
      text: "\u{1F4B3} **Card Verification Required**: To access the complimentary LLM key pool on the Free tier, please verify your payment card in Account Settings or provide a custom API key (BYOK).",
      sessionId,
      model: fullModel,
      error: "CARD_VERIFICATION_REQUIRED"
    };
  }
  const excludedKeyIds = /* @__PURE__ */ new Set();
  const targetProvider = provider === "google" || provider === "gemini" ? "gemini" : "openrouter";
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    attempts++;
    const keyItem = keyPoolManager.acquireKey(targetProvider, tenantId, excludedKeyIds);
    const apiKey = keyItem ? keyItem.rawDecryptedKey || keyItem.key : targetProvider === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY;
    if (!apiKey && !keyItem) break;
    try {
      const { stdout } = await executeAttempt(apiKey);
      const result = parsePiJsonOutput(stdout, sessionId, fullModel);
      if (result.error && (result.error.includes("429") || result.error.includes("quota") || result.error.includes("RESOURCE_EXHAUSTED"))) {
        if (keyItem) {
          keyPoolManager.markRateLimited(keyItem.id, 60);
          excludedKeyIds.add(keyItem.id);
        }
        if (!keyItem) break;
        continue;
      }
      if (keyItem) keyPoolManager.releaseKey(keyItem.id);
      const inTokens = result.usage?.inputTokens || Math.max(50, Math.round(options.prompt.length / 4));
      const outTokens = result.usage?.outputTokens || Math.max(20, Math.round((result.text || "").length / 4));
      try {
        deductLlmCredits(tenantId, fullModel, inTokens, outTokens);
      } catch (_) {
      }
      updateHarnessState(tenantId, { status: "idle" });
      try {
        clearUserActions(tenantId);
      } catch (_) {
      }
      return result;
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      const isRateLimit = msg.includes("429") || msg.includes("503") || msg.includes("quota") || msg.includes("resource_exhausted");
      if (isRateLimit && keyItem) {
        keyPoolManager.markRateLimited(keyItem.id, 60);
        excludedKeyIds.add(keyItem.id);
      } else if (keyItem) {
        keyPoolManager.releaseKey(keyItem.id);
      }
      if (!keyItem) break;
    }
  }
  const limitRes = {
    ok: false,
    text: "Rate limit temporarily reached due to high platform traffic. Shared complimentary tokens are currently busy. Please wait 30 seconds or configure your custom API key (BYOK).",
    sessionId,
    model: fullModel,
    error: "RATE_LIMIT_EXHAUSTED"
  };
  updateHarnessState(tenantId, { status: "idle" });
  return limitRes;
}
function parsePiJsonOutput(stdout, sessionId, model) {
  let finalText = "";
  let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let errorMessage = void 0;
  const lines = stdout.split("\n");
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "turn_end" && event.message) {
        const msg = event.message;
        if (typeof msg.content === "string") {
          finalText = msg.content;
        } else if (Array.isArray(msg.content)) {
          finalText = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
        }
        if (msg.usage) {
          usage.inputTokens += msg.usage.input || 0;
          usage.outputTokens += msg.usage.output || 0;
          usage.totalTokens += msg.usage.totalTokens || usage.inputTokens + usage.outputTokens;
        }
        if (msg.errorMessage) errorMessage = msg.errorMessage;
      }
      if (event.type === "agent_end") {
        const msgs = event.messages || [];
        const lastAssistant = msgs.filter((m) => m.role === "assistant").pop();
        if (lastAssistant) {
          if (typeof lastAssistant.content === "string") {
            finalText = lastAssistant.content;
          } else if (Array.isArray(lastAssistant.content)) {
            finalText = lastAssistant.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
          }
          if (lastAssistant.errorMessage) errorMessage = lastAssistant.errorMessage;
        }
      }
    } catch (_) {
    }
  }
  return {
    ok: !errorMessage,
    text: finalText || (errorMessage ? `Agent notice: ${errorMessage}` : "Task completed."),
    sessionId,
    model,
    usage,
    error: errorMessage
  };
}
function listPiSessions(tenantId = "default_user") {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDirs = [
    import_path3.default.join(userRoot, ".pi", "agent", "sessions"),
    import_path3.default.join(userRoot, ".pi", "sessions")
  ];
  const items = [];
  const processedIds = /* @__PURE__ */ new Set();
  for (const sessionDir of sessionDirs) {
    if (!import_fs3.default.existsSync(sessionDir)) continue;
    const files = import_fs3.default.readdirSync(sessionDir).filter((f) => f.endsWith(".jsonl") || f.endsWith(".json"));
    for (const f of files) {
      const fullPath = import_path3.default.join(sessionDir, f);
      const id = f.replace(/\.jsonl?$/, "");
      if (processedIds.has(id)) continue;
      processedIds.add(id);
      try {
        const stats = import_fs3.default.statSync(fullPath);
        const content = import_fs3.default.readFileSync(fullPath, "utf8");
        const lines = content.split("\n").filter(Boolean);
        let messageCount = 0;
        let tokensUsed = 0;
        const history = [];
        for (const l of lines) {
          try {
            const entry = JSON.parse(l);
            if (entry.type === "turn_end" || entry.type === "message_end" || entry.role) {
              const role = entry.role || entry.message?.role;
              let text = "";
              const rawContent = entry.content || entry.message?.content;
              if (typeof rawContent === "string") text = rawContent;
              else if (Array.isArray(rawContent)) text = rawContent.filter((c) => c.type === "text").map((c) => c.text).join("\n");
              if (text && (role === "user" || role === "assistant" || role === "agent")) {
                messageCount++;
                history.push({
                  sender: role === "user" ? "user" : "agent",
                  text,
                  timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : stats.mtime.toISOString()
                });
              }
              if (entry.message?.usage?.totalTokens) tokensUsed += entry.message.usage.totalTokens;
            }
          } catch (_) {
          }
        }
        const name = `Session ${items.length + 1} (${id.slice(0, 8)})`;
        items.push({
          id,
          name,
          path: import_path3.default.relative(userRoot, fullPath),
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
          messageCount,
          tokensUsed,
          history
        });
      } catch (_) {
      }
    }
  }
  items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return items;
}
function createPiSession(tenantId = "default_user", name) {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDir = import_path3.default.join(userRoot, ".pi", "agent", "sessions");
  import_fs3.default.mkdirSync(sessionDir, { recursive: true });
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const filePath = import_path3.default.join(sessionDir, `${id}.jsonl`);
  const initialHeader = {
    type: "session_start",
    sessionId: id,
    tenantId,
    timestamp: Date.now()
  };
  import_fs3.default.writeFileSync(filePath, JSON.stringify(initialHeader) + "\n", "utf8");
  return {
    id,
    name: name || `Session (${id.slice(-6)})`,
    path: import_path3.default.relative(userRoot, filePath),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    messageCount: 0,
    tokensUsed: 0,
    history: []
  };
}
function deletePiSession(tenantId = "default_user", sessionId) {
  ensureUserHarness(tenantId);
  const userRoot = getTenantRoot(tenantId);
  const sessionDirs = [
    import_path3.default.join(userRoot, ".pi", "agent", "sessions"),
    import_path3.default.join(userRoot, ".pi", "sessions")
  ];
  let deleted = false;
  for (const sessionDir of sessionDirs) {
    if (!import_fs3.default.existsSync(sessionDir)) continue;
    const filePath = import_path3.default.join(sessionDir, `${sessionId}.jsonl`);
    const altPath = import_path3.default.join(sessionDir, `${sessionId}.json`);
    if (import_fs3.default.existsSync(filePath)) {
      import_fs3.default.unlinkSync(filePath);
      deleted = true;
    }
    if (import_fs3.default.existsSync(altPath)) {
      import_fs3.default.unlinkSync(altPath);
      deleted = true;
    }
  }
  return deleted;
}
function removeReviewItem(tenantId = "default_user", itemId) {
  const current = getHarnessState(tenantId);
  const filtered = (current.review || []).filter((r) => r.id !== itemId);
  updateHarnessState(tenantId, { review: filtered });
}
function setReviewItemFeedback(tenantId = "default_user", itemId, feedback) {
  const current = getHarnessState(tenantId);
  const updated = (current.review || []).map(
    (r) => r.id === itemId ? { ...r, type: "reviewed", feedback } : r
  );
  updateHarnessState(tenantId, { review: updated });
}
var DEFAULT_PI_CLI_FALLBACK_MODELS = [
  { provider: "google", model: "gemini-3.6-flash", fullModel: "google/gemini-3.6-flash", context: "1.0M", maxOutput: "65.5K", thinking: true, images: true },
  { provider: "google", model: "gemini-2.0-flash", fullModel: "google/gemini-2.0-flash", context: "1.0M", maxOutput: "8.2K", thinking: false, images: true },
  { provider: "google", model: "gemma-4-31b-it", fullModel: "google/gemma-4-31b-it", context: "262.1K", maxOutput: "32.8K", thinking: true, images: true },
  { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", fullModel: "openrouter/anthropic/claude-3.5-sonnet", context: "200K", maxOutput: "8K", thinking: true, images: true },
  { provider: "openrouter", model: "deepseek/deepseek-r1", fullModel: "openrouter/deepseek/deepseek-r1", context: "128K", maxOutput: "8K", thinking: true, images: false },
  { provider: "openrouter", model: "openai/gpt-4o", fullModel: "openrouter/openai/gpt-4o", context: "128K", maxOutput: "4K", thinking: false, images: true },
  { provider: "anthropic", model: "claude-3-5-sonnet-latest", fullModel: "anthropic/claude-3-5-sonnet-latest", context: "200K", maxOutput: "8K", thinking: true, images: true },
  { provider: "openai", model: "gpt-4o", fullModel: "openai/gpt-4o", context: "128K", maxOutput: "4K", thinking: false, images: true }
];
function listPiModels() {
  try {
    let piBin = "pi";
    if (import_fs3.default.existsSync("/app/applet/node_modules/.bin/pi")) piBin = "/app/applet/node_modules/.bin/pi";
    else if (import_fs3.default.existsSync("./node_modules/.bin/pi")) piBin = "./node_modules/.bin/pi";
    const stdout = (0, import_child_process.execFileSync)(piBin, ["--list-models"], { encoding: "utf8", timeout: 1e4 });
    const items = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim() || line.startsWith("provider")) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        items.push({
          provider: parts[0],
          model: parts[1],
          fullModel: `${parts[0]}/${parts[1]}`,
          context: parts[2] || "128K",
          maxOutput: parts[3] || "8K",
          thinking: parts[4] === "yes",
          images: parts[5] === "yes"
        });
      }
    }
    return items.length > 0 ? items : DEFAULT_PI_CLI_FALLBACK_MODELS;
  } catch (_) {
    return DEFAULT_PI_CLI_FALLBACK_MODELS;
  }
}

// src/core/workspace.ts
function syncWorkspaceJson(tenantId = "default_user") {
  const userRoot = getTenantRoot(tenantId);
  const workspaceJsonPath = import_path4.default.join(userRoot, "workspace.json");
  const workspaceDir = import_path4.default.join(userRoot, "workspace");
  const workspaceDirs = [
    "Discovery & Scoping",
    "Deep Research & Intelligence Gathering",
    "Data Analysis & Pattern Extraction",
    "Strategic Synthesis & Decision Support",
    "Executions",
    "Reviews",
    "Completed"
  ];
  for (const d of workspaceDirs) {
    import_fs4.default.mkdirSync(import_path4.default.join(workspaceDir, d), { recursive: true });
  }
  const oldSourcesDir = import_path4.default.join(workspaceDir, "Sources");
  const oldDeliverablesDir = import_path4.default.join(workspaceDir, "Deliverables");
  const moveLegacyFolderContents = (parentOldDir, folderName) => {
    const srcPath = import_path4.default.join(parentOldDir, folderName);
    const destPath = import_path4.default.join(workspaceDir, folderName);
    if (import_fs4.default.existsSync(srcPath)) {
      try {
        import_fs4.default.mkdirSync(destPath, { recursive: true });
        const files = import_fs4.default.readdirSync(srcPath);
        for (const f of files) {
          try {
            import_fs4.default.renameSync(import_path4.default.join(srcPath, f), import_path4.default.join(destPath, f));
          } catch (_) {
          }
        }
        try {
          import_fs4.default.rmdirSync(srcPath);
        } catch (_) {
        }
      } catch (_) {
      }
    }
  };
  if (import_fs4.default.existsSync(oldSourcesDir)) {
    for (const d of ["Discovery & Scoping", "Deep Research & Intelligence Gathering", "Data Analysis & Pattern Extraction", "Strategic Synthesis & Decision Support"]) {
      moveLegacyFolderContents(oldSourcesDir, d);
    }
    try {
      import_fs4.default.rmdirSync(oldSourcesDir);
    } catch (_) {
    }
  }
  if (import_fs4.default.existsSync(oldDeliverablesDir)) {
    for (const d of ["Executions", "Reviews", "Completed"]) {
      moveLegacyFolderContents(oldDeliverablesDir, d);
    }
    try {
      import_fs4.default.rmdirSync(oldDeliverablesDir);
    } catch (_) {
    }
  }
  const existingMetadataMap = /* @__PURE__ */ new Map();
  if (import_fs4.default.existsSync(workspaceJsonPath)) {
    try {
      const parsed = JSON.parse(import_fs4.default.readFileSync(workspaceJsonPath, "utf8"));
      const collectMetadata = (list) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (item && item.path) {
            existingMetadataMap.set(item.path, item);
          }
        }
      };
      if (parsed.discovery_and_scoping) collectMetadata(parsed.discovery_and_scoping);
      if (parsed.deep_research) collectMetadata(parsed.deep_research);
      if (parsed.data_analysis) collectMetadata(parsed.data_analysis);
      if (parsed.strategic_synthesis) collectMetadata(parsed.strategic_synthesis);
      if (parsed.executions) collectMetadata(parsed.executions);
      if (parsed.reviews) collectMetadata(parsed.reviews);
      if (parsed.completed) collectMetadata(parsed.completed);
      if (parsed.all) collectMetadata(parsed.all);
      if (parsed.sources) collectMetadata(parsed.sources.all);
      if (parsed.deliverables) collectMetadata(parsed.deliverables.all);
    } catch (_) {
    }
  }
  const scanDir = (dir) => {
    if (!import_fs4.default.existsSync(dir)) return [];
    const results = [];
    try {
      const entries = import_fs4.default.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = import_path4.default.join(dir, entry.name);
        const relPath = import_path4.default.relative(userRoot, fullPath);
        const isDir = entry.isDirectory();
        let size = 0;
        let modifiedAt = (/* @__PURE__ */ new Date()).toISOString();
        try {
          const st = import_fs4.default.statSync(fullPath);
          size = st.size;
          modifiedAt = st.mtime.toISOString();
        } catch (_) {
        }
        const existing = existingMetadataMap.get(relPath);
        let sourceType = "Generated";
        if (existing?.source_type === "Imported" || existing?.source_type === "Generated") {
          sourceType = existing.source_type;
        } else if (existing?.type === "imported" || existing?.isImport) {
          sourceType = "Imported";
        } else {
          sourceType = "Generated";
        }
        const item = {
          name: entry.name,
          path: relPath,
          isDirectory: isDir,
          type: existing?.type || (isDir ? "directory" : "file"),
          source_type: sourceType,
          level: existing?.level || { maturity: "production", readability: "high" },
          description: existing?.description || `Workspace ${isDir ? "directory" : "file"}: ${entry.name}`,
          when_to_use: existing?.when_to_use || `Referenced when processing ${entry.name} in mission or workspace tasks`,
          triggers: existing?.triggers || [entry.name, isDir ? "folder" : "file"],
          size,
          modified_at: modifiedAt
        };
        results.push(item);
        if (isDir) {
          results.push(...scanDir(fullPath));
        }
      }
    } catch (_) {
    }
    return results;
  };
  const discoveryAndScoping = scanDir(import_path4.default.join(workspaceDir, "Discovery & Scoping"));
  const deepResearch = scanDir(import_path4.default.join(workspaceDir, "Deep Research & Intelligence Gathering"));
  const dataAnalysis = scanDir(import_path4.default.join(workspaceDir, "Data Analysis & Pattern Extraction"));
  const strategicSynthesis = scanDir(import_path4.default.join(workspaceDir, "Strategic Synthesis & Decision Support"));
  const executions = scanDir(import_path4.default.join(workspaceDir, "Executions"));
  const reviews = scanDir(import_path4.default.join(workspaceDir, "Reviews"));
  const completed = scanDir(import_path4.default.join(workspaceDir, "Completed"));
  const allScannedItems = scanDir(workspaceDir);
  const workspaceMap = {
    discovery_and_scoping: discoveryAndScoping,
    deep_research: deepResearch,
    data_analysis: dataAnalysis,
    strategic_synthesis: strategicSynthesis,
    executions,
    reviews,
    completed,
    all: allScannedItems,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  try {
    import_fs4.default.writeFileSync(workspaceJsonPath, JSON.stringify(workspaceMap, null, 2), "utf8");
  } catch (err) {
    console.warn(`[WorkspaceCore] Failed writing workspace.json for ${tenantId}:`, err);
  }
  return workspaceMap;
}
function getWorkspaceMap(tenantId = "default_user") {
  const userRoot = getTenantRoot(tenantId);
  const workspaceJsonPath = import_path4.default.join(userRoot, "workspace.json");
  if (import_fs4.default.existsSync(workspaceJsonPath)) {
    try {
      const parsed = JSON.parse(import_fs4.default.readFileSync(workspaceJsonPath, "utf8"));
      let needsResync = false;
      const checkItems = (list) => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (item && item.path && !item.source_type) {
            needsResync = true;
            break;
          }
        }
      };
      if (parsed.discovery_and_scoping) checkItems(parsed.discovery_and_scoping);
      if (parsed.deep_research) checkItems(parsed.deep_research);
      if (parsed.data_analysis) checkItems(parsed.data_analysis);
      if (parsed.strategic_synthesis) checkItems(parsed.strategic_synthesis);
      if (parsed.executions) checkItems(parsed.executions);
      if (parsed.reviews) checkItems(parsed.reviews);
      if (parsed.completed) checkItems(parsed.completed);
      if (parsed.all) checkItems(parsed.all);
      if (!needsResync) {
        return parsed;
      }
    } catch (_) {
    }
  }
  return syncWorkspaceJson(tenantId);
}
function listWorkspaceItemsFromJson(tenantId = "default_user", subDir = "") {
  let targetPath = subDir.trim();
  if (targetPath.includes("..")) {
    throw new Error("Security Violation: Path traversal attempt blocked.");
  }
  if (targetPath) {
    resolveUserPath(tenantId, targetPath);
  }
  const map = getWorkspaceMap(tenantId);
  const pathMap = /* @__PURE__ */ new Map();
  const addItems = (list) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (item && item.path && !pathMap.has(item.path)) {
        pathMap.set(item.path, item);
      }
    }
  };
  if (map.discovery_and_scoping) addItems(map.discovery_and_scoping);
  if (map.deep_research) addItems(map.deep_research);
  if (map.data_analysis) addItems(map.data_analysis);
  if (map.strategic_synthesis) addItems(map.strategic_synthesis);
  if (map.executions) addItems(map.executions);
  if (map.reviews) addItems(map.reviews);
  if (map.completed) addItems(map.completed);
  if (map.all) addItems(map.all);
  if (map.sources) addItems(map.sources.all);
  if (map.deliverables) addItems(map.deliverables.all);
  const items = Array.from(pathMap.values());
  if (!targetPath || targetPath === "workspace" || targetPath === "/") {
    return items;
  }
  const normSubDir = targetPath.replace(/\\/g, "/").replace(/\/$/, "");
  return items.filter((item) => {
    const normItemPath = item.path.replace(/\\/g, "/");
    return normItemPath === normSubDir || normItemPath.startsWith(normSubDir + "/");
  });
}
function createWorkspaceItem(tenantId = "default_user", params) {
  const { path: relPath, content = "", type, source_type, level, description, when_to_use, triggers, isImport = false } = params;
  const resolvedSourceType = source_type || (isImport || type === "imported" ? "Imported" : "Generated");
  const writeRes = writeUserFile(tenantId, relPath, content, isImport, {
    type,
    source_type: resolvedSourceType,
    level,
    description,
    when_to_use,
    triggers
  });
  const filename = import_path4.default.basename(relPath);
  const item = {
    name: filename,
    path: relPath,
    isDirectory: false,
    type: type || (isImport ? "imported" : "file"),
    source_type: resolvedSourceType,
    level: level || { maturity: isImport ? "draft" : "production", readability: "high" },
    description: description || `Workspace file: ${filename}`,
    when_to_use: when_to_use || `Referenced when processing ${filename} in mission or workspace tasks`,
    triggers: triggers || [filename, isImport ? "import" : "file"],
    size: writeRes.size,
    modified_at: (/* @__PURE__ */ new Date()).toISOString(),
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  syncWorkspaceJson(tenantId);
  return {
    path: writeRes.path,
    size: writeRes.size,
    item
  };
}
function getWorkspaceArtifactsFromIndex(tenantId = "default_user", existingMission) {
  const map = getWorkspaceMap(tenantId);
  const processedMap = /* @__PURE__ */ new Map();
  if (existingMission) {
    (existingMission.sources || []).forEach((s) => processedMap.set(s.path, s.processed));
    (existingMission.deliverables || []).forEach((d) => processedMap.set(d.path, d.processed));
    (existingMission.workspace_files || []).forEach((w) => processedMap.set(w.path, w.processed || false));
  }
  const allItems = map.all || [];
  const workspaceFiles = allItems.map((item) => ({
    name: item.name,
    path: item.path,
    isDirectory: item.isDirectory,
    type: item.type,
    source_type: item.source_type,
    level: item.level,
    description: item.description,
    when_to_use: item.when_to_use,
    triggers: item.triggers,
    processed: processedMap.get(item.path) || false,
    size: item.size,
    modified_at: item.modified_at
  }));
  return { workspaceFiles, sources: workspaceFiles, deliverables: workspaceFiles };
}
function syncTenantWorkspace(tenantId = "default_user") {
  const map = syncWorkspaceJson(tenantId);
  const syncedFilesCount = map ? map.all ? map.all.length : 0 : 0;
  appendTenantAuditLog(tenantId, {
    type: "system",
    event: "Workspace Synced",
    details: { syncedFilesCount }
  });
  return {
    tenantId,
    syncedFilesCount,
    newGapsFilled: 0,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
var PROTECTED_SECURITY_FILES = ["keys.json", "auth.json", "key_pools.json", ".env", ".env.local", ".env.production", "secrets.json"];
function isProtectedSecurityPath(filePath) {
  const norm = filePath.replace(/\\/g, "/").toLowerCase();
  const baseName = import_path4.default.basename(norm);
  return PROTECTED_SECURITY_FILES.includes(baseName) || norm.includes(".stash") || norm.includes("/.stash/") || baseName.startsWith(".env");
}
function resolveUserPath(tenantId, relativePath = "") {
  const userRoot = getTenantRoot(tenantId);
  const resolved = import_path4.default.resolve(userRoot, relativePath);
  if (!resolved.startsWith(userRoot)) {
    throw new Error(`Security Violation: Access denied outside tenant workspace boundary (${userRoot}).`);
  }
  const relFromRoot = import_path4.default.relative(userRoot, resolved);
  if (isProtectedSecurityPath(relFromRoot)) {
    throw new Error(`Security Violation: Access denied to protected server security/key store file (${import_path4.default.basename(resolved)}). Server keys and key pools are strictly isolated.`);
  }
  return resolved;
}
function readUserFile(tenantId, relativePath) {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!import_fs4.default.existsSync(targetPath) || import_fs4.default.statSync(targetPath).isDirectory()) {
    throw new Error(`File not found or is a directory: ${relativePath}`);
  }
  const content = import_fs4.default.readFileSync(targetPath, "utf8");
  const userRoot = getTenantRoot(tenantId);
  return {
    content,
    path: import_path4.default.relative(userRoot, targetPath),
    size: Buffer.byteLength(content, "utf8")
  };
}
function writeUserFile(tenantId, relativePath, content, isImport = false, options) {
  const targetPath = resolveUserPath(tenantId, relativePath);
  const parentDir = import_path4.default.dirname(targetPath);
  import_fs4.default.mkdirSync(parentDir, { recursive: true });
  import_fs4.default.writeFileSync(targetPath, content, "utf8");
  const userRoot = getTenantRoot(tenantId);
  const normPath = import_path4.default.relative(userRoot, targetPath);
  const size = Buffer.byteLength(content, "utf8");
  appendTenantAuditLog(tenantId, {
    type: "user",
    event: "File Written",
    details: { path: normPath, size }
  });
  return {
    path: normPath,
    size
  };
}
function moveUserFile(tenantId, srcRelativePath, destRelativePath) {
  const srcPath = resolveUserPath(tenantId, srcRelativePath);
  const destPath = resolveUserPath(tenantId, destRelativePath);
  if (!import_fs4.default.existsSync(srcPath)) {
    throw new Error(`Source file or folder does not exist: ${srcRelativePath}`);
  }
  import_fs4.default.mkdirSync(import_path4.default.dirname(destPath), { recursive: true });
  import_fs4.default.renameSync(srcPath, destPath);
  const userRoot = getTenantRoot(tenantId);
  const normSrc = import_path4.default.relative(userRoot, srcPath);
  const normDest = import_path4.default.relative(userRoot, destPath);
  let size = 0;
  try {
    size = import_fs4.default.statSync(destPath).size;
  } catch (_) {
  }
  return { src: normSrc, dest: normDest, size };
}
function deleteUserFile(tenantId, relativePath) {
  const targetPath = resolveUserPath(tenantId, relativePath);
  if (!import_fs4.default.existsSync(targetPath)) return false;
  const userRoot = getTenantRoot(tenantId);
  const normPath = import_path4.default.relative(userRoot, targetPath);
  const stat = import_fs4.default.statSync(targetPath);
  if (stat.isDirectory()) {
    import_fs4.default.rmSync(targetPath, { recursive: true, force: true });
  } else {
    import_fs4.default.unlinkSync(targetPath);
  }
  return true;
}

// src/api/routes/workspace.routes.ts
var router3 = (0, import_express3.Router)();
router3.get("/files", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const subDir = req.query.path || "";
  try {
    const files = listWorkspaceItemsFromJson(tenantId, subDir);
    res.json({ ok: true, files });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
router3.post("/create", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { path: filePath, content, type, source_type, level, description, when_to_use, triggers, isImport } = req.body || {};
  if (!filePath) {
    res.status(400).json({ ok: false, error: "Path is required." });
    return;
  }
  try {
    const result = createWorkspaceItem(tenantId, {
      path: filePath,
      content: content || "",
      type,
      source_type,
      level,
      description,
      when_to_use,
      triggers,
      isImport: Boolean(isImport)
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
router3.get("/file/read", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const filePath = req.query.path;
  if (!filePath) {
    res.status(400).json({ ok: false, error: "File path is required." });
    return;
  }
  try {
    const fileData = readUserFile(tenantId, filePath);
    res.json({ ok: true, ...fileData });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});
router3.post("/file/write", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { path: filePath, content, isImport, type, source_type, level, description, when_to_use, triggers } = req.body || {};
  if (!filePath || content === void 0) {
    res.status(400).json({ ok: false, error: "Path and content are required." });
    return;
  }
  try {
    const result = writeUserFile(tenantId, filePath, content, Boolean(isImport), {
      type,
      source_type,
      level,
      description,
      when_to_use,
      triggers
    });
    syncWorkspaceJson(tenantId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
router3.post("/file/move", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { src, dest } = req.body || {};
  if (!src || !dest) {
    res.status(400).json({ ok: false, error: "src and dest paths are required." });
    return;
  }
  try {
    const result = moveUserFile(tenantId, src, dest);
    syncWorkspaceJson(tenantId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
router3.post("/file/delete", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { path: filePath } = req.body || {};
  if (!filePath) {
    res.status(400).json({ ok: false, error: "Path is required." });
    return;
  }
  try {
    const deleted = deleteUserFile(tenantId, filePath);
    syncWorkspaceJson(tenantId);
    res.json({ ok: deleted });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});
router3.get("/map", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const map = getWorkspaceMap(tenantId);
  res.json({ ok: true, map });
});
var workspace_routes_default = router3;

// src/api/routes/missions.routes.ts
var import_express4 = require("express");

// src/core/missions.ts
var import_fs5 = __toESM(require("fs"), 1);
var import_path5 = __toESM(require("path"), 1);
function getMissionSchema(missionType = "standard") {
  const normType = (missionType || "standard").replace(/^system_/, "").toLowerCase();
  return {
    type: normType,
    title: `${normType.toUpperCase()} Mission Schema`,
    protected: true,
    version: "3.0.0",
    supported_phases: ["discovery", "blueprint", "scaffold", "execute", "review"],
    phase_selection: "multi_or_single",
    storage_paths: {
      scratchpad: "missions/{missionId}/",
      workspace: "workspace/",
      discovery_and_scoping: "workspace/Discovery & Scoping/",
      deep_research: "workspace/Deep Research & Intelligence Gathering/",
      data_analysis: "workspace/Data Analysis & Pattern Extraction/",
      strategic_synthesis: "workspace/Strategic Synthesis & Decision Support/",
      executions: "workspace/Executions/",
      reviews: "workspace/Reviews/",
      completed: "workspace/Completed/",
      state_index: "missions.json",
      workspace_index: "workspace.json",
      event_stream: "logs.json"
    },
    pipeline: {
      stages: ["discovery", "blueprint", "scaffold", "execute", "review"]
    }
  };
}
function scanWorkspaceArtifacts(tenantId = "default_user", existingMission) {
  return getWorkspaceArtifactsFromIndex(tenantId, existingMission);
}
function ensureMissionWorkspaceDirs(tenantId, missionType, missionId) {
  const normType = (missionType || "standard").replace(/^system_/, "");
  const userRoot = getTenantRoot(tenantId);
  const baseDir = import_path5.default.join(userRoot, "missions", missionId);
  import_fs5.default.mkdirSync(baseDir, { recursive: true });
  const workspaceDir = import_path5.default.join(userRoot, "workspace");
  const dirs = [
    "Discovery & Scoping",
    "Deep Research & Intelligence Gathering",
    "Data Analysis & Pattern Extraction",
    "Strategic Synthesis & Decision Support",
    "Executions",
    "Reviews",
    "Completed"
  ];
  for (const d of dirs) {
    import_fs5.default.mkdirSync(import_path5.default.join(workspaceDir, d), { recursive: true });
  }
  return { baseDir, workspaceDir, normType };
}
function saveMissionToStore(tenantId = "default_user", mission) {
  const userRoot = getTenantRoot(tenantId);
  const singleMissionsPath = import_path5.default.join(userRoot, "missions.json");
  let missions = [];
  if (import_fs5.default.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(import_fs5.default.readFileSync(singleMissionsPath, "utf8"));
      missions = Array.isArray(parsed) ? parsed : parsed.missions || [];
    } catch (_) {
    }
  }
  const { sources, deliverables } = scanWorkspaceArtifacts(tenantId, mission);
  const updatedMission = {
    ...mission,
    sources,
    deliverables
  };
  const idx = missions.findIndex((m) => m.id === mission.id);
  if (idx >= 0) {
    missions[idx] = updatedMission;
  } else {
    missions.push(updatedMission);
  }
  const missionsDir = import_path5.default.join(userRoot, "missions");
  const mTempDir = import_path5.default.join(missionsDir, mission.id);
  if (!import_fs5.default.existsSync(mTempDir)) {
    import_fs5.default.mkdirSync(mTempDir, { recursive: true });
  }
  import_fs5.default.writeFileSync(singleMissionsPath, JSON.stringify({ missions }, null, 2), "utf8");
}
function syncMissionWorkspaceArtifacts(mission) {
  if (!mission || !mission.id) return null;
  const tenantId = mission.user_id || "default_user";
  const mType = mission.type || "standard";
  const { baseDir, workspaceDir } = ensureMissionWorkspaceDirs(tenantId, mType, mission.id);
  try {
    const { workspaceFiles, sources, deliverables } = scanWorkspaceArtifacts(tenantId, mission);
    const updatedMission = {
      ...mission,
      sources,
      deliverables,
      workspace_files: workspaceFiles
    };
    saveMissionToStore(tenantId, updatedMission);
  } catch (err) {
    console.warn(`[MissionsCore] Failed syncing mission workspace artifacts:`, err);
  }
  return { baseDir, workspaceDir };
}
function syncMissionsJson(tenantId = "default_user") {
  const userRoot = getTenantRoot(tenantId);
  const missionsDir = import_path5.default.join(userRoot, "missions");
  const singleMissionsPath = import_path5.default.join(userRoot, "missions.json");
  if (!import_fs5.default.existsSync(missionsDir)) {
    import_fs5.default.mkdirSync(missionsDir, { recursive: true });
  }
  let existingMissions = [];
  if (import_fs5.default.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(import_fs5.default.readFileSync(singleMissionsPath, "utf8"));
      existingMissions = Array.isArray(parsed) ? parsed : parsed.missions || [];
    } catch (_) {
    }
  }
  const updatedMissions = existingMissions.map((m) => {
    if (!m || !m.id) return m;
    const mTempDir = import_path5.default.join(missionsDir, m.id);
    if (!import_fs5.default.existsSync(mTempDir)) {
      import_fs5.default.mkdirSync(mTempDir, { recursive: true });
    }
    const { sources, deliverables } = scanWorkspaceArtifacts(tenantId, m);
    return {
      ...m,
      sources,
      deliverables
    };
  });
  import_fs5.default.writeFileSync(
    singleMissionsPath,
    JSON.stringify({ missions: updatedMissions }, null, 2),
    "utf8"
  );
  return updatedMissions;
}
function getMissionsData(tenantId = "default_user") {
  const userRoot = getTenantRoot(tenantId);
  const singleMissionsPath = import_path5.default.join(userRoot, "missions.json");
  syncMissionsJson(tenantId);
  if (import_fs5.default.existsSync(singleMissionsPath)) {
    try {
      const parsed = JSON.parse(import_fs5.default.readFileSync(singleMissionsPath, "utf8"));
      return {
        missions: Array.isArray(parsed.missions) ? parsed.missions : []
      };
    } catch (_) {
    }
  }
  return { missions: [] };
}
function getMissions(tenantId = "default_user") {
  return syncMissionsJson(tenantId);
}
function createMission(tenantId = "default_user", missionData) {
  const id = `msn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newMission = {
    id,
    title: missionData.title,
    objective: missionData.objective,
    type: missionData.type || "standard",
    user_id: tenantId,
    status: "drafting",
    phase: "discovery",
    scratchpad: `missions/${id}/`,
    metadata: { tasks: [] },
    workflow_history: [
      { timestamp: (/* @__PURE__ */ new Date()).toISOString(), phase: "discovery", status: "created" }
    ],
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  syncMissionWorkspaceArtifacts(newMission);
  appendTenantAuditLog(tenantId, {
    type: "mission",
    event: "Mission Created",
    mission_id: id,
    details: { title: newMission.title, type: newMission.type }
  });
  return newMission;
}
function updateMission(tenantId = "default_user", missionId, updates) {
  const missions = getMissions(tenantId);
  const target = missions.find((m) => m.id === missionId);
  if (!target) return null;
  const isMoved = updates.phase && updates.phase !== target.phase || updates.status && updates.status !== target.status;
  const newPhase = updates.phase || target.phase;
  const newStatus = updates.status || target.status;
  if (isMoved && target.deliverables && target.deliverables.length > 0) {
    let destSubDir = "workspace/Executions";
    if (newStatus === "completed" || newPhase === "review") {
      destSubDir = newStatus === "completed" ? "workspace/Completed" : "workspace/Reviews";
    } else if (newPhase === "discovery" || newPhase === "blueprint") {
      destSubDir = "workspace/Discovery & Scoping";
    }
    for (const deliv of target.deliverables) {
      if (!deliv.path) continue;
      const fileName = import_path5.default.basename(deliv.path);
      const destPath = `${destSubDir}/${fileName}`;
      if (deliv.path !== destPath) {
        try {
          moveUserFile(tenantId, deliv.path, destPath);
          deliv.path = destPath;
        } catch (_) {
        }
      }
    }
  }
  const updated = {
    ...target,
    ...updates,
    id: missionId,
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  syncMissionWorkspaceArtifacts(updated);
  syncWorkspaceJson(tenantId);
  return updated;
}
function deleteMission(tenantId = "default_user", missionId) {
  const userRoot = getTenantRoot(tenantId);
  const missionDir = import_path5.default.join(userRoot, "missions", missionId);
  if (import_fs5.default.existsSync(missionDir)) {
    import_fs5.default.rmSync(missionDir, { recursive: true, force: true });
  }
  const missions = getMissions(tenantId);
  const target = missions.find((m) => m.id === missionId);
  if (target && target.deliverables) {
    for (const deliv of target.deliverables) {
      if (deliv.path) {
        try {
          deleteUserFile(tenantId, deliv.path);
        } catch (_) {
        }
      }
    }
  }
  const filteredMissions = missions.filter((m) => m.id !== missionId);
  const singleMissionsPath = import_path5.default.join(userRoot, "missions.json");
  import_fs5.default.writeFileSync(singleMissionsPath, JSON.stringify({ missions: filteredMissions }, null, 2), "utf8");
  syncWorkspaceJson(tenantId);
  return true;
}

// src/api/routes/missions.routes.ts
var router4 = (0, import_express4.Router)();
router4.get("/", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const missions = getMissions(tenantId);
  res.json({ ok: true, missions });
});
router4.get("/data", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const storeData = getMissionsData(tenantId);
  res.json({ ok: true, ...storeData });
});
router4.post("/create", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { title, objective, type } = req.body || {};
  if (!title || !objective) {
    res.status(400).json({ ok: false, error: "Title and objective are required." });
    return;
  }
  const mission = createMission(tenantId, { title, objective, type });
  res.json({ ok: true, mission });
});
router4.post("/update", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { id, ...updates } = req.body || {};
  if (!id) {
    res.status(400).json({ ok: false, error: "Mission ID is required." });
    return;
  }
  const updated = updateMission(tenantId, id, updates);
  if (!updated) {
    res.status(404).json({ ok: false, error: "Mission not found." });
    return;
  }
  res.json({ ok: true, mission: updated });
});
router4.post("/delete", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ ok: false, error: "Mission ID is required." });
    return;
  }
  const deleted = deleteMission(tenantId, id);
  res.json({ ok: deleted });
});
router4.get("/schema", (req, res) => {
  const type = req.query.type || "standard";
  const schema = getMissionSchema(type);
  res.json({ ok: true, schema });
});
var missions_routes_default = router4;

// src/api/routes/harness.routes.ts
var import_express5 = require("express");
var router5 = (0, import_express5.Router)();
router5.post("/run", async (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { prompt, sessionId, model, customKey, agentLang, webSearchEnabled, thinkingLevel } = req.body || {};
  if (!prompt) {
    res.status(400).json({ ok: false, error: "Prompt is required." });
    return;
  }
  try {
    const response = await runPiAgent({
      prompt,
      tenantId,
      sessionId,
      model,
      customKey,
      agentLang,
      webSearchEnabled,
      thinkingLevel
    });
    res.json(response);
  } catch (err) {
    res.status(500).json({
      ok: false,
      text: `Execution failed: ${err.message}`,
      error: err.message
    });
  }
});
router5.get("/daemons", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const daemons = listPiDaemons(tenantId);
  res.json({ ok: true, daemons });
});
router5.post("/stop", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { sessionId } = req.body || {};
  const stopped = stopPiAgent(tenantId, sessionId);
  res.json({ ok: stopped });
});
router5.get("/sessions", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const sessions = listPiSessions(tenantId);
  res.json({ ok: true, sessions });
});
router5.post("/sessions/create", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { name } = req.body || {};
  const session = createPiSession(tenantId, name);
  res.json({ ok: true, session });
});
router5.post("/sessions/delete", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { sessionId } = req.body || {};
  if (!sessionId) {
    res.status(400).json({ ok: false, error: "sessionId is required." });
    return;
  }
  const deleted = deletePiSession(tenantId, sessionId);
  res.json({ ok: deleted });
});
router5.get("/models", (req, res) => {
  const models = listPiModels();
  res.json({ ok: true, models });
});
router5.get("/logs", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const logs = getPiProcessLogs(tenantId);
  res.json({ ok: true, logs });
});
router5.get("/config", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const info = ensureUserHarness(tenantId);
  res.json({ ok: true, config: info.config });
});
router5.get("/state", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const state = getHarnessState(tenantId);
  res.json({ ok: true, harness: state });
});
router5.post("/state", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const updates = req.body || {};
  const updated = updateHarnessState(tenantId, updates);
  res.json({ ok: true, harness: updated });
});
router5.post("/user-action", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { category, action } = req.body || {};
  if (!category || !action) {
    res.status(400).json({ ok: false, error: "category and action are required." });
    return;
  }
  appendUserAction(tenantId, category, action);
  res.json({ ok: true });
});
router5.post("/reviews/ignore", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { itemId } = req.body || {};
  if (!itemId) {
    res.status(400).json({ ok: false, error: "itemId is required." });
    return;
  }
  removeReviewItem(tenantId, itemId);
  res.json({ ok: true });
});
router5.post("/reviews/feedback", (req, res) => {
  const tenantId = req.tenantId || "default_user";
  const { itemId, feedback } = req.body || {};
  if (!itemId) {
    res.status(400).json({ ok: false, error: "itemId is required." });
    return;
  }
  setReviewItemFeedback(tenantId, itemId, feedback || "");
  res.json({ ok: true });
});
var harness_routes_default = router5;

// server.ts
var app = (0, import_express6.default)();
var PORT = 3e3;
var isBuildingFrontend = false;
function triggerFrontendBuildIfNeeded() {
  const outDir = import_path6.default.join(process.cwd(), "frontend-next", "out");
  if (!import_fs6.default.existsSync(outDir) && !isBuildingFrontend) {
    isBuildingFrontend = true;
    console.log("[Fabrica Engine] Initializing frontend build...");
    (0, import_child_process2.exec)("npm run build:frontend", (err) => {
      isBuildingFrontend = false;
      if (err) {
        console.error("[Fabrica Engine] Frontend build error:", err.message);
      } else {
        console.log("[Fabrica Engine] Frontend build complete!");
      }
    });
  }
}
app.use(import_express6.default.json({ limit: "50mb" }));
app.use(import_express6.default.urlencoded({ extended: true, limit: "50mb" }));
app.use(authMiddleware);
app.use("/api/auth", auth_routes_default);
app.use("/api/tenant", tenant_routes_default);
app.use("/api/workspace", workspace_routes_default);
app.use("/api/missions", missions_routes_default);
app.use("/api/harness", harness_routes_default);
app.use("/api/key-pool", auth_routes_default);
app.use("/api/pi", harness_routes_default);
app.use("/api/storage", workspace_routes_default);
app.use("/api/mission", missions_routes_default);
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  const outDir = import_path6.default.join(process.cwd(), "frontend-next", "out");
  if (!import_fs6.default.existsSync(outDir)) {
    triggerFrontendBuildIfNeeded();
    return res.status(503).send('<html><head><meta http-equiv="refresh" content="3"></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>Frontend is building...</h2><p>This page will automatically refresh once the build completes.</p></body></html>');
  }
  import_express6.default.static(outDir, { extensions: ["html"] })(req, res, () => {
    const indexPath = import_path6.default.join(outDir, "index.html");
    if (import_fs6.default.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
});
app.use(errorMiddleware);
setInterval(() => {
  try {
    syncTenantWorkspace("default_user");
    syncMissionsJson("default_user");
  } catch (err) {
    console.error(`[Daemon Sync] Error in background sync cycle: ${err.message}`);
  }
}, 5e3);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Fabrica Engine] Modular core harness active. Listening on http://0.0.0.0:${PORT}`);
  try {
    ensureUserHarness("default_user");
    syncTenantWorkspace("default_user");
    syncMissionsJson("default_user");
    triggerFrontendBuildIfNeeded();
  } catch (err) {
    console.error(`[Daemon Sync] Error in initial setup: ${err.message}`);
  }
});
