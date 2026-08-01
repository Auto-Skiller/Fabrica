# Authentication Architecture (`auth_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for the Authentication and Key Management Subsystem of the platform.

---

## 1. Subsystem Overview & Security Model

The Authentication Subsystem enforces tenant isolation, multi-tier API quota management, API key lifecycle management (creation, rotation, validation, revocation), and bearer token verification across all API endpoints.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Browser                                │
│  (AccountWorkspaceModal.tsx / auth/api.ts / localStorage / Bearer Key)  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP Header: x-tenant-id / x-api-key / Bearer
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Express API Router Layer                            │
│           (src/api/middlewares/auth.middleware.ts)                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Validates tenant & tags req.tenantId / req.userTier
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Core Authentication Engine                        │
│                         (src/core/auth.ts)                              │
│         - KeyPoolManager Singleton                                      │
│         - Tier Quotas (FREE: 100k, PRO: 1M, ENTERPRISE: 10M)            │
│         - Key Hash Generation & Token Consumption Tracker               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Persists JSON state
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Tenant File Storage System                         │
│                  (workspaces/<tenant_id>/keys.json)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/components/auth/`:

### A. Data Types & Interfaces (`frontend-next/components/auth/types.ts`)

- **`UserTier`**: Enum union `'FREE' | 'PRO' | 'ENTERPRISE'` defining user access tiers.
- **`ApiKeyItem`**:
  - `id: string`: Unique identifier for the key (`key_...`).
  - `name: string`: Friendly label given by the user (e.g., "Development Key").
  - `key: string`: Masked key string (e.g., `sk_live_...`) or unmasked key upon initial generation.
  - `createdAt: string`: ISO 8601 timestamp of creation.
  - `lastUsedAt?: string`: ISO timestamp of the last authenticated request.
  - `status: 'active' | 'revoked' | 'expired'`: Current operational status.
  - `usageCount: number`: Total count of API invocations.
  - `tokenUsage: number`: Accumulated token usage.
- **`KeyPoolSummary`**:
  - `tenantId: string`: Current tenant context.
  - `totalKeys: number`: Total keys provisioned for the tenant.
  - `activeKeys: number`: Number of currently active keys.
  - `keys: ApiKeyItem[]`: Full array of key objects.
- **`TierUsageDetails`**:
  - `tier: UserTier`: Operational tier level.
  - `maxMonthlyTokens: number`: Quota ceiling (100,000 for FREE, 1,000,000 for PRO, 10,000,000 for ENTERPRISE).
  - `usedMonthlyTokens: number`: Cumulative tokens consumed in the current billing cycle.
  - `remainingTokens: number`: Remaining quota (`maxMonthlyTokens - usedMonthlyTokens`).
  - `maxRequestsPerMin: number`: Rate limit per minute (60 for FREE, 300 for PRO, 1200 for ENTERPRISE).
  - `currentRpm: number`: Real-time active requests per minute.
- **`AuthProfile`**:
  - `tenantId: string`: Primary workspace ID.
  - `email?: string`: Registered user email.
  - `tier: UserTier`: Active plan tier.
  - `createdAt: string`: Account registration timestamp.
- **`LoginPayload`**:
  - `email: string`: User email address.
  - `password: string`: Account password.

### B. Frontend API Client (`frontend-next/components/auth/api.ts`)

- **Constants**:
  - `AUTH_STORAGE_KEYS`: Stores `{ TOKEN: 'fabrica_auth_token', TENANT: 'fabrica_tenant_id', KEY: 'fabrica_api_key' }`.
- **`request<T>(endpoint, options)`**:
  - Core wrapper for `fetch` API.
  - Automatically injects `x-tenant-id` and `Authorization: Bearer <token_or_api_key>` headers from `localStorage`.
  - Parses JSON response and throws formatted errors if `response.ok` is `false`.
- **`authApi` Functions**:
  - `getProfile()`: `GET /api/auth/profile`
  - `login(payload)`: `POST /api/auth/login`
  - `logout()`: Clears `localStorage` keys and resets session state.
  - `fetchKeys()`: `GET /api/auth/keys`
  - `createKey(name)`: `POST /api/auth/keys/create` with body `{ name }`
  - `deleteKey(keyId)`: `POST /api/auth/keys/delete` with body `{ keyId }`
  - `rotateKey(keyId)`: `POST /api/auth/keys/rotate` with body `{ keyId }`
  - `validateKey(key)`: `POST /api/auth/keys/validate` with body `{ key }`
  - `fetchTierDetails()`: `GET /api/auth/tier-details`

### C. UI Component: `AccountWorkspaceModal.tsx`

- **State Variables**:
  - `isOpen: boolean`: Controls modal visibility.
  - `activeTab: 'overview' | 'keypool' | 'quotas' | 'credentials'`: Controls sub-view rendering.
  - `apiKeyNameInput: string`: Input field value for new API key creation.
  - `generatedRawKey: string | null`: Temporarily holds the plain-text unmasked key immediately after generation for user copy.
  - `isGenerating: boolean`: Loading indicator during key generation/rotation.
  - `keyPool: KeyPoolSummary | null`: Loaded key pool data.
  - `tierDetails: TierUsageDetails | null`: Loaded tier quota metrics.
  - `userProfile: AuthProfile | null`: Account metadata.
  - `copiedState: boolean`: Temporary visual confirmation flag after clicking "Copy Key".
  - `errorMsg / successMsg: string | null`: Alert messages.
- **Core Operations**:
  - `handleTabSwitch(tab)`: Dynamically loads tier details or key pool data when switching tabs.
  - `handleGenerateKey()`: Triggers `authApi.createKey(name)`, updates key list, displays raw key banner.
  - `handleCopyKey(text)`: Writes key to `navigator.clipboard`, triggers 2-second visual copied state.
  - `handleDeleteKey(keyId)`: Confirms deletion and calls `authApi.deleteKey(keyId)`.
  - `handleRotateKey(keyId)`: Revokes old key, issues new key with identical name, updates UI.
  - `handleValidateKey(key)`: Validates active status and displays status badge.

---

## 3. Routes Architecture (`routes_arch`)

Located in `src/api/routes/auth.routes.ts` & `src/api/middlewares/auth.middleware.ts`:

### A. Middleware: `auth.middleware.ts`

- **`AuthenticatedRequest`**: Extends Express `Request` with custom properties:
  - `tenantId: string`: Extracted tenant identifier.
  - `userTier: UserTier`: Tenant tier derived from key or profile.
  - `apiKeyRecord?: ApiKeyItem`: Attached active key record.
- **`authMiddleware(req, res, next)`**:
  - Extracts tenant ID from headers: `req.headers['x-tenant-id'] || 'default_user'`.
  - Extracts API key from headers: `req.headers['x-api-key']` or `Authorization: Bearer <key>`.
  - Validates key against `KeyPoolManager`. If valid, attaches key details, increments request counters, and sets `req.userTier`.
  - If no key is provided, defaults to `'default_user'` tenant context with `FREE` tier privileges, allowing friction-free development.

### B. Endpoints in `auth.routes.ts`

| Method | Endpoint | Handler Logic | Response Schema |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticates email/password, returns tenant session token & profile. | `{ ok: true, token, profile }` |
| `GET` | `/api/auth/profile` | Fetches tenant profile & tier status for `req.tenantId`. | `{ ok: true, profile }` |
| `GET` | `/api/auth/keys` | Lists all API keys for tenant key pool. | `{ ok: true, keyPool: { tenantId, totalKeys, activeKeys, keys } }` |
| `POST` | `/api/auth/keys/create` | Accepts `{ name }`, invokes `generateTenantApiKey`, creates new record. | `{ ok: true, keyRecord, rawKey }` |
| `POST` | `/api/auth/keys/delete` | Accepts `{ keyId }`, revokes key in pool. | `{ ok: true, success: true }` |
| `POST` | `/api/auth/keys/rotate` | Accepts `{ keyId }`, revokes old key & creates new key. | `{ ok: true, newKeyRecord, rawKey }` |
| `POST` | `/api/auth/keys/validate` | Accepts `{ key }`, checks active status & token limits. | `{ ok: true, valid: boolean, keyRecord }` |
| `GET` | `/api/auth/tier-details` | Calculates real-time usage vs monthly quota ceiling. | `{ ok: true, tierDetails }` |

---

## 4. Core Architecture (`core_arch`)

Located in `src/core/auth.ts`:

### A. Constant Tier Quotas (`TIER_QUOTAS`)

```typescript
export const TIER_QUOTAS: Record<UserTier, TierQuotaConfig> = {
  FREE: {
    tier: 'FREE',
    maxMonthlyTokens: 100_000,
    maxRequestsPerMin: 60,
    maxKeysAllowed: 3
  },
  PRO: {
    tier: 'PRO',
    maxMonthlyTokens: 1_000_000,
    maxRequestsPerMin: 300,
    maxKeysAllowed: 10
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    maxMonthlyTokens: 10_000_000,
    maxRequestsPerMin: 1200,
    maxKeysAllowed: 50
  }
};
```

### B. `KeyPoolManager` Singleton Class

- **`getInstance()`**: Singleton accessor ensuring single key pool instance in node runtime.
- **`getKeyPoolPath(tenantId)`**: Resolves path to `workspaces/<tenant_id>/keys.json`.
- **`getKeyPool(tenantId)`**: Reads and parses `keys.json`. Initializes default structure if missing.
- **`saveKeyPool(tenantId, poolData)`**: Safely writes formatted JSON to tenant workspace.
- **`generateApiKey(tenantId, name)`**:
  - Generates secure random string `sk_live_` + 32 random bytes (hex).
  - Hashes key using SHA-256 for secure internal lookup.
  - Enforces `maxKeysAllowed` check based on tenant tier.
  - Appends record to `keys.json` with initial metrics (`usageCount: 0, tokenUsage: 0`).
- **`revokeApiKey(tenantId, keyId)`**: Sets key status to `'revoked'`.
- **`rotateApiKey(tenantId, keyId)`**: Marks key as revoked and immediately calls `generateApiKey`.
- **`validateApiKey(rawKey)`**:
  - Hashes `rawKey` and scans active tenant key pools.
  - Verifies status is `'active'` and checks token consumption against tier limit.
  - Updates `lastUsedAt` and increments `usageCount`.
- **`trackUsage(tenantId, keyId, tokensConsumed)`**: Atomically adds consumed tokens to key's `tokenUsage` and tenant cumulative total.
- **`getTierDetails(tenantId)`**: Aggregates token usage across all keys in tenant pool and formats remaining tokens and quota percentage.

---

## 5. User Tenant Persistence Architecture (`user_arch`)

Stored at: `workspaces/<tenant_id>/keys.json`

### File Schema Example:

```json
{
  "tenantId": "default_user",
  "tier": "PRO",
  "createdAt": "2026-08-01T10:00:00.000Z",
  "totalMonthlyTokensUsed": 45210,
  "keys": [
    {
      "id": "key_1772467200000_a1b2",
      "name": "Production Service Key",
      "keyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "maskedKey": "sk_live_...a1b2",
      "createdAt": "2026-08-01T10:05:00.000Z",
      "lastUsedAt": "2026-08-01T16:10:00.000Z",
      "status": "active",
      "usageCount": 142,
      "tokenUsage": 45210
    }
  ]
}
```

- **Security Note**: Raw key plain-texts are **never** stored on disk. Only the SHA-256 hash (`keyHash`) and masked display key (`maskedKey`) are persisted. Plain-text key strings are returned exactly once upon creation or rotation.
