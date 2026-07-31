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
   - The tables `raw_data`, `artifacts`, and `system_components` have text search triggers or PGVector embeddings.
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
├── AGENTS.md                       # User context file (business context, domain rules, goals - kept empty by default)
├── logs.json                       # Event/audit log stream
├── missions.json                   # Single mission states & mappings file
├── workspace.json                  # Single index map for Sources and Deliverables storage
├── settings.json                   # Read-only configuration (Language, internet access, autonomy, capabilities, subscription, quota, alerts)
├── runtime.json                    # Read-Write runtime state (Suggestions, backlogs, review queues, recent_events)
│
├── missions/{missionId}/           # Ephemeral scratchpad space (code runs, temp files, draft steps) - working area of active mission executions
└── workspace/                      # Central storage of inputs/outputs and all storages
    ├── Sources/                        
    │   ├── Discovery & Scoping/        # Scoping documentations, interactive Q&A briefs, cost/time trade-off options
    │   ├── Deep Research & Intelligence Gathering/ # Scraped docs, research papers, competitor scans, API references
    │   ├── Data Analysis & Pattern Extraction/ # Processed datasets, computed metrics, anomaly reports, trend insights
    │   └── Strategic Synthesis & Decision Support/ # Executive strategic plans, risk audits, roadmaps, decision matrices
    └── Deliverables/                   
        ├── Executions/                 # Generated codebases, database schemas, workflow automations, assets
        ├── Reviews/                    # Verified production deliverables waiting for human sign-off
        └── Completed/                  # Accepted production deliverables & archived release artifacts
```

### Protection of Mission Schemas & Phase Schemas
Mission schemas reside securely inside `Fabrica_kernel/schemas/`:
- `standard.json`: Full master multi-phase pipeline schema.
- `drafting.json`: Drafting and discovery phase schema.
- `planning.json`: Planning and architecture phase schema.
- `delivery.json`: Delivery, core implementation, and QA verification phase schema.

When adding new missions via the UI or updating `missions.json`:
1. The server dynamically loads the schema into memory from `Fabrica_kernel/schemas/{type}.json` (`standard`, `drafting`, `planning`, or `delivery`) and passes it to the runner.
2. Each schema specifies its own metadata, rules, and sub-schema / sub-stage breakdown.
3. `missions.json` tracks active execution scratchpads inside `missions/{missionId}/` for working steps, draft files, and ephemeral runs.
4. Proprietary prompt schema source files or system instruction templates are **never** dropped into the user's workspace. Users can only see their active mission state in `missions.json` and outputs in `workspace/`—never proprietary system prompt schemas.

### System Autonomy Levels
1. **FULL AUTO (`autonomous`)**:
   - **Auto-Mission Generation**: System automatically synthesizes and creates new contextual missions whenever active drafting/planning mission count drops below 2.
   - **Auto-QA Gatekeeping**: Agent automatically answers and approves QA gates for agent/system-created missions using workspace context.
   - **Full Lifecycle Execution**: Moves missions from Planning into Execution (`missions/<id>/execution/`), sequentially finishes tasks, compiles and hot-swaps new system components, and archives completed missions (`status = 'archive'`).
2. **SEMI-AUTO (`semi-autonomous`)**:
   - System automatically executes planning and task steps once a mission enters Planning, but requires explicit user action at QA gates for user-created missions (`user_created: true`).
3. **SUPERVISED (`manual`)**:
   - System pauses at QA gates and planning proposals, requiring manual user approval before advancing phases.

### App Configuration & State Mirroring API
User configuration and state persist across sign-out and re-login sessions and mirror automatically into `settings.json`, `runtime.json`, `missions.json`, `workspace.json`, and `logs.json`:

- **Agent rules and kernel knowledge** are injected via `Fabrica_kernel/prompts/` (loaded by system prompt extensions) and customizable per tenant via `AGENTS.md` (`workspaces/<tenant_id>/AGENTS.md`). Users can inspect, edit, and save runtime directives dynamically via `GET /api/context/agents-md` and `POST /api/context/agents-md`.
- **Tenant-Isolated Endpoints**:
  - `GET /api/db/app-config?tenantId=[id]` & `POST /api/db/app-config` — settings & app config
  - `GET /api/user/:tenantId/db/runtime` & `POST /api/user/:tenantId/db/runtime` — agent runtime state (suggestions, backlogs, review_queues)
  - `GET /api/user/:tenantId/db/settings` — read-only agent settings
  - `GET /api/user/:tenantId/db/missions` & `POST /api/user/:tenantId/db/missions` — single `missions.json` state
  - `GET /api/user/:tenantId/db/workspace` & `POST /api/user/:tenantId/db/workspace` — single `workspace.json` map file
  - `GET /api/user/:tenantId/db/logs` & `POST /api/user/:tenantId/db/logs` — event/audit log stream (`logs.json`)
  - `GET /api/missions/schemas/:type` — dynamic protected mission schema loader
  - `GET /api/context/agents-md` & `POST /api/context/agents-md` — read and update user business context (`AGENTS.md`)
  - `GET /api/cache/status` & `POST /api/cache/refresh` — Gemini context caching management
  - `GET /api/llm/key-pool/stats` & `POST /api/llm/key-pool/add-key` — multi-key load balancer statistics & API key pool management
- **Persisted State Object (`settings` & `runtime`)**:
  - `autonomy`: `'autonomous'` | `'semi-autonomous'` | `'manual'`
  - `chat_sessions`: Full list of ChatSession objects with conversation histories
  - `active_session_id`: Active chat session identifier
  - `tools_enabled`: Global tools toggle state
  - `theme`: `'light'` | `'dark'`
  - `ui_lang`: `'EN'` | `'FR'` | `'AR'`
- **Fallback Hierarchy**: Dual local caching (`localStorage`) + backend storage guarantees instant loading with zero history loss.

---

## 8. AGENT OPERATING RULES: `workspace/` Storage vs `missions/` Scratchpad

### `workspace/` Storage Repository (`Sources/` & `Deliverables/`)
- `workspace/Sources/` is the **permanent repository for inputs, research, analytics, and plans** (`Discovery & Scoping`, `Deep Research & Intelligence Gathering`, `Data Analysis & Pattern Extraction`, `Strategic Synthesis & Decision Support`).
- `workspace/Deliverables/` is the **repository for execution outputs, reviews, and completed release assets** (`Executions`, `Reviews`, `Completed`).
- **STRICT RULE**: The Agent reads inputs from `workspace/Sources/` and generates working code, assets, or scripts into `workspace/Deliverables/Executions/`.
- **Single Mapping Index**: `workspaces/<tenant_id>/workspace.json` indexes and maps all items in `workspace/Sources/` and `workspace/Deliverables/`.
- **Permitted Operations**:
  1. `READ` / `VIEW`: Inspecting sources or deliverables.
  2. `LIST`: Listing directory contents.
  3. `REGISTER`: Adding validated source items or deliverables.
  4. `RELOCATE`: Promoting items (e.g., from `Deliverables/Executions` -> `Deliverables/Reviews` upon verification success, or `Deliverables/Reviews` -> `Deliverables/Completed` upon user acceptance, or `Deliverables/Reviews` -> `Deliverables/Executions` upon review feedback).

### `missions/` Directory
- `missions/` is the **active ephemeral scratchpad space** (`missions/{missionId}/`).
- **Workflow**:
  1. All planning blueprints, intermediate scratchpads, and active task logs exist under `missions/{missionId}/`.
  2. Generated code or assets are stored into `workspace/Deliverables/Executions/`.
  3. Upon verification OK, items move to `workspace/Deliverables/Reviews/`.
  4. Upon user sign-off, deliverables move to `workspace/Deliverables/Completed/`.

---

## 9. 3-WAY REAL-TIME BI-DIRECTIONAL SYNCHRONIZATION PROTOCOL

The application enforces strict **3-way real-time bi-directional state synchronization** across **User UI ↔ Single State Mappings (`missions.json`, `workspace.json`, `logs.json`) ↔ Disk Storage (`workspace/Sources/`, `workspace/Deliverables/` & `missions/{missionId}/`)**:

1. **User UI → Index Files → Disk**:
   - When a user adds, edits, or deletes a source parameter or deliverable in the UI, the backend updates `workspace.json` or `missions.json` instantly and automatically reflects changes in the physical folders and files.
2. **Agent → Index Files → Disk & UI**:
   - When the agent adds, edits, or deletes something in `missions.json`, `workspace.json`, or disk storage, the physical files update instantly and the dashboard UI updates in real time.
3. **Disk → Index Files → UI**:
   - When files or folders inside `workspace/Sources/`, `workspace/Deliverables/`, or `missions/` are added, modified, or removed, `syncWorkspaceJson()` and `syncMissionsJson()` immediately re-index the changes into `workspace.json` and `missions.json`, broadcasting live updates to the UI.

### `workspace/Sources/` & `workspace/Deliverables/` ↔ `workspace.json`
- Every file and record in `workspace/Sources/` and `workspace/Deliverables/` is strictly mapped to `workspace.json` in real time.

### `missions/` ↔ `missions.json`
- Every mission directory, planning blueprint (`planning/blueprint.md`, `plan.json`), execution log (`execution/execution.json`, `execution_history.md`), and active mission scratchpad under `missions/{missionId}/` is strictly mapped to `missions.json` in real time.
