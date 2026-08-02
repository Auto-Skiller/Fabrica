# Authentication & Key Security Architecture (`auth_arch.md`)

This document provides a complete, production-grade architectural audit, security vulnerability assessment, and logic walkthrough for the Authentication, Security Isolation, and Key Management Subsystem of the platform.

---

## 1. Security Vulnerability & Risk Audit

A comprehensive security audit of the authentication and file persistence model identified the following critical security risks:

### A. Critical Risk: Server-Side Secret Leakage via User Workspace Filesystem (`keys.json`)
- **Risk**: Placing plain-text or reversibly encoded server-side API keys (such as `GEMINI_API_KEY`, system integration credentials, or master secrets) in tenant workspace files (`workspaces/<tenant_id>/keys.json` or `.env`) allows any user or client-side file reading tool (`readWorkspaceFile`) to extract platform credentials.
- **Impact**: Compromise of server-side platform quotas, financial liability, and unauthorized API usage.

### B. Critical Risk: BYOK vs. Server Key Confusion
- **Risk**: Treating user-supplied keys (Bring Your Own Key) and platform server keys in the same storage engine without clear cryptographic boundary separation.
- **Impact**: Potential exposure of platform system keys to end users when fetching key pools or listing credentials.

### C. Medium Risk: Unmasked Key Transmission
- **Risk**: Returning unmasked plain-text API keys in recurring GET requests or storing plain-text keys on disk.
- **Impact**: Long-term key compromise if logs or persistent files are inspected.

---

## 2. Core Security Policy: BYOK & Server-Side Secret Encryption

To guarantee zero leakage of server-side credentials, the platform enforces strict key separation:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT-SIDE LAYER                                    │
│  - BYOK (Bring Your Own Key): The ONLY user-side method allowed                  │
│  - User provides personal API keys (e.g. OpenAI/Gemini) stored transiently        │
│  - Never receives or views Server-Side System Keys                               │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Secure TLS / Headers
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         SERVER-SIDE SECURITY BOUNDARY                            │
│                                                              ────────────────────│
│   ┌──────────────────────────────────┐    ┌──────────────────────────────────┐   │
│   │     BYOK User Keys (Client)      │    │    Server-Side System Keys       │   │
│   │  - Passed in transient request   │    │  - Stored ONLY in Server Env     │   │
│   │  - AES-256-GCM at rest           │    │  - AES-256-GCM Encrypted at rest │   │
│   │  - Never written plain to disk   │    │  - STRICTLY HIDDEN from Browser  │   │
│   └──────────────────────────────────┘    └──────────────────────────────────┘   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Hashes ONLY (SHA-256)
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       Tenant Storage (keys.json / auth.json)                     │
│  - Stores ONLY hashed/AES-256-GCM encrypted tokens & BYOK metadata               │
│  - Protected by isProtectedSecurityPath() filesystem guards                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Policy Directives:
1. **BYOK (Bring Your Own Key) as Exclusive User-Side Method**:
   - The user is only permitted to manage and submit their *own* API keys (BYOK) for third-party service integration.
   - User keys are transmitted securely over HTTPS headers and held transiently in memory or encrypted client session state.
2. **Server-Side Key Encryption & Hiding**:
   - Platform system keys (e.g. Gemini master keys, service role credentials) are **STRICTLY HIDDEN** from the browser and frontend API endpoints.
   - Server-side keys must **NEVER** be written to `workspaces/<tenant_id>/keys.json` or any file within the tenant workspace directory.
   - All persisted credentials use **AES-256-GCM authenticated encryption** with an IV and Auth Tag using a master secret derived via `crypto.scryptSync`.
3. **Filesystem Security Isolation (`isProtectedSecurityPath`)**:
   - `workspace.ts` blocks client-side file listing/reading tools from accessing sensitive security files (`keys.json`, `auth.json`, `key_pools.json`, `.env*`, `secrets.json`, `.stash/`).
   - Plain-text secret strings are returned **EXACTLY ONCE** upon key creation or rotation and are never re-exposed.

---

## 3. Subsystem Overview & Security Model

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
│         - AES-256-GCM Encryption / Decryption Cipher                   │
│         - SHA-256 Key Hashing & Token Consumption Tracker               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ Persists AES-256 / SHA-256 state
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Tenant File Storage System                         │
│                  (workspaces/<tenant_id>/keys.json)                     │
│           Protected against client workspace reads                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Architecture (`components_arch`)

Located in `frontend-next/components/auth/`:

### A. Data Types & Interfaces (`frontend-next/components/auth/types.ts`)

- **`UserTier`**: Enum union `'FREE' | 'PRO' | 'ENTERPRISE'` defining user access tiers.
- **`ApiKeyItem`**:
  - `id: string`: Unique identifier for the key (`key_...`).
  - `name: string`: Friendly label given by the user (e.g., "BYOK Production Key").
  - `key?: string`: Masked key string (e.g., `sk_live_...`) or unmasked key upon initial generation.
  - `keyHash?: string`: SHA-256 hash digest.
  - `encryptedKey?: string`: AES-256-GCM cipher string (`iv:tag:content`).
  - `maskedKey?: string`: Display masked representation.
  - `createdAt: string`: ISO 8601 timestamp of creation.
  - `lastUsedAt?: string`: ISO timestamp of the last authenticated request.
  - `status: 'active' | 'revoked' | 'expired'`: Current operational status.
  - `usageCount: number`: Total count of API invocations.
  - `tokenUsage: number`: Accumulated token usage.
  - `isByok?: boolean`: Flag marking Bring-Your-Own-Key user method.
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
  - `createKey(name, isByok)`: `POST /api/auth/keys/create` with body `{ name, isByok }`
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

## 5. Routes Architecture (`routes_arch`)

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
  - Strictly blocks client requests attempting to access server-side platform secret keys.

### B. Endpoints in `auth.routes.ts`

| Method | Endpoint | Handler Logic | Response Schema |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticates email/password, returns tenant session token & profile. | `{ ok: true, token, profile }` |
| `GET` | `/api/auth/profile` | Fetches tenant profile & tier status for `req.tenantId`. | `{ ok: true, profile }` |
| `GET` | `/api/auth/keys` | Lists all API keys for tenant key pool (Hashed & Masked only). | `{ ok: true, keyPool: { tenantId, totalKeys, activeKeys, keys } }` |
| `POST` | `/api/auth/keys/create` | Accepts `{ name, isByok }`, invokes `generateTenantApiKey`, creates record. | `{ ok: true, keyRecord, rawKey }` |
| `POST` | `/api/auth/keys/delete` | Accepts `{ keyId }`, revokes key in pool. | `{ ok: true, success: true }` |
| `POST` | `/api/auth/keys/rotate` | Accepts `{ keyId }`, revokes old key & creates new key. | `{ ok: true, newKeyRecord, rawKey }` |
| `POST` | `/api/auth/keys/validate` | Accepts `{ key }`, checks active status & token limits via SHA-256 match. | `{ ok: true, valid: boolean, keyRecord }` |
| `POST` | `/api/auth/key-pool/add` | Adds BYOK key into active rotation pool (encrypts via AES-256-GCM). | `{ ok: true, keyItem }` |
| `GET` | `/api/auth/tier-details` | Calculates real-time usage vs monthly quota ceiling. | `{ ok: true, tierDetails }` |

---

## 6. Core Architecture (`core_arch`)

Located in `src/core/auth.ts` & `src/core/workspace.ts`:

### A. Cryptographic Security Engine Functions (`src/core/auth.ts`)

- **`encryptSecret(plainText: string): string`**: Encrypts secret strings using AES-256-GCM cipher with random 12-byte IV and Scrypt-derived key. Returns `iv:tag:ciphertext`.
- **`decryptSecret(encryptedData: string): string`**: Decrypts AES-256-GCM encrypted payloads safely.
- **`hashApiKey(rawKey: string): string`**: Computes SHA-256 digest hex string for fast, non-reversible key matching.
- **`maskApiKey(rawKey: string): string`**: Masks sensitive key string (e.g. `sk_liv...a1b2`).

### B. Workspace Security Isolation (`src/core/workspace.ts`)

- **`isProtectedSecurityPath(filePath: string): boolean`**: Detects sensitive filenames (`keys.json`, `auth.json`, `key_pools.json`, `.env*`, `secrets.json`, `.stash/`) and throws HTTP 403 / Security Violation errors if user workspace APIs attempt to read or list them.

### C. Constant Tier Quotas (`TIER_QUOTAS`)

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

### D. `KeyPoolManager` Singleton Class

- **`getInstance()`**: Singleton accessor ensuring single key pool instance in node runtime.
- **`getKeyPoolPath(tenantId)`**: Resolves path to `workspaces/<tenant_id>/keys.json`.
- **`getKeyPool(tenantId)`**: Reads and parses `keys.json`. Initializes default structure if missing.
- **`saveKeys()`**: Strips raw plain-text keys and ensures `encryptedKey` (AES-256-GCM), `keyHash` (SHA-256), and `maskedKey` are persisted.
- **`addKey(item)`**: Computes `keyHash`, `encryptedKey`, and `maskedKey`, marks `isByok: true`, strips raw key before writing to disk.
- **`getKeyForProvider(...)`**: Resolves active key for provider and decrypts `encryptedKey` into `rawDecryptedKey` for internal LLM client execution.
- **`revokeApiKey(tenantId, keyId)`**: Sets key status to `'revoked'`.
- **`rotateApiKey(tenantId, keyId)`**: Marks key as revoked and immediately calls `generateApiKey`.
- **`validateApiKey(rawKey)`**:
  - Hashes `rawKey` via SHA-256 and scans active tenant key pools.
  - Verifies status is `'active'` and checks token consumption against tier limit.
  - Updates `lastUsedAt` and increments `usageCount`.
  - Zero exposure of server-side platform secret keys.
- **`trackUsage(tenantId, keyId, tokensConsumed)`**: Atomically adds consumed tokens to key's `tokenUsage` and tenant cumulative total.
- **`getTierDetails(tenantId)`**: Aggregates token usage across all keys in tenant pool and formats remaining tokens and quota percentage.

---

## 7. User Tenant Persistence Architecture (`user_arch`)

Stored at: `workspaces/<tenant_id>/keys.json` / `auth.json`

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
      "name": "BYOK Production Key",
      "keyHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "encryptedKey": "9f3a1b2c4d5e:6f7a8b9c0d1e:2a3b4c5d6e7f8a9b",
      "maskedKey": "sk_live_...a1b2",
      "createdAt": "2026-08-01T10:05:00.000Z",
      "lastUsedAt": "2026-08-01T16:10:00.000Z",
      "status": "active",
      "usageCount": 142,
      "tokenUsage": 45210,
      "isByok": true
    }
  ]
}
```

- **Security Note**: Raw key plain-texts and server system keys are **NEVER** stored on disk. Only the SHA-256 hash (`keyHash`), AES-256-GCM cipher payload (`encryptedKey`), masked display key (`maskedKey`), and BYOK metadata are persisted. Plain-text key strings are returned exactly once upon creation or rotation. Server platform keys stay completely isolated in server memory and process environment variables.

---

## 8. Harness BYOK & Agent Authentication Architecture (`harness_auth_arch`)

Located in `src/core/harness.ts`:

### A. Harness User-Side BYOK Management vs Server-Side Auth Isolation

1. **User-Side BYOK Sync (`syncPiUserAuthKeys`)**:
   - The harness handles all user-side BYOK key management by persisting user credentials strictly in each tenant's agent configuration directory:
     - `workspaces/<tenant_id>/.pi/agent/auth.json`: Holds provider credentials (`api_key` entries) for user BYOK keys.
     - `workspaces/<tenant_id>/.pi/agent/models.json`: Maps supported model providers to their corresponding environment variables and metadata.
   - When a user adds or uses a BYOK key, `syncPiUserAuthKeys()` automatically decrypts the tenant's BYOK key and writes it into `.pi/agent/auth.json` so the `pi` CLI sub-process can authenticate user requests seamlessly.

2. **Server-Side Auth Isolation**:
   - Server-side system keys (e.g. platform `GEMINI_API_KEY`, rotation pool system keys) are handled exclusively via server-side process environment variables passed during child process execution.
   - Server keys are **NEVER** written to `workspaces/<tenant_id>/.pi/agent/auth.json` or any file within the tenant workspace directory.

### B. Supported API Key Environment Variables (pi Providers Documentation)

The following full table details the environment variables recognized by the harness and `pi` CLI for model execution across providers:

| Provider | Primary Environment Variable | Secondary / Alias Env Var | Provider Identifier |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `GEMINI_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` | `google/` |
| **OpenRouter** | `OPENROUTER_API_KEY` | - | `openrouter/` |
| **Anthropic** | `ANTHROPIC_API_KEY` | - | `anthropic/` |
| **OpenAI** | `OPENAI_API_KEY` | - | `openai/` |
| **Mistral AI** | `MISTRAL_API_KEY` | - | `mistral/` |
| **Groq** | `GROQ_API_KEY` | - | `groq/` |
| **DeepSeek** | `DEEPSEEK_API_KEY` | - | `deepseek/` |
| **xAI (Grok)** | `XAI_API_KEY` | - | `xai/` |
| **Azure OpenAI** | `AZURE_OPENAI_API_KEY` | - | `azure/` |
| **Together AI** | `TOGETHER_API_KEY` | - | `together/` |
| **Fireworks AI** | `FIREWORKS_API_KEY` | - | `fireworks/` |
| **Perplexity AI** | `PERPLEXITY_API_KEY` | - | `perplexity/` |


