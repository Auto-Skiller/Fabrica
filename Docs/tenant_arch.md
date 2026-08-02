# Tenant Architecture & Workspace Isolation (`tenant_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for Tenant Workspace Isolation, Security Path Resolution, Database Engine (`DatabaseEngine`), Telemetry Aggregation, and Audit Logging.

---

## 1. Subsystem Overview & Tenant Security Isolation

The Tenant Subsystem provides strict multi-tenant filesystem isolation. Every tenant operates within a isolated root folder (`workspaces/<tenant_id>/`). Path traversal checks ensure no request can escape the tenant boundary.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client / Component Layer                          │
│        (frontend-next/components/tenant/api.ts & dashboard views)           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP API Calls with x-tenant-id Header
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Tenant Express API Routes                            │
│                      (src/api/routes/tenant.routes.ts)                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Core Tenant Engine                                │
│                          (src/core/tenant.ts)                               │
│  - Directory Resolver & Traversal Guard (getTenantRoot / resolveTenantPath) │
│  - Database Engine Class (DatabaseEngine)                                   │
│  - Profile & Settings Manager (getTenantProfile / updateTenantProfile)      │
│  - Real-Time Storage & System Telemetry (getTenantTelemetry)                │
│  - Unified Audit Event Logger (appendTenantAuditLog)                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Protected Workspace I/O
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tenant Storage (workspaces/<tenant_id>/)                  │
│  └── tenant.json  (Profile, plan, settings, telemetry & unified log stream) │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/components/tenant/`:

### A. Data Types & Interfaces (`frontend-next/components/tenant/types.ts`)

- **`TenantProfile`**: Frontend representation of tenant account (`tenantId`, `name`, `email`, `plan`, `context`, `telemetry`, `last_active`).

### B. Frontend API Wrapper (`frontend-next/components/tenant/api.ts`)

- **`tenantApi` Methods**:
  - `getTenantProfile(tenantId)`: `GET /api/tenant/profile` — Retrieves tenant configuration and metadata.
  - `updateTenantProfile(updates)`: `POST /api/tenant/profile` — Updates profile settings on disk.
  - `getTenantTelemetry(tenantId)`: `GET /api/tenant/telemetry` — Fetches real-time CPU, RAM, and disk metrics.
  - `getTenantLogs(tenantId)`: `GET /api/tenant/logs` — Retrieves event stream from `tenant.json`.
  - `getLogs(tenantId)`: Helper wrapper returning audit logs array.

---

## 3. Routes Architecture (`routes_arch`)

Located in `src/api/routes/tenant.routes.ts`:

| Method | Endpoint | Description | Request Body / Params | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tenant/profile` | Fetches tenant profile & settings | Query: `?tenantId=...` | `{ ok: true, profile: TenantProfile }` |
| `POST` | `/api/tenant/profile` | Updates tenant profile & settings | `{ ...updates }` | `{ ok: true, profile: TenantProfile }` |
| `GET` | `/api/tenant/telemetry` | Returns real-time usage telemetry | Query: `?tenantId=...` | `{ ok: true, telemetry: TenantTelemetry }` |
| `GET` | `/api/tenant/logs` | Fetches audit log event stream | Query: `?tenantId=...` | `{ ok: true, events: AuditLogEvent[] }` |
| `POST` | `/api/tenant/logs/event` | Appends new audit log entry | `{ type, event, details, mission_id? }` | `{ ok: true, entry: AuditLogEvent }` |

---

## 4. Core Architecture (`core_arch`)

Located in `src/core/tenant.ts`:

### A. TypeScript Interfaces

- **`TenantProfile`**: `{ tenantId, name, email?, plan, createdAt, updatedAt, settings }`
- **`TenantTelemetry`**: `{ tenantId, cpuUsagePercent, memoryUsageMb, activeDaemonsCount, totalMissionsCount, totalStorageBytes, uptimeSeconds, timestamp }`
- **`AuditLogEvent`**: `{ id, timestamp, type: 'system'|'mission'|'audit'|'source'|'deliverable'|'user', event, mission_id?, details? }`

### B. Security & Storage Functions

- **`getTenantRoot(tenantId = 'default_user')`**:
  - Sanitizes `tenantId` string (`tenantId.replace(/[^a-zA-Z0-9_\-]/g, '_')`).
  - Resolves path to `workspaces/<tenant_id>/`.
  - Creates workspace folder automatically if it doesn't exist.
- **`resolveTenantPath(tenantId, targetPath)`**:
  - Security path boundary guard.
  - Ensures resolved target path starts with `getTenantRoot(tenantId)`.
  - Throws `Security Violation: Path traversal attempt blocked` if traversal (`../`) tries to exit the tenant workspace.
- **`DatabaseEngine` Class**:
  - Standard JSON reader/writer abstraction co-located in `tenant.ts`.
  - `getTenantFile(filename)`: Resolves tenant file path.
  - `readJson<T>(filename, fallback)`: Safely reads and parses JSON file.
  - `writeJson<T>(filename, data)`: Atomically writes formatted JSON.
- **`getTenantProfile(tenantId)`**: Reads `tenant.json`. If missing, initializes default profile structure and writes file.
- **`updateTenantProfile(tenantId, updates)`**: Merges updates into existing `tenant.json` and updates `updatedAt` timestamp.
- **`getTenantTelemetry(tenantId)`**:
  - Recursively scans `workspaces/<tenant_id>/` to compute accurate `totalStorageBytes`.
  - Reads Node.js `process.memoryUsage().heapUsed` to compute `memoryUsageMb`.
  - Reads `process.uptime()` to compute `uptimeSeconds`.
- **`getTenantAuditLogs(tenantId)`**: Reads `logs` array from `tenant.json`.
- **`appendTenantAuditLog(tenantId, event)`**:
  - Appends new event with generated ID `evt_<timestamp>_<rand>`.
  - Caps log array at maximum 1,000 entries (sliding window).
  - Updates `last_event_at` timestamp in `tenant.json`.

---

## 5. User Tenant Persistence Architecture (`user_arch`)

Stored at: `workspaces/<tenant_id>/tenant.json`

### File Schema Example:

```json
{
  "tenant_id": "default_user",
  "tenantId": "default_user",
  "name": "Default Workspace",
  "plan": "Professional",
  "createdAt": "2026-08-01T10:00:00.000Z",
  "updatedAt": "2026-08-01T16:10:00.000Z",
  "settings": {
    "language": "EN",
    "internet_access": true,
    "theme": "dark"
  },
  "subscription": {
    "plan": "Professional",
    "active": true
  },
  "last_event_at": "2026-08-01T16:10:00.000Z",
  "logs": [
    {
      "id": "evt_1772467800000_7a1b",
      "timestamp": "2026-08-01T16:10:00.000Z",
      "type": "system",
      "event": "Workspace Synced",
      "details": {
        "syncedFilesCount": 12
      }
    },
    {
      "id": "evt_1772467200000_3x8a",
      "timestamp": "2026-08-01T10:00:00.000Z",
      "type": "system",
      "event": "Workspace Initialized",
      "details": "Unified audit event stream initialized in tenant.json."
    }
  ]
}
```
