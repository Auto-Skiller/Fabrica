# Infrastructure & Systems Guide

This guide describes the physical and logical layout of the Fabrica application, including database clients, sandboxed execution, pipeline orchestrators, hybrid storage, search engines, and multi-user scaling.

## 1. RUNTIME & NETWORK CONSTRAINTS
- **The Port 3000 Rule**: The application runs behind an Nginx reverse proxy routing external web traffic exclusively on **Port 3000**. All development and production web servers MUST run on port 3000. Other ports are inaccessible from outside the sandboxed container.
- **HMR Disabled**: Hot Module Replacement (HMR) is disabled in our environment. The client UI is refreshed after an agent turn is completed.

---

## 2. CLIENT/SERVER FULL-STACK ARCHITECTURE
The system operates as a full-stack Node.js application:
- **Production Entrypoint**: `dist/server.cjs` (compiled via Esbuild from `server.ts`).
- **Static Frontend Hosting**: The Next.js web application is built into `frontend-next/out/`. The Express backend `server.ts` serves these static assets using `express.static('frontend-next/out')` on Port 3000, and exposes backend API endpoints on `/api/*`.

### Development and Build Scripts (`package.json`)
- `npm run dev`: Boots the development server with `tsx server.ts`.
- `npm run build:frontend`: Compiles Next.js into static HTML/CSS files under `frontend-next/out/`.
- `npm run build`: Bundles the Express server and copies assets.
- `npm run start`: Boots the production bundled server using `node dist/server.cjs`.

---

## 3. SANDBOXED CODE EXECUTION ENGINE (`/src/execution/sandbox.ts`)
To safely execute dynamic user or AI-generated scripts without security risks:
- **Isolated Node.js VM Context**: Code runs inside `vm.createContext()` with prototype freezing and zero access to file system or environment variables.
- **Global Object Locks**: Global channels (`process`, `require`, `module`, `exports`, `global`, `setTimeout`) are explicitly removed.
- **CPU Time Budgeting**: Strict execution timeouts (default `1000ms`) prevent infinite loops and resource exhaustion attacks.
- **API Endpoint**: `POST /api/sandbox/execute` executes code and returns a structured payload with `success`, `result`, `logs`, and `executionTimeMs`.

---

## 4. HIGH-CONCURRENCY PIPELINE ORCHESTRATOR (`/src/pipeline/orchestrator.ts`)
To handle background syncs and agentic mission execution without process bottlenecks:
- **Worker Pool**: Uses a queue-based task scheduler with configurable concurrency (default 4 concurrent workers).
- **Tenant Coalescing & Deduplication**: Prevents duplicate task stacking per tenant/user.
- **API Endpoint**: `GET /api/pipeline/status` returns live queue metrics, active worker counts, and execution logs.

---

## 5. HYBRID STORAGE & VERTEX AI SEARCH (`/src/db/hybrid_storage.ts`, `/src/utils.ts`)
- **Tenant-Isolated Object Storage**: Documents and binaries are saved to tenant-scoped Google Cloud Storage buckets (`gs://fabrica-tenant-[id]-bucket`) with CMEK encryption and local fallback buffers.
- **Multi-Tenant RAG Search**: Uses Vertex AI Search Discovery Engine (`searchTenantDocuments`) to query isolated tenant datastores (`tenant-[id]-datastore`) with local search fallback and TTL caching.

---

## 6. SUPABASE DB INTEGRATION & RAG INDEXING
The relational Supabase PostgreSQL database serves as the primary source of persistent truth for instant multi-user scaling.

### Query Construction Rules
1. **Multi-User Partitioning**: Every single query MUST explicitly filter by `user_id` matching the authenticated session / `tenantId`.
2. **Text Indexing for Agent RAG**:
   - The tables `raw_data` and `system_components` have text search triggers or PGVector embeddings.
   - Partial match query:
     ```sql
     SELECT id, name, metadata FROM raw_data WHERE user_id = $1 AND name ILIKE $2;
     ```
3. **Database Client**: `@supabase/supabase-js` client initialized on the Express server. Credentials load securely from environment variables.

---

## 7. TARGET WORKSPACE DIRECTORY HIERARCHY & STATE PERSISTENCE
Every tenant operates within an isolated workspace root at `workspaces/<tenant_id>/` structured as follows:

```
workspaces/<tenant_id>/
├── .pi/                            # PI Agent Kernel (isolated user workspace)
│   ├── agent/
│   │   ├── auth.json               # Persisted API keys & provider authentication tokens
│   │   └── models-store.json       # Cached model capabilities & provider metadata
│   ├── skills/                     # User-defined custom skills
│   └── extensions/                 # User-defined custom extensions
│
├── db/                             # Structured States and Mappings
│   ├── settings.json               # Read-only configuration (Language, internet access, autonomy, capabilities, subscription, quota, alerts)
│   ├── runtime.json                # Read-Write runtime state (Suggestions, backlogs, review queues, recent_events)
│   ├── projects.json               # Project states & mappings
│   └── missions.json               # Mission states & mappings
│
├── projects/<project_name>/        # Project Datasets & Systems
│   ├── data/                       # Raw datasets & imported documents
│   └── systems/<system_name>/      # Built or imported project systems
│
└── missions/                       # Mission Planning Artifacts & Execution Space
    ├── standard/<mission_id>/ (planning/, execution/)
    ├── analytics/<mission_id>/ (planning/, execution/)
    ├── deep_research/<mission_id>/ (planning/, execution/)
    ├── brainstorming/<mission_id>/ (planning/, execution/)
    ├── build/<mission_id>/ (planning/, execution/)
    ├── build_from_data/<mission_id>/ (planning/, execution/)
    ├── optimization/<mission_id>/ (planning/, execution/)
    ├── optimization_from_data/<mission_id>/ (planning/, execution/)
    ├── test/<mission_id>/ (planning/, execution/)
    └── test_from_data/<mission_id>/ (planning/, execution/)
```

### System Autonomy Levels
1. **FULL AUTO (`autonomous`)**:
   - **Auto-Mission Generation**: System automatically synthesizes and creates new contextual missions (e.g. `build`, `build_from_data`, `optimization`, `analytics`) whenever active drafting/planning mission count drops below 2.
   - **Auto-QA Gatekeeping**: Agent automatically answers and approves QA gates for agent/system-created missions using workspace context.
   - **Full Lifecycle Execution**: Moves missions from Planning into Execution (`missions/<type>/<id>/execution/`), sequentially finishes tasks, compiles and hot-swaps new system components, and archives completed missions (`status = 'archive'`).
2. **SEMI-AUTO (`semi-autonomous`)**:
   - System automatically executes planning and task steps once a mission enters Planning, but requires explicit user action at QA gates for user-created missions (`user_created: true`).
3. **SUPERVISED (`manual`)**:
   - System pauses at QA gates and planning proposals, requiring manual user approval before advancing phases.

### App Configuration & State Mirroring API
User configuration and state persist across sign-out and re-login sessions and mirror automatically into `db/settings.json`, `db/runtime.json`, `db/projects.json`, and `db/missions.json`:

- **Agent rules and kernel knowledge** are injected via `Fabrica_kernel/prompts/` (loaded by `system_prompt_injector.js` extension). There is no `AGENTS.md` in the workspace — all operating rules live in the kernel prompts.
- **Tenant-Isolated Endpoints**:
  - `GET /api/db/app-config?tenantId=[id]` & `POST /api/db/app-config` — settings & app config
  - `GET /api/user/:tenantId/db/runtime` & `POST /api/user/:tenantId/db/runtime` — agent runtime state (suggestions, backlogs, review_queues)
  - `GET /api/user/:tenantId/db/settings` — read-only agent settings
- **Persisted State Object (`settings` & `runtime`)**:
  - `autonomy`: `'autonomous'` | `'semi-autonomous'` | `'manual'`
  - `chat_sessions`: Full list of ChatSession objects with conversation histories
  - `active_session_id`: Active chat session identifier
  - `tools_enabled`: Global tools toggle state
  - `theme`: `'light'` | `'dark'`
  - `ui_lang`: `'EN'` | `'FR'` | `'AR'`
- **Fallback Hierarchy**: Dual local caching (`localStorage`) + backend storage guarantees instant loading with zero history loss.

---

## 8. AGENT OPERATING RULES: `projects/` vs `missions/`

### `projects/` Directory
- `projects/` is the **permanent, isolated archive** repository for project data (`projects/<project_name>/data/`) and system components (`projects/<project_name>/systems/`).
- **STRICT RULE**: The Agent must **NEVER** edit, modify, or do work directly inside the `projects/` directory.
- **Permitted Operations on `projects/`**:
  1. `READ` / `VIEW`: Inspecting data or system components.
  2. `LIST`: Listing directory contents.
  3. `MOVE IN` / `MOVE OUT`: Transferring files/folders between `projects/` and `missions/`.

### `missions/` Directory
- `missions/` is the **active execution environment** (`missions/<mission_type>/<mission_id>/`).
- **Workflow**:
  1. When work on a data or system file is required, the Agent **moves** or creates the item inside the relevant `missions/<mission_type>/<mission_id>/` folder.
  2. All edits, creations, tests, transforms, and iterations MUST take place inside `missions/`.
  3. Upon completion, the Agent **moves** the finalized artifact back to the target `projects/<project_name>/` directory (`data/` or `systems/`).

---

## 9. 3-WAY REAL-TIME BI-DIRECTIONAL SYNCHRONIZATION PROTOCOL

The application enforces strict **3-way real-time bi-directional state synchronization** across **User UI ↔ Databases (`projects.json` & `missions.json`) ↔ Disk Storage (`projects/` & `missions/`)**:

1. **User UI → DB → Disk**:
   - When a user adds, edits, or deletes a project item or mission step in the UI, the backend updates `db/projects.json` or `db/missions.json` instantly and automatically reflects changes in the physical folders and files.
2. **Agent → DB → Disk & UI**:
   - When the agent adds, edits, or deletes something in `db/*.json` or disk storage, the physical files update instantly and the dashboard UI updates in real time.
3. **Disk → DB → UI**:
   - When files or folders inside `projects/` or `missions/` are added, modified, or removed, `syncProjectsDb()` and `syncMissionsDb()` immediately re-index the changes into `db/projects.json` and `db/missions.json`, broadcasting live updates to the UI.

### `projects/` ↔ `db/projects.json`
- Every folder, data file, and system component in `projects/` is strictly mapped to `db/projects.json` in real time.

### `missions/` ↔ `db/missions.json`
- Every mission directory, planning blueprint (`planning/blueprint.md`, `plan.json`), execution log (`execution/execution.json`, `execution_history.md`), and active mission artifact under `missions/` is strictly mapped to `db/missions.json` in real time.
