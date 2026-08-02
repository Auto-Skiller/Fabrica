# Harness & Agent Architecture Audit (`harness_arch.md`)

This document provides a production-grade, end-to-end architectural audit and logic walkthrough for the **Autonomous Harness**, **Agent Chat Interface**, **Pi Daemon Process Engine**, **System Prompts & Skills**, **Session & Log Management**, and **Realtime State Sync** across the frontend, backend microservices, and CLI agent runner.

---

## 1. System High-Level Topology & Flow Architecture

The platform architecture connects the **Next.js Dashboard Frontend**, **Express Backend Services**, **User Workspace File Stores**, and **Pi CLI Agent Daemons**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND DASHBOARD (page.tsx)                            │
│ ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────────────────────┐ │
│ │ Agent Chat Component │  │ Sessions & Models    │  │ Autonomy & Heartbeat Manager    │ │
│ │  - Input Textarea    │  │  - Session Switcher  │  │  - Autonomy Dropdown (Director) │ │
│ │  - Format Renderer   │  │  - Model Dropdown    │  │  - Pulse Timer (e.g. 20s)       │ │
│ │  - Send/Stop Controls│  │  - Language Selector │  │  - Backlog & Review Queues      │ │
│ └──────────┬───────────┘  └──────────┬───────────┘  └────────────────┬────────────────┘ │
└────────────│─────────────────────────│───────────────────────────────│──────────────────┘
             │                         │                               │
             ▼                         ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT API LAYER (api.ts)                                │
│                     harnessApi.chatAgent / runHarnessAgent / stopAgent                  │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │ HTTP JSON REST API
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS API ROUTES & MIDDLEWARE                            │
│                           (src/api/routes/harness.routes.ts)                            │
│    /api/harness/run    /api/harness/stop     /api/harness/sessions    /api/harness/state │
└──────────────────────────────────────────┬──────────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                CORE HARNESS ENGINE (src/core/harness.ts)                │
│ ┌───────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────────────┐ │
│ │ Daemon Registry           │ │ System Prompts Loader     │ │ Key Pool & BYOK Sync     │ │
│ │ activePiDaemons: Map      │ │ Fabrica_kernel + AGENTS.md│ │ syncPiUserAuthKeys       │ │
│ └─────────────┬─────────────┘ └─────────────┬─────────────┘ └────────────┬─────────────┘ │
└───────────────│─────────────────────────────│────────────────────────────│──────────────┘
                │                             │                            │
                ▼                             ▼                            ▼
┌──────────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│           PI CLI RUNNER PROCESS              │ │           TENANT FILE STORAGE          │
│         (node_modules/.bin/pi)               │ │        (workspaces/<tenant_id>/)        │
│  Flags: -p --mode json --session-id <id>     │ │  ├── harness.json (State, Model, Qs)   │
│         --model <provider/model>             │ │  ├── AGENTS.md (Custom Directives)     │
│         --skill <path> --extension <path>    │ │  ├── .pi/agent/ (auth, models, jsonl)  │
│         --append-system-prompt <combined>    │ │  └── workspace/ (Sources, Deliverables)│
└──────────────────────────────────────────────┘ └────────────────────────────────────────┘
```

---

## 2. Comprehensive Subsystem Audit (16 Core Components)

### 2.1 Agent Chat (Input and Output)
- **Frontend Input (`page.tsx`)**:
  - Rendered via `<textarea id="agent-chat-textarea">` with mouse drag mechanics (`isDraggingChatInput`, `chatInputHeight`).
  - Accepts user text, file drops, and extra context items (`selectedExtraSources`).
  - Triggered via `Enter` key (without `Shift`) or the **Send** button, executing `handleSendPrompt()`.
- **Frontend Output (`page.tsx`)**:
  - Message list rendered from `chatHistory` state (`sender: 'user' | 'agent'`).
  - Structured formatting via `renderFormattedText()`, handling markdown titles, nested bullet lists (`parseInlineMarkdown`), and syntax-highlighted code blocks with an interactive **Copy Code** button (`📋 COPY CODE`).
- **Backend Flow (`harness.routes.ts` & `harness.ts`)**:
  - Endpoint `POST /api/harness/run` delegates to `runPiAgent()`.
  - Spawns the CLI agent process, streaming JSON events (`turn_end`, `agent_end`).
  - Parses input/output token counts (`usage.inputTokens`, `usage.outputTokens`) and records process execution logs (`piProcessLogs`).

### 2.2 System Prompts & `AGENTS.md`
- **Kernel Prompts Architecture**:
  - Located in `Fabrica_kernel/system_prompts/` (e.g., `01_identity.md`, `02_laws.md`, `03_behaviors.md`, `04_infrastructure.md`, `05_capabilities.md`, `06_modes.md`, `07_app_guide.md`).
- **Tenant Prompt Overrides**:
  - Located at `workspaces/<tenant_id>/AGENTS.md`. Users can edit this file in the UI via the System Prompt Modal.
- **Assembly Engine (`loadKernelSystemPrompts`)**:
  - Merges all kernel markdown files, appends `AGENTS.md` directives, and dynamically injects **Realtime Harness Directives**:
    - Output Language setting
    - Autonomy Mode & Heartbeat Interval
    - Active Model selection
    - Active Backlogs & Review Queues
    - Suggestion Cards
  - Passed to the CLI agent via `--append-system-prompt`.

### 2.3 Skills Subsystem
- **Dual-Layer Resolution**:
  1. **Kernel Skills**: Static platform capabilities in `Fabrica_kernel/skills/`.
  2. **Workspace Skills**: User-defined custom skills in `workspaces/<tenant_id>/.pi/skills/`.
- **CLI Registration**: Passed dynamically as `--skill <directory_path>`.
- **UI Management (`SkillsAndExtensions.tsx`)**:
  - Frontmatter YAML parser (`parseSkillMd`) extracts metadata attributes (`what`, `when`, `why`, `triggers`, `inputs`, `outputs`) and markdown instructions.
  - Interactive file tree view (`buildFileTree`, `DirectoryTreeView`) allowing creation, editing, renaming, and deletion of skill files.

### 2.4 Extensions Subsystem (Integrations)
- **CLI Extension Registration**: Loads custom TypeScript/JavaScript extensions from `workspaces/<tenant_id>/.pi/extensions/` via CLI flag `--extension <path>`.
- **Integrations Catalog (`PRESET_INTEGRATION_CATEGORIES`)**:
  - **Storage & PM**: GitHub, Google Drive, Google Sheets, Notion, Jira, Linear.
  - **Messaging**: Telegram, Slack, Discord, WhatsApp.
  - **Customer Interaction**: Gmail, WhatsApp Client, Messenger, Discord Community, Instagram, Facebook.
  - **Automations**: n8n, Zapier.
  - **Business & Commerce**: Odoo, Shopify, Stripe.
  - **Creative & Voice**: Higgsfield, Blender, Twilio.
- **OAuth & Credentials Binding**: Integrates directly with authorization handlers in `frontend-next/components/harness/user-harness.ts` and modal drawers.

### 2.5 Context Progress Bar
- **Token Tracking**: Computes total input/output tokens used across active session history and attached context payload vs the 1,000,000 maximum context window (`1M TPB`).
- **Visual Display**: Situated in the Agent Chat header (`page.tsx`). Calculates ratio `percentUsed = (usedTokens / 1000000) * 100`.
- **Status Colors**:
  - `> 50% Remaining`: Green (`#10b981`) - Healthy Optimal Balance
  - `< 25% Remaining`: Orange (`#f59e0b`) - Low Quota Alert
  - `< 10% Remaining`: Red (`#ef4444`) - Critical Quota Notice

### 2.6 Model Switcher (Agent Section vs. Account & API Section)
- **Agent Section Switcher**:
  - Dynamic dropdown in chat header bound to `chatModel`.
  - Queries available models via `harnessApi.getPiModels()` (`listPiModels()`), grouping models by provider (Google AI Studio, OpenRouter, Anthropic Direct, Fabrica System Pool).
  - Persisted in local storage (`pb_chat_model`) and written to `harness.json`.
- **Account & API Section Switcher**:
  - Credentials and model billing manager window.
  - Manages API keys per provider (`geminiApiKey`, `openrouterApiKey`, `anthropicApiKey`).
  - Supports switching between **BYOK (Bring Your Own Key)** mode and **System Key Pool** allocation mode.

### 2.7 Sessions Subsystem (List, Add, Switcher, Delete)
- **File System Storage**: Encapsulated as JSON Lines files in `workspaces/<tenant_id>/.pi/agent/sessions/<sessionId>.jsonl`.
- **Sessions List**:
  - Backend `listPiSessions()` scans `.jsonl` logs, calculating `messageCount`, `tokensUsed`, `createdAt`, `updatedAt`, and turn history.
  - UI renders a dropdown/drawer list sorted by latest active sessions.
- **Add Session (`+ New Session`)**:
  - Calls `harnessApi.createPiSession(tenantId, name)`.
  - Backend `createPiSession()` writes initial `{ type: "session_start" }` header and returns a fresh `sessionId`.
- **Session Switcher**: Selecting a session updates `activeSessionId` and populates `chatHistory` with saved logs.
- **Delete Session**: Calls `harnessApi.deletePiSession(sessionId)`, unlinking the `.jsonl` log file.

### 2.8 Output Language Dropdown
- **Language Selector**: Header dropdown offering `EN` (English), `FR` (French), and `AR` (Arabic).
- **Sync Architecture**:
  - Executing `handleAgentLangChange()` sets state `agentLang`, saves to `localStorage.setItem('fabrica_agent_lang', lang)`, and dispatches `fabrica:agent-lang-change` across open tabs.
  - Calls `harnessApi.updateHarnessState({ agent_lang: lang, output_language: lang })` to update `harness.json`.
  - Enforces DOM direction (`dir="rtl"` for Arabic) and appends critical prompt directives: `[CRITICAL LANGUAGE DIRECTIVE: Write your entire response strictly and exclusively in <Language>.]`.

### 2.9 Web Search Toggle
- **Control State**: Toggle button in Agent header bound to `webSearchEnabled` (saved in `harness.json`).
- **API Dispatch**: Passed as `webSearchEnabled` parameter in `harnessApi.runHarnessAgent()`.
- **Agent Logic**: Instructs the CLI runner to enable live web search and search grounding tools when evaluating prompts.

### 2.10 Send / Stop Button
- **State Machine**:
  - **Idle State (`!isAgentRunning`)**: Button displays "SEND" (or prompt arrow), invoking `handleSendPrompt()`.
  - **Running State (`isAgentRunning`)**: Button switches to "STOP" (red square badge), invoking `harnessApi.stopAgent(tenantId, sessionId)`.
- **Backend Process Interruption**:
  - `stopPiAgent()` retrieves the running process from `activePiDaemons` and `activePiChildProcesses`, dispatching `SIGTERM` followed by `SIGKILL` to safely kill the daemon child process.

### 2.11 Suggestions Cards
- **Tag Extraction**:
  - Backend `parsePiJsonOutput()` scans agent output using regex `/\[SUGGEST:\s*([^\]|]+?)(?:\s*\|\s*([^\]]+?))?\]/gi` or parses JSON `suggestions` arrays.
  - Populates `suggestions` list returned to client and updates `harness.json`.
- **UI Cards Render**:
  - Displayed as interactive card chips below the chat input.
  - Clicking a suggestion populates `chatInput` and immediately triggers `handleSendPrompt()`.

### 2.12 Context Window & File Attachment
- **Context Inspection Panel**:
  - Displays loaded raw datasets (`rawDataList`), system components (`systemComponents`), active missions summary, and pending file imports (`pendingImports`).
- **Multi-File & Folder Ingestion**:
  - Supports drag-and-drop (`handleFileDrop`) and manual selection (`handleFileSelect`).
  - Recursive directory traversal via `traverseFileSystemEntry()` converts nested files into raw data or system component entities.
- **Extra Sources Attachment (`selectedExtraSources`)**:
  - Attaches outputs from Analytics, Deep Research, Brainstorming, and System Build missions into the prompt payload context.

### 2.13 Autonomy Dropdown
- **Autonomy Levels**:
  - `autonomous`: **DIRECTOR** (Full Auto - Heartbeat timer continuously evaluates context and advances missions).
  - `semi-autonomous`: **SEMI-AUTO** (Requires user confirmation before advancing execution phases).
  - `manual`: **WORKER** (Manual mode - Agent acts strictly upon explicit chat prompt requests).
- **Persistence**: Saved via `handleAutonomyChange()` to `harness.json` (`autonomy`).

### 2.14 Heartbeat Timer
- **Autonomous Pulse Loop**:
  - Managed via `useEffect` in `page.tsx` running when `isAutonomyOn` and `autonomyLevel === 'autonomous'`.
  - Configured by `autonomyInterval` (default: 20 seconds).
- **Execution Checklist**:
  1. Verifies API key/credit availability (`setHeartbeatStatus('no_key')`).
  2. Verifies workspace context exists (`setHeartbeatStatus('no_context')`).
  3. Formulates prompt `[AUTONOMOUS AGENT HEARTBEAT CYCLE]` summarizing active missions, pending missions, system components, pending file imports, and recent actions.
  4. Dispatches to `api.chatAgent()`. Parses `ACTION: ADVANCE_MISSION id="..." targetStatus="..."` to advance mission phases automatically and clear pending import queues.

### 2.15 Backlogs Subsystem
- **State & Storage**:
  - Maintained in `harnessData.backlog` / `harnessData.backlogs` within `harness.json`.
- **Backlog Drawer UI**:
  - Displays prioritized audit items, strategy backlog tasks, and system optimizations.
  - Filterable by priority (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Updated in real time via `harnessApi.updateHarnessState({ backlog })`.

### 2.16 Reviews Subsystem & QA State
- **State & Storage**:
  - Maintained in `harnessData.review` / `harnessData.review_queues` within `harness.json`.
- **QA Evaluation Matrix**:
  - Handled via `handleSaveQaState()` in `page.tsx`.
  - Appends assessment events into mission `workflow_history`.
  - Automatically updates mission phase classes (`DRAFT` -> `PLANNING` -> `EXECUTION` -> `DONE`) and updates `harness.json`.

---

## 3. Express API Routes Matrix

Located in `src/api/routes/harness.routes.ts`:

| Method | Endpoint | Description | Request Payload | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/harness/run` | Main execution entry point for agent prompts | `{ prompt, sessionId, model, customKey, agentLang, webSearchEnabled }` | `PiAgentResponse` |
| `GET` | `/api/harness/daemons` | Lists active daemon processes for tenant | Query: `?tenantId=...` | `{ ok: true, daemons: PiDaemonProcessInfo[] }` |
| `POST` | `/api/harness/stop` | Terminates active agent daemon child process | `{ sessionId? }` | `{ ok: boolean }` |
| `GET` | `/api/harness/sessions` | Retrieves session history list for tenant | Query: `?tenantId=...` | `{ ok: true, sessions: PiSessionItem[] }` |
| `POST` | `/api/harness/sessions/create` | Spawns a new session `.jsonl` log file | `{ name? }` | `{ ok: true, session: PiSessionItem }` |
| `POST` | `/api/harness/sessions/delete` | Deletes session file from storage | `{ sessionId: string }` | `{ ok: boolean }` |
| `GET` | `/api/harness/models` | Queries available LLM models list | None | `{ ok: true, models: PiModelItem[] }` |
| `GET` | `/api/harness/logs` | Returns process execution logs stream | Query: `?tenantId=...` | `{ ok: true, logs: PiProcessLogItem[] }` |
| `GET` | `/api/harness/config` | Returns tenant harness configuration | Query: `?tenantId=...` | `{ ok: true, config: HarnessConfig }` |
| `GET` | `/api/harness/state` | Reads realtime harness state | Query: `?tenantId=...` | `{ ok: true, harness: Record<string, any> }` |
| `POST` | `/api/harness/state` | Updates realtime harness state | `{ updates: Record<string, any> }` | `{ ok: true, harness: Record<string, any> }` |

---

## 4. Tenant File System Directory Structure

Tenant data is completely isolated within `workspaces/<tenant_id>/`:

```
workspaces/<tenant_id>/
├── harness.json                # Harness state (model, autonomy, language, backlog, review, suggestions)
├── tenant.json                 # Tenant identity, plan, settings, and unified audit logs
├── missions.json               # Active & historical mission blueprints
├── workspace.json              # File index mapping Sources, Deliverables, Actions, and Pendings
├── AGENTS.md                   # Custom user system prompt directives
└── .pi/                        # Agent runtime configuration
    ├── agent/                  # Provider credentials, model mappings, and session logs
    │   ├── auth.json           # User BYOK provider API keys
    │   ├── models.json         # Provider environment variable configurations
    │   └── sessions/           # Session turn logs (*.jsonl)
    ├── skills/                 # Workspace-specific custom skills
    └── extensions/             # Workspace-specific custom extension scripts
```

---

## 5. Environment Variables & API Key Mapping Reference Table

The harness synchronizes user BYOK credentials into `.pi/agent/auth.json` and dynamically assigns runtime environment variables when calling the `pi` CLI process:

| Provider Key | Primary Env Var | Secondary / Alias Env Var | Provider Identifier Prefix |
| :--- | :--- | :--- | :--- |
| **google** / **gemini** | `GEMINI_API_KEY` | `GOOGLE_GENERATIVE_AI_API_KEY` | `google/` |
| **openrouter** | `OPENROUTER_API_KEY` | - | `openrouter/` |
| **anthropic** | `ANTHROPIC_API_KEY` | - | `anthropic/` |
| **openai** | `OPENAI_API_KEY` | - | `openai/` |
| **mistral** | `MISTRAL_API_KEY` | - | `mistral/` |
| **groq** | `GROQ_API_KEY` | - | `groq/` |
| **deepseek** | `DEEPSEEK_API_KEY` | - | `deepseek/` |
| **xai** | `XAI_API_KEY` | - | `xai/` |
| **azure** | `AZURE_OPENAI_API_KEY` | - | `azure/` |
| **together** | `TOGETHER_API_KEY` | - | `together/` |
| **fireworks** | `FIREWORKS_API_KEY` | - | `fireworks/` |
| **perplexity** | `PERPLEXITY_API_KEY` | - | `perplexity/` |
