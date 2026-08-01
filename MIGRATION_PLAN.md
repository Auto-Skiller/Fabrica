# Fabrica OS Architecture & Migration Blueprint

## 1. Executive Summary & Vision

**Fabrica OS** has evolved into a feature-rich, multi-tenant AI workspace engine. However, organic growth has led to architectural fragmentation:
- A single monolithic `server.ts` (~4,090 lines) handling HTTP routes, Next.js static serving, background sync, LLM key rotation, and session daemons.
- Overlapping and split execution files (`src/pi_runner.ts`, `src/harness.ts`, `src/sync.ts`, `src/execution/sandbox.ts`).
- Confusing file layout inside `Fabrica_kernel/` (mixing JSON schema definitions, JS adapters, extensions, and empty legacy files).
- Missing type boundaries and scattered tenant security checks.

This blueprint defines the target modular architecture, file consolidation map, security hardening guidelines, and a phased execution roadmap to transform Fabrica OS into a clean, scalable enterprise platform.

---

## 2. Current State Analysis & Refinement Goals

### A. Monolithic Server Bottleneck (`server.ts`)
- **Problem**: Holds 4,000+ lines combining API endpoints, authentication, GCS storage simulation, pricing tier calculations, model key pools, and Next.js request proxies.
- **Impact**: High risk of regression during minor edits, difficult to unit test, slow developer loop.

### B. Core Engine Consolidation (`src/core/`)
- **Auth (`src/core/auth.ts`)**: Consolidates everything auth, API key, credential, token, and pricing tier related. Handles managed LLM key pool rotation (`key_pool.ts`), BYOK key validation, pricing tier quotas (`tier_manager.ts`), and global token limit enforcement. Reads/writes global `.stash/auth.json`.
- **Tenant (`src/core/tenant.ts`)**: Handles high-level tenant folder lifecycle management (`/workspaces/<tenantId>/`), database engine persistence (`db.ts`), tenant profile state, high-level harness/daemon orchestration, telemetry metrics, and audit logs. Reads/writes `/workspaces/<tenantId>/tenant.json`.
- **Harness (`src/core/harness.ts`)**: Engine for everything agent-related: chat streams, Pi CLI background daemon process, session progress tracking, session history, AI model selection & rotation, suggestion cards, agent commands, output language settings, web search toggle, autonomy levels, backlogs & code reviews, system prompt loading (`Fabrica_kernel/system_prompts/`), and extension management (`Fabrica_kernel/extensions/`). Reads/writes `/workspaces/<tenantId>/harness.json`.
- **Missions (`src/core/missions.ts`)**: Engine for everything mission-related: step-by-step workflow pipeline orchestrator, mission state machines, execution blueprints (Planning, Drafting, Execution, Delivery), mission schemas, and mission CRUD operations. Reads/writes `/workspaces/<tenantId>/missions.json`.
- **Workspace (`src/core/workspace.ts`)**: Dedicated module for everything inside the `/workspaces/<tenantId>/workspace/` directory: multi-tenant filesystem storage (`hybrid_fs.ts`), workspace scaffolding (`workspace_sync.ts`), phase storage (`Sources/` & `Deliverables/`), cloud/GCS storage sync, and file upload pipelines. Reads/writes `/workspaces/<tenantId>/workspace.json`.
- **VM Sandbox (`src/core/vm_sandbox.ts`)**: Merges VM sandbox execution logic (`vm_sandbox.ts`), evaluation tool registration (`vm_eval_tool.js`), and co-located sandbox types.

### C. Route Renaming & Consolidation (`src/api/routes/`)
- `pi.routes.ts` -> `harness.routes.ts`
- `mission.routes.ts` -> `missions.routes.ts`
- `workspace.routes.ts` -> `tenant.routes.ts` (includes merged telemetry & usage metrics endpoints)
- `storage.routes.ts` -> `workspace.routes.ts`
- `auth.routes.ts` -> Handles authentication endpoints as well as merged API key pool & rotation management.

### D. Kernel Directory Restructuring (`Fabrica_kernel/`)
- Rename `prompts/` -> `system_prompts/`.
- Keep `extensions/` directory (empty).
- Completely remove `schemas/` directory (schemas are now natively managed in `missions_orchestrator.ts`).
- Completely remove `adapters/` directory (adapters merged into core TypeScript modules).

### E. Frontend Component Layout (`frontend-next/components/`)
- Rename `mission/` -> `missions/`.
- Rename `pi/` -> `harness/`.
- Add `auth/` directory for authentication & API key modal components.
- Add `tenant/` directory for tenant settings, usage metrics, and telemetry widgets.

### F. Interactive Daemon Migration & Single Daemon Policy
- Fully migrate all execution pathways from `pi -p --mode json` to persistent interactive daemon sessions (`PiDaemonProcess`).
- **Strict Single Daemon per Tenant**: Enforce a strict 1:1 binding per `tenantId`. Multiple concurrent daemon threads for a single tenant are strictly prohibited.

### G. Workspace Working Directory (CWD) & Native Session Isolation
- **`cwd`**: Explicitly set to `/workspaces/<tenantId>/` (the agent's actual workspace root).
- **Native Session Handling**: Use `PI_CODING_AGENT_DIR=/workspaces/<tenantId>/.pi/`. Remove custom `.jsonl` and `PI_CODING_AGENT_SESSION_DIR` logic in favor of native `pi` CLI session management inside `.pi/agent/sessions/`.

---

## 3. Target Modular Architecture & Directory Tree

```
/
├── .stash/                              # Root System Stash & Storage
│   └── auth.json                       # Global auth store, master credentials, & API key pool state
│
├── server.ts                           # Minimal entry point (Express app setup + route mounting + port listener)
├── src/
│   ├── api/                            # Express API Router modules (HTTP handlers kept separate from engine logic)
│   │   ├── routes/
│   │   │   ├── auth.routes.ts          # Authentication, key pool management, & token limits endpoints
│   │   │   ├── tenant.routes.ts        # Tenant management, user profile, & telemetry/usage endpoints (merged)
│   │   │   ├── workspace.routes.ts     # Workspace files, GCS storage, & upload endpoints (renamed from storage)
│   │   │   ├── missions.routes.ts      # Missions CRUD & pipeline endpoints (renamed from mission)
│   │   │   └── harness.routes.ts       # Harness & Pi Daemon control endpoints (renamed from pi)
│   │   └── middlewares/
│   │       ├── auth.middleware.ts      # Tenant authorization & key validation
│   │       └── error.middleware.ts     # Standardized error handling
│   │
│   └── core/                           # Unified Core Engine (Engine logic + co-located TypeScript interfaces)
│       ├── harness.ts                  # Merged: Pi CLI, Daemon, options, models, context_injector, registry_bridge + Harness types
│       ├── missions.ts                 # Merged: Mission state harness, schemas, pipeline orchestrator + Mission types
│       ├── tenant.ts                   # Merged: db.ts, database persistence, tenant accounts + Tenant types
│       ├── workspace.ts                # Dedicated: hybrid_fs.ts, workspace_sync.ts, workspace_sync.js, cloud/GCS files + Workspace types
│       ├── auth.ts                     # Merged: key_pool.ts (LLM key rotation) + tier_manager.ts (quotas & limits) + Auth types
│       └── vm_sandbox.ts               # Merged: vm_sandbox.ts, vm_eval_tool.js + VM Sandbox types
│
├── Fabrica_kernel/                     # Canonical System Instructions & Resources
│   ├── extensions/                     # Active extension hooks (empty directory)
│   └── system_prompts/                 # Renamed from prompts/: System instructions & markdown prompts
│
└── frontend-next/                      # Next.js App Router Client
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                    # Clean single-view workspace
    │   └── dashboard/
    │       └── page.tsx                # Multi-tenant analytics & control panel
    ├── components/
    │   ├── ui/                         # Modular visual UI components
    │   ├── auth/                       # Authentication & API key modal components
    │   ├── tenant/                     # Tenant settings, usage metrics, & telemetry widgets
    │   ├── workspace/                  # Workspace & file tree components
    │   ├── missions/                   # Renamed from mission/: Mission graph & pipeline visualizers
    │   └── harness/                    # Renamed from pi/: Harness console & daemon manager
    └── lib/
        ├── api.ts                      # Typed Client API SDK for `/api/*`
        └── hooks/                      # React custom hooks (useWorkspace, useHarness)
```

---

## 4. Comprehensive File Migration & Merger Matrix

| Old Files / Locations | New Consolidated Target | Target Goal & Scope |
| :--- | :--- | :--- |
| `server.ts` (monolithic) | `server.ts` (entry only) + `src/api/routes/*` | Shrink `server.ts` to ~150 lines by extracting HTTP endpoints into modular router files (`src/api/routes/`). |
| `src/pi_runner.ts` + `src/harness.ts` + `Fabrica_kernel/adapters/context_injector.js` + `registry_bridge.js` | `src/core/harness.ts` | Merge Pi CLI runner, daemon lifecycle, model rotation, tenant execution options, context injector, registry bridge, and Harness TypeScript interfaces directly into `harness.ts`. |
| `src/pipeline/orchestrator.ts` + `Fabrica_kernel/adapters/*.json` | `src/core/missions.ts` | Merge mission state harness, workflow pipeline orchestration, mission JSON schemas, and Mission TypeScript interfaces directly into `missions.ts`. |
| `src/db/db_engine.ts` | `src/core/tenant.ts` | Merge database persistence, tenant account storage, and Tenant TypeScript interfaces directly into `tenant.ts`. |
| `src/db/hybrid_storage.ts` + `src/sync.ts` + `Fabrica_kernel/adapters/workspace_sync.js` | `src/core/workspace.ts` | Create dedicated workspace module merging multi-tenant filesystem storage, workspace scaffolding, cloud/GCS storage, and Workspace TypeScript interfaces into `workspace.ts`. |
| `src/db/llm_key_pool.ts` + `src/db/tier_manager.ts` | `src/core/auth.ts` | Merge managed LLM key pool rotation, tier quota management, token limit checks, and Auth/Pool/Tier TypeScript interfaces directly into `auth.ts`. |
| `src/execution/sandbox.ts` + `Fabrica_kernel/adapters/vm_eval_tool.js` | `src/core/vm_sandbox.ts` | Merge isolated VM sandbox code execution, evaluation tool registration, and VM Sandbox TypeScript interfaces directly into `vm_sandbox.ts`. |
| Key Pool Routes Consolidation | `src/api/routes/auth.routes.ts` | Merge key pool management endpoints into `auth.routes.ts`. |
| Telemetry Routes Consolidation | `src/api/routes/tenant.routes.ts` | Merge telemetry & usage metrics endpoints into `tenant.routes.ts`. |
| `Fabrica_kernel/prompts/` | `Fabrica_kernel/system_prompts/` | Rename folder to `system_prompts/`. |
| `Fabrica_kernel/schemas/` & `adapters/` | Deleted (Folders Removed) | Delete `adapters/` and `schemas/` directories after merging code and schemas into `src/core/`. Keep `extensions/` empty. |
| `frontend-next/components/` (New & Renamed) | `auth/`, `tenant/`, `missions/`, `harness/` | Create `auth/` and `tenant/` component directories; rename `mission/` -> `missions/` and `pi/` -> `harness/`. |

---

## 5. Security & Architectural Hardening Plan

1. **Path Traversal Protection**:
   - Standardize tenant workspace path resolving with absolute boundary checks (`path.resolve` verifying that target paths start with `/workspaces/<tenantId>`).
2. **Strict VM Sandbox Isolation**:
   - Ensure `executeSandboxedCode` freezes global prototypes (`Object.freeze`), completely blocks `process`, `require`, `import`, `global`, `fetch`, and enforces strict execution timeouts (default 1000ms).
3. **Environment & API Key Hygiene**:
   - Ensure tenant workspace execution never inherits master server secrets unexpectedly. Keys passed to `pi` CLI must be explicitly scoped by model strategy (`BYOK` vs `Pool`).
4. **Strict Single Daemon Instance per Tenant**:
   - Enforce a 1:1 binding between `tenantId` and active `PiDaemonProcess`. Multiple concurrent session threads for the same user are strictly forbidden.
5. **CWD & Native Session Cleanup**:
   - `cwd` for all CLI process executions must be `/workspaces/<tenantId>/`.
   - Remove `PI_CODING_AGENT_SESSION_DIR` and custom `.jsonl` file manipulators; rely solely on `PI_CODING_AGENT_DIR=/workspaces/<tenantId>/.pi/` where `pi` natively manages `.jsonl` session files inside `.pi/agent/sessions/`.
6. **Clean Directory Removal**:
   - Delete obsolete directories (`Fabrica_kernel/adapters/`, `Fabrica_kernel/schemas/`) once all components are migrated.

---

## 6. Phased Execution Roadmap

### Phase 1: Kernel Restructuring & Co-Located Type Definitions
- Declare and co-locate TypeScript interfaces directly inside their respective core engine files (`src/core/*`) rather than using a separate `src/types/` folder.
- Rename `Fabrica_kernel/prompts/` to `Fabrica_kernel/system_prompts/`.
- Ensure `Fabrica_kernel/extensions/` exists (empty).

### Phase 2: Core Engine Mergers (`src/core/`)
- Build `src/core/harness.ts` (combining Pi runner, daemon, options, models, `context_injector.js`, `registry_bridge.js`, and co-located harness types).
- Build `src/core/missions.ts` (combining pipeline orchestration, state machine, embedded mission schemas, and co-located mission types).
- Build `src/core/tenant.ts` (combining `db.ts`, database persistence, tenant accounts, and co-located tenant types).
- Build `src/core/workspace.ts` (combining `hybrid_fs.ts`, `workspace_sync.ts`, `workspace_sync.js`, cloud/GCS files, file uploads, and co-located workspace types).
- Build `src/core/auth.ts` (combining `key_pool.ts` key rotation, `tier_manager.ts` quotas & token limits, and co-located auth types).
- Build `src/core/vm_sandbox.ts` (combining `sandbox.ts`, `vm_eval_tool.js`, and co-located sandbox types).
- Delete `Fabrica_kernel/adapters/` and `Fabrica_kernel/schemas/`.

### Phase 3: Modular Express API Routes Extraction
- Keep Express API Routers separate in `src/api/routes/` (unmerged with engine logic for clean separation of HTTP concerns):
  - `auth.routes.ts` (handles authentication as well as merged LLM key pool management & rotation)
  - `tenant.routes.ts` (renamed from workspace.routes.ts; includes merged telemetry & system metrics endpoints)
  - `workspace.routes.ts` (renamed from storage.routes.ts)
  - `missions.routes.ts` (renamed from mission.routes.ts)
  - `harness.routes.ts` (renamed from pi.routes.ts)
- Refactor `server.ts` to cleanly mount all router modules.

### Phase 4: Frontend Component Organization & SDK Updates
- Create `frontend-next/components/auth/` for login modals and API key management UI.
- Create `frontend-next/components/tenant/` for workspace account settings, quota badges, and telemetry UI.
- Rename `frontend-next/components/mission/` to `frontend-next/components/missions/`.
- Rename `frontend-next/components/pi/` to `frontend-next/components/harness/`.
- Extract client API calls into `frontend-next/lib/api.ts`.

### Phase 5: Verification & Build Confirmation
- Run `lint_applet` to check for remaining syntax/type issues.
- Run `compile_applet` to verify full compilation success.

---

## 7. Plain-English Guide to the New Architecture & File Responsibilities

This guide explains what each file in the new structure contains and what role it plays, written simply without overly technical jargon:

### Why Keep Routers Separate?
- **Express API Routers (`src/api/routes/`)** act as the **receptionists** or **HTTP web addresses**. They listen for incoming requests from the browser, check URL paths (e.g., `/api/harness/prompt`), and return HTTP status codes.
- **Core Engines (`src/core/`)** act as the **workers or brains**. They do the heavy lifting—running AI models, writing files, and processing tasks. Keeping routers separate means web transport code does not clutter the engine logic.

### Why Merge TypeScript Interfaces Into Engine Files?
- **TypeScript Interfaces** are the **blueprints/spellcheckers** that describe data shapes (e.g., what fields a `Tenant` or `Mission` object must have). Merging them directly into their corresponding engine files (`harness.ts`, `missions.ts`, etc.) keeps each module completely self-contained—you see both the data structure and the logic in one place without jumping between extra files.

---

### A. Root & Server Entry
- **`server.ts` (The Main Front Door)**: The central starting point of the application. It turns on the server, listens for user connections, and directs web requests to the appropriate route handlers.

---

### B. Domain Responsibilities & Module Scopes

To maintain clear boundary separation across API Routes (`src/api/routes/`), Core Engines (`src/core/`), UI Components (`frontend-next/components/`), and State Storage Files:

1. **`auth` (Authentication, Keys, Tiers, Tokens & Credentials)**
   - **Scope**: Handles everything auth or API key related: user login/logout, session tokens, master credentials, BYOK key validation, managed LLM API key pool management & rotation, pricing tiers (Free, Pro, Enterprise), and global token usage quota enforcement.
   - **API Route**: `src/api/routes/auth.routes.ts`
   - **Core Engine**: `src/core/auth.ts`
   - **UI Component**: `frontend-next/components/auth/`
   - **Data Store**: Global `.stash/auth.json` (shared across all users for auth, credentials, key pools, and tier limits).

2. **`tenant` (High-Level Tenant Management, Profiles & Telemetry)**
   - **Scope**: Handles everything high-level tenant related: managing the `/workspaces/<tenantId>/` root folder lifecycle, database engine persistence (`db.ts`), tenant profile & user settings, high-level harness/daemon process lifecycle management, system usage telemetry, and audit event logging.
   - **API Route**: `src/api/routes/tenant.routes.ts`
   - **Core Engine**: `src/core/tenant.ts`
   - **UI Component**: `frontend-next/components/tenant/`
   - **Data Store**: `/workspaces/<tenantId>/tenant.json` (per-tenant profile, user preferences, subscription limits, usage metrics, and audit event logs).

3. **`harness` (AI Agent Execution, Chat, Sessions & Controls)**
   - **Scope**: Engine for everything agent-related: live chat streaming console, Pi CLI background daemon process lifecycle, real-time session progress tracking, session history, AI model selection & rotation, suggestion cards, agent commands, output language options, web search toggle, autonomy levels, backlogs & code reviews, system prompt loading (`Fabrica_kernel/system_prompts/`), and extension hooks (`Fabrica_kernel/extensions/`).
   - **API Route**: `src/api/routes/harness.routes.ts`
   - **Core Engine**: `src/core/harness.ts`
   - **UI Component**: `frontend-next/components/harness/`
   - **Data Store**: `/workspaces/<tenantId>/harness.json` (per-tenant runtime state, active model selection, daemon options, suggestion cards, autonomy settings, and harness config).

4. **`missions` (Workflow Pipeline Orchestration & Mission State)**
   - **Scope**: Engine for everything mission-related: multi-step workflow pipeline orchestrator, mission state machines, step blueprints (Planning, Drafting, Execution, Delivery), mission CRUD operations, mission JSON schemas, and visual progress graphs.
   - **API Route**: `src/api/routes/missions.routes.ts`
   - **Core Engine**: `src/core/missions.ts`
   - **UI Component**: `frontend-next/components/missions/`
   - **Data Store**: `/workspaces/<tenantId>/missions.json` (per-tenant lightweight JSON database tracking all active & past missions).

5. **`workspace` (Project Storage, Phase Files & Uploads)**
   - **Scope**: Engine for everything inside the `/workspaces/<tenantId>/workspace/` directory: multi-tenant filesystem storage (`hybrid_fs.ts`), workspace scaffolding (`workspace_sync.ts`), phase storage (`Sources/` & `Deliverables/`), cloud/GCS storage sync, file upload pipelines, and the interactive file tree explorer.
   - **API Route**: `src/api/routes/workspace.routes.ts`
   - **Core Engine**: `src/core/workspace.ts`
   - **UI Component**: `frontend-next/components/workspace/`
   - **Data Store**: `/workspaces/<tenantId>/workspace.json` (per-tenant file index mapping all workspace Sources, Deliverables, and phase storage).

---

### C. Server Middlewares (`src/api/middlewares/` - Safety Checkpoints)
- **`src/api/middlewares/auth.middleware.ts` (Security Guard)**: Checks every incoming request to verify that the user is logged in and allowed to perform the action.
- **`src/api/middlewares/error.middleware.ts` (Error Safety Net)**: Catches unexpected crashes or bugs and sends back clear, helpful error messages to the screen.

---

### D. Kernel System Prompt Files (`Fabrica_kernel/`)
- **`Fabrica_kernel/system_prompts/` (System Instructions)**: Contains master instruction files and prompts that tell the AI agent how to behave and write high-quality code.
- **`Fabrica_kernel/extensions/` (Custom Add-ons)**: Reserved folder for optional custom scripts.

---

### E. User Interface Overview (`frontend-next/`)
- **`frontend-next/app/page.tsx` (Main App Screen)**: The visual workspace screen where users write prompts, view files, and interact with the AI agent.
- **`frontend-next/app/dashboard/page.tsx` (Admin Dashboard)**: Analytics and settings control panel for managing workspace accounts and viewing system metrics.
- **`frontend-next/components/auth/` (Auth & Key Management UI)**: Visual components for login modals, BYOK/managed key selection, and tier usage status.
- **`frontend-next/components/tenant/` (Tenant Profile & Usage UI)**: Visual components for workspace account settings, quota badges, telemetry graphs, and audit logs.
- **`frontend-next/components/harness/` (Live AI Agent Console)**: Interactive chat console, daemon controls, model selector, suggestion cards, web toggle, autonomy controls, and code review panels.
- **`frontend-next/components/missions/` (Mission Pipeline UI)**: Visual widgets showing mission steps, pipeline execution graphs, and status badges.
- **`frontend-next/components/workspace/` (File Explorer & Code View)**: The interactive file tree, code viewer, and phase storage manager (`Sources/` & `Deliverables/`).
- **`frontend-next/lib/api.ts` (Frontend Connection Bridge)**: Typed SDK for sending requests from the browser screen to backend API routes cleanly.

---

### F. User Variables & State File Storage Mapping

All application variables and state persistence are strictly stored in these designated JSON stores:

#### 1. Shared Global Storage
- **`.stash/auth.json`**: Shared across all users for all authentication state, master credentials, managed LLM API key pools, BYOK configs, pricing tiers, and global token quota limits.

#### 2. Tenant-Specific Isolated Storage (`/workspaces/<tenantId>/`)
- **`tenant.json`**: Stores high-level tenant profile info, user preferences, subscription tier state, telemetry metrics, and audit event logs.
- **`harness.json`**: Stores live agent daemon state, selected AI model, suggestion cards, autonomy levels, output language, web search settings, and harness runtime options.
- **`missions.json`**: Stores all active and historical mission state records, pipeline execution blueprints, and mission schemas.
- **`workspace.json`**: Stores the complete file index mapping for phase storage (`Sources/` & `Deliverables/`) and cloud storage sync.

```
/workspaces/<tenantId>/
├── .pi/                              # Hidden Pi Agent Runtime Folder
│   ├── agent/                        # Agent internal runtime state
│   ├── sessions/                     # Native Pi agent session history (.jsonl files)
│   ├── skills/                       # Custom AI skills created for this tenant
│   └── extensions/                   # Custom AI extensions created for this tenant
│
├── workspace/                        # File & Project Storage
│   ├── Sources/                      # Uploaded documents, data sources, & reference files
│   └── Deliverables/                 # AI-generated artifacts, reports, & code deliverables
│
├── missions/                         # Active Mission Working Folders
│   └── <missionId>/                  # Subfolders containing output files for specific missions
│
├── AGENTS.md                         # Persistent instruction guidelines for the AI agent
├── tenant.json                       # Tenant profile, user preferences, telemetry metrics, & audit logs
├── harness.json                      # Live daemon state, selected model, suggestions, autonomy, & harness options
├── missions.json                     # Light JSON database tracking all active & past missions
└── workspace.json                    # File index mapping all workspace Sources, Deliverables, & phase storage
```

---
*Updated: July 31, 2026 — Fabrica OS Architecture Team*
