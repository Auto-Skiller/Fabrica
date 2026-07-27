# Fabrica — The Autonomous Business Partner

> ### **AI knows HOW to build. Fabrica shows it WHAT.**

Fabrica is a persistent context-operating system engineered for business owners, project managers, and enterprise leaders who want to leverage autonomous AI agents to run and scale complex operations. While standard AI assistants execute transient single-turn queries and quickly lose context, Fabrica maintains structured memory, secure databases, sandboxed execution channels, and dedicated workflows to steer autonomous business partners reliably over long horizons.

---

## 🌟 The Core Value Proposition

### The Problem
Traditional AI tools suffer from severe context loss. Every new conversation forces you to re-explain your company background, re-upload spreadsheets, and manually re-specify your business rules. Critical technical progress evaporates between chat sessions.

### The Fabrica Solution
Fabrica organizes all your operational files, datasets, workflows, and code components into a single **persistent business brain**:
* **Zero Context Drift**: Your strategic plans, business rules, task histories, and database schemas are stored in a multi-tenant relational database engine. You can resume any session with perfect context.
* **Processes Real Enterprise Data**: Ingest raw spreadsheets, chat logs, email dumps, or legacy database schemas. Fabrica normalizes unstructured inputs and compiles functional systems to run on them.
* **Outcome-First Leadership**: Decisions are presented through clean visual options and ROI-scored task lists (Cost, Benefit, Worth-It scores). No code or complex pipelines required for decision makers.
* **Enterprise Security & Isolation**: Features tenant-isolated storage buckets with Customer-Managed Encryption Keys (CMEK), Row-Level Security (RLS) data partitioning, and sandboxed code execution environments.

---

## 🚀 Key Platform Features & Workspace Experience

### 1. Modern 3-Panel Workspace
* **Global Header Controls**:
  * **Model Selector**: Switch seamlessly between AI providers (`gemini-2.0-flash`, `claude-3-5-sonnet`, `openrouter/`, etc.) with automatic API key routing.
  * **Active Session Switcher**: Minimized session badge (`Session 1`) with a dropdown switcher to manage, create, rename, or delete chat sessions. Full conversation histories persist to backend `app_config` and local storage per tenant, surviving logouts and session switches.
  * **Live Voice Trigger (🎙️)**: Adjacent streaming voice channel button providing real-time audio interaction.
* **Consolidated 2-Section Account & API Modal**:
  * **Section 1 (👤 Account & Workspace)**: Workspace Identity, Token Usage Quota Meters, Stripe Subscription Plans (Starter/Pro/Enterprise), and 256-bit Encrypted Card Payment Link.
  * **Section 2 (🔑 Tokens & API Credentials)**: BYOK Multi-Provider Keys (Google AI, OpenRouter, Anthropic Claude) with live status verification badges (`✓ VERIFIED`), User Harness Engine & Model Intelligence, Free Tokens Pool & Key Load Balancer, and Managed LLM Credits with PAUG Refills.
* **Panel A (System Maps & Configs)**:
  * **3-Level Autonomy Selector**: Switch between **FULL AUTO** (auto-synthesizes new contextual missions, resolves agent QA gates, executes code tasks, and hot-swaps compiled components), **SEMI-AUTO** (auto-executes planned tasks while holding user missions at QA gates), and **SUPERVISED** (manual approval at every gate).
  * **Real-time 5s Polling**: Automatically streams background mission creation, task completions, and component deployments to the screen.
  * Micro-event timeline and interactive Cytoscape sources & dependency flow graph linking Inbox → Gateway → OS Prompts/Data.
* **Panel B (Missions Board & Chat)**:
  * Horizontal project board managing work across 4 status stages (*Drafting*, *Planning*, *Execution*, *Archive*).
  * High-density **Quick Injections Panel**: 2-card prompt suggestions grid directly under chat controls, featuring title, icon, and truncated description text with zero horizontal overflow.
* **Panel C (50/50 Split Data & Systems View)**:
  * Expanded dual-column layout providing equal 50% width columns for **Your Data** (`raw_data`) and **Your Systems** (`system_components`).
  * **Vertical Dividing Line**: A crisp `1.5px solid var(--border-soft)` separator line spans continuously down the center across both the top sub-section header controls and the list body container.
  * Sub-section search filters, import/export triggers, and D3 force-directed dependency visualization toggles.

### 2. Enterprise Hybrid Backend Engine & 24/7 Autonomous Simulator
* **24/7 Multi-Tenant Autonomous Simulator (`src/simulator.ts`, `src/sync.ts`)**: Background daemon driving missions through Drafting, QA, Planning, Execution, and Archive stages. Under FULL AUTO, automatically synthesizes new contextual missions from raw data and system components when active queues drop below threshold.
* **VM Sandboxed Execution (`src/execution/sandbox.ts`)**: Dynamically executes user or agent-generated JavaScript/TypeScript in an isolated Node.js `vm` context with global object locks (`process`, `require` blocked) and CPU time budgeting (default `1000ms` timeout).
* **High-Concurrency Task Orchestrator (`src/pipeline/orchestrator.ts`)**: Queue-based task scheduler managing parallel background syncs and simulation runs with deduplication and thread worker pool limits.
* **Hybrid Storage & Vertex AI Search (`src/db/hybrid_storage.ts`, `src/utils.ts`)**: Tenant-isolated GCS buckets (`gs://fabrica-tenant-[id]-bucket`) coupled with multi-tenant Vertex AI Search discovery engine query execution (`searchTenantDocuments`) and TTL caching.
* **Relational Supabase DB Engine (`src/db/db_engine.ts`)**: Multi-tenant database layer enforcing Row-Level Security (RLS) and strict tenant isolation checks (`validateTenantId`), persisting user settings and chat sessions in `app_config`.

---

## 🏛️ Inside the Agent Kernel Architecture

Fabrica isolates its core intelligence into a read-only **Agent Kernel** (`/Fabrica_kernel/`), separating kernel laws and workflows from client workspace data:

```
Fabrica/
├── Fabrica_kernel/
│   ├── extensions/            # Kernel Extensions (context_injector, workspace_sync, registry_bridge)
│   ├── prompts/               # Kernel System Laws & Operational Guides
│   │   ├── 01_identity.md     # Purpose, target audience, and system boundary
│   │   ├── 02_laws.md         # 6 Immutable Hard Laws of the Kernel
│   │   ├── 03_behaviors.md    # Persona, verbal notation ([*],[OK],[+],[ERR]), 5-part error reports
│   │   ├── 04_infrastructure.md # Port 3000 rules, full-stack server, sandbox, 4-directory workspace model
│   │   ├── 05_capabilities.md # Skills, extensions, maturity ladder, and 50/50 dual-column specs
│   │   ├── 06_modes.md        # Execution modes, phase planning & execution workflows
│   │   └── 07_app_guide.md    # 3-Panel Workspace UI guide & overlay panel
│   └── skills/                # 12 Read-only Built-in Kernel System Skills
├── workspaces/<tenant_id>/    # Clean 4-Directory Isolated User Workspace
│   ├── .pi/                   # PI Agent workspace skills, extensions, & auth
│   ├── db/                    # SQLite & JSON persistence engine (runtime.json, projects.json, etc.)
│   ├── projects/              # Project datasets & system code components
│   └── missions/              # Real-time sync mission planning & execution space
├── src/                       # Enterprise Backend Services
│   ├── harness.ts             # User workspace harness & execution options
│   ├── execution/sandbox.ts   # Secure VM JS sandbox context
│   ├── pipeline/orchestrator.ts# Parallel worker pool scheduler
│   ├── db/db_engine.ts        # Supabase RLS database client
│   ├── db/hybrid_storage.ts   # CMEK GCS object storage
│   ├── db/llm_key_pool.ts     # Multi-provider LLM key pool & load balancer
│   ├── db/tier_manager.ts     # Subscription tier & token credit engine
│   ├── sync.ts                # 24/7 background simulation loop
│   └── utils.ts               # Vertex AI Search & system utilities
├── server.ts                  # Express 4 API server entrypoint
└── frontend-next/             # Next.js 15 Client Application
    ├── app/dashboard/page.tsx # Primary 3-Panel Workspace UI
    └── components/flow/       # Cytoscape & D3 interactive graph visualizers
```

---

## 🛠️ Technology Stack

* **Frontend Framework**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React
* **Graph & Data Visualization**: Cytoscape.js, D3.js, Recharts
* **Backend Server**: Node.js 22, Express 4, `tsx` / Esbuild
* **Database & Persistence**: Supabase PostgreSQL (Row-Level Security), Local Schema Fallbacks
* **Storage & RAG Search**: Google Cloud Storage (CMEK), Vertex AI Search Discovery Engine
* **Code Execution**: Node.js `vm` (Isolated Virtual Machine Context)

---

## ⚙️ Quick Start & Development

### Environment Requirements
* Node.js >= 20.x or Bun >= 1.1
* Nginx or Port 3000 accessibility

### Installation & Startup

```bash
# 1. Install dependencies
npm install

# 2. Build static frontend assets
npm run build:frontend

# 3. Start development server on Port 3000
npm run dev

# 4. Production build & bundle start
npm run build
npm run start
```

---

## 🛡️ License & Copyright

© 2026 Fabrica. AI knows how to build, we show it what. All rights reserved.
