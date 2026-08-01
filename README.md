# Fabrica — The Business-First Autonomous Operating System

> ### **Turn RAW BUSINESS SYSTEMS into AUDITED CLIENT DELIVERABLES via AUTONOMOUS OPERATIONS.**
> #### *AI knows how to reason. Fabrica gives it the 24/7 autonomous business pipeline.*
> **Stop prompting. Draft, plan, execute, and verify — from a single Dashboard, with zero technical setup.**

Fabrica is a Business-First autonomous operating system engineered for **non-technical solopreneurs, independent consultants, small marketing/creative agencies, small startup ops & growth teams, and researchers & analysts**. While standard AI chat interfaces execute transient single-turn queries and quickly lose context, Fabrica provides full control over a structured, repeatable 24/7 autonomous 4-stage business pipeline (**Drafting ➔ Planning ➔ Execution ➔ Delivery**), entirely from the UI, with **zero technical setup**.

---

## 🌟 The Core Value Proposition

### The Problem
Traditional AI chat interfaces suffer from severe context loss and lack business structure. Every new chat session forces non-technical founders, consultants, and agency teams to re-explain client context, re-upload background materials, and manually copy-paste AI responses into proposals, decks, or spreadsheets.

### The Fabrica Solution
Fabrica organizes all your research sources, client briefs, strategic plans, and execution deliverables into a single **persistent business operating system**:
* **Zero Technical Setup**: 100% UI-controlled workspace. Select your preferred model brain (Google Gemini, Anthropic Claude, or OpenRouter), click to execute, and monitor progress without writing code or managing developer environments.
* **Structured 4-Stage Mission Pipeline**: Every mission flows through **Drafting ➔ Planning ➔ Execution ➔ Delivery** with dedicated sub-phases, automated QA gates, and 3-choice strategic option trade-offs before final delivery.
* **Persistent Business Memory**: Your strategic briefs, research sources, audit trails, and client deliverables reside in a secure, multi-tenant relational database engine. Resume any project with zero context drift.
* **24/7 Autonomy Mode**: Set your autonomy preferences (Full Auto, Semi-Auto, Supervised) and let Fabrica run background research rounds, market tracking, and pipeline tasks even after you close the browser tab.
* **Structured Workspace & Storage Layer**: Separate dedicated folders per phase (`Sources/` for scoping, research, and synthesis inputs; `Deliverables/` for execution outputs and client reviews) with full audit capabilities.

---

## 🎯 Target Audience & Core Use Cases

Fabrica is built specifically for operators who need repeatable research ➔ analysis ➔ deliverable pipelines without hiring analysts or writing prompts every time:

1. **Independent Consultants**: Automate market research, competitor audits, and client strategy briefs so you sell high-value judgment, not billable research hours.
2. **Small Marketing & Creative Agencies**: Standardize output quality across all accounts with repeatable autonomous pipelines and custom agency skills.
3. **Solopreneurs & DTC Founders**: Run an autonomous research, market intelligence, and operations team without hiring staff or needing technical dev skills.
4. **Startup Ops & Growth Teams**: Generate data-backed growth playbooks, competitive tracking matrices, and strategic proposals fast without waiting on engineering capacity.
5. **Researchers & Analysts**: Build defensible audit trails with verified citations and automatic fact-checking before final report delivery.

---

## 🚀 Key Platform Features & Workspace Experience

### 1. Modern 3-Panel Workspace
* **Global Header Controls**:
  * **Model Selector**: Switch seamlessly between AI model brains (`gemini-2.5-flash`, `claude-3-5-sonnet`, `openrouter/`, etc.) with automatic API key routing.
  * **Active Session Switcher**: Minimized session badge (`Session 1`) with a dropdown switcher to manage, create, rename, or delete chat sessions. Full conversation histories persist to backend `app_config` and local storage per tenant.
  * **Live Voice Trigger (🎙️)**: Streaming voice channel button providing real-time audio interaction.
* **Consolidated 2-Section Account & API Modal**:
  * **Section 1 (👤 Account & Workspace)**: Workspace Identity, Token Usage Quota Meters, Subscription Plans, and Support Email (`fabrica.studio.contact@gmail.com`).
  * **Section 2 (🔑 Tokens & API Credentials)**: BYOK Multi-Provider Keys (Google AI Studio, OpenRouter, Anthropic Claude) with live status verification badges (`✓ VERIFIED`), User Harness Engine, and Managed LLM Credits.
* **Unified Skills & Integrations Modal (`🛠️ Integrations`)**:
  * **Preset Integrations Grid**: Platform-native SVG icons across 6 categories (*Storage & Project Management*, *Messaging & Team Control*, *Customer Interactions*, *Automations & Workflows*, *Business & Commerce*, *Creative Generation & Voice*).
  * **Workspace Skills Editor**: Full tree viewer and editor for custom workspace skills (`.pi/skills/`) with structured YAML frontmatter parsing (`What`, `When`, `Why`, `Triggers`, `Inputs`, `Outputs`).
* **Panel A (System Maps & Configs)**:
  * **3-Level Autonomy Selector**: Switch between **FULL AUTO** (auto-synthesizes contextual missions and executes pipeline tasks), **SEMI-AUTO** (auto-executes planned tasks while holding at QA gates), and **SUPERVISED** (manual approval at every gate).
  * **Real-time 5s Polling**: Automatically streams background mission creation and deliverable progress to the screen.
* **Panel B (Missions Board & Chat)**:
  * Horizontal project board managing work across 4 status stages (**Drafting**, **Planning**, **Execution**, **Delivery**).
  * High-density **Quick Injections Panel**: 2-card prompt suggestions grid directly under chat controls.
* **Panel C (50/50 Split Storage & Artifacts View)**:
  * Expanded dual-column layout providing equal 50% width columns for **Sources** (`raw_data`) and **Deliverables** (`system_components`).
  * Sub-section search filters, import/export triggers, and D3 force-directed dependency visualization toggles.

### 2. Enterprise Hybrid Backend Engine & 24/7 Autonomous Simulator
* **24/7 Multi-Tenant Autonomous Daemon (`src/sync.ts`)**: Background daemon driving missions through Drafting, QA, Planning, Execution, and Archive stages. Under FULL AUTO, automatically synthesizes new contextual missions from raw data and system components when active queues drop below threshold.
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
├── workspaces/<tenant_id>/    # Clean Isolated User Workspace
│   ├── .pi/                   # PI Agent workspace skills, extensions, & auth
│   ├── settings.json          # Read-only configuration (Language, autonomy, capabilities, subscription)
│   ├── runtime.json           # Agent runtime state (Suggestions, backlogs, review queues, recent events)
│   ├── db/                    # JSON persistence engine (missions.json, etc.)
│   ├── Sources/               # Data Sources & Inputs Ecosystem
│   ├── Deliverables/          # Production Assets & Execution Outputs
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

* **Frontend Framework**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React
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

## 📬 Contact & Support

For inquiries, enterprise deployments, and feedback, contact the team at:
* **Official Email**: `fabrica.studio.contact@gmail.com`


## 🛡️ License & Copyright

© 2026 Fabrica. AI knows how to build, we show it what. All rights reserved.
