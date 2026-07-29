# Webapp UI & Agent Interaction Protocol Architecture

This document provides a comprehensive blueprint of all UI components, backend interaction protocols, process execution engines, storage mirrors, and background runners across the application.

---

## 🏛️ Comprehensive Interaction Protocol Architecture

Every interaction in the web application routes through one of eight execution protocols, connecting the Next.js frontend, Express backend, Pi CLI agent runner daemon, Node.js VM sandbox, disk state mirrors, and external provider APIs.

| Protocol Category | Protocol Identifier | Execution Engine & Routing Mechanism | Underlying Execution Model |
| :--- | :--- | :--- | :--- |
| **Agent Protocol 1** | **Primary Chat & Prompting (`pi <prompt>`)** | User messages, heartbeat pulses, research tasks, backlog goals, context distillations, and feature validations route via `POST /api/agent/chat` -> `runPiAgent()`. | Submits directly into the active **interactive daemon `pi` CLI binary process** (`PiDaemonProcess`). State & token history persist continuously in `.pi/sessions/<id>.json`. |
| **Agent Protocol 2** | **In-Session Slash Commands (`/command`)** | Slash commands (`/clear`, `/compact`, `/help`, `/stats`, `/models`, `/skills`, `/system`, `/reload`, `/export`, etc.) sent directly into the active agent session. | Executed directly within the active **interactive daemon `pi` CLI binary process** via `runPiAgent()`, hot-reloading extensions, altering prompt options, or compacting turn state. |
| **Agent Protocol 3** | **Direct Pi CLI Process Control (`pi <flags>`)** | **Strictly reserved** for process lifecycle management: starting/resuming daemon processes, ending/killing processes (`POST /api/pi/cli-stop`), and live stdout/stderr stream monitoring (`GET /api/pi/cli-logs`). | Manages process lifecycle (`PiDaemonProcess.kill()`), monitors process PIDs, and streams live terminal logs. |
| **Sandbox Protocol 4** | **Secure VM Code Execution (`vm_eval`)** | Exposed as an **Agent Extension Tool** (`Fabrica_kernel/extensions/vm_eval_tool.js`) to the `pi` CLI daemon. Executes JS/TS logic in isolated V8 context via `executeSandboxedCode()`. | Isolated Node.js `vm.Context` with frozen prototypes, disabled process/network bindings, and strict CPU execution timeouts (1000ms). |
| **System Protocol 5** | **Preset System & Harness Execution (`/api/command`)** | Server endpoints are strictly limited to **preset administrative tasks** (`restart_daemon`, daemon management, structured file CRUD). | **Arbitrary shell execution is completely blocked for users** and strictly reserved for the AI agent via its native `bash` tool inside `pi`. |
| **Storage Protocol 6** | **UI / Disk Persistence (JSON & Workspace Files)** | Read/Write operations for workspace directives (`AGENTS.md`), system components (`projects/systems/`), and state mirrors (`db/*.json`). | Synchronous and asynchronous file operations (`fs.promises`, `fs.writeFileSync`) updating tenant workspaces (`workspaces/<tenantId>/`). |
| **Realtime Protocol 7** | **Realtime Server-Sent Events (SSE Stream)** | Continuous server-to-browser push stream via `GET /events`. | Express EventSource response stream broadcasting JSON events for system timelines, agent pulses, file changes, and background tasks. |
| **Provider Protocol 8** | **Multi-Key LLM Key Pool Load Balancer** | API key round-robin load balancing and transparent failover (`/api/llm/key-pool/*`). | Manages multi-key quota rotation and rate-limit recovery across configured LLM keys, injecting keys dynamically into spawned `pi` daemon processes. |

---

## 🔗 Deep Technical Relations: VM Sandbox, Direct Shell, Disk Persistence & Pi CLI Daemon

Understanding how the application components collaborate requires inspecting the four primary computational surfaces:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FRONTEND UI DASHBOARD                                  │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS BACKEND SERVER (server.ts)                        │
└─────┬─────────────────────────┬───────────────────────────┬───────────────────────┬────┘
      │                         │                           │                       │
      │ (1) Chat / Slash Cmds   │ (2) Process Mgmt          │ (3) Code Eval         │ (4) Build / Test
      ▼                         ▼                           ▼                       ▼
┌───────────┐           ┌──────────────────┐        ┌──────────────┐        ┌───────────────┐
│ Interactive│           │ Direct Process   │        │ Secure VM    │        │ Direct Shell  │
│ Pi CLI    │◄──────────┤ Control Engine   │        │ Sandbox      │        │ & Harness     │
│ Daemon    │           │ (cli-stop/logs)  │        │ (vm.Script)  │        │ (execSync)    │
└─────┬─────┘           └──────────────────┘        └──────┬───────┘        └───────┬───────┘
      │                                                    │                        │
      │ Read Directives & Mutate Workspace                 │ No Disk Access         │ Read/Build Workspace
      ▼                                                    ▼                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      DISK PERSISTENCE & WORKSPACE FILESYSTEM                           │
│  - System Directives: workspaces/<tenantId>/AGENTS.md                                  │
│  - Session Transcripts: workspaces/<tenantId>/.pi/sessions/<sessionId>.json           │
│  - Application Source Code & System Components: projects/systems/                      │
│  - Runtime State & Mission Matrix: db/missions.json, db/runtime.json                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Inter-Relationship Breakdown

1. **`pi` CLI Binary Process <──> UI / Disk Persistence**:
   - The interactive daemon `pi` CLI binary process acts as the **Primary Autonomous Reasoning Engine**.
   - **Inputs from Disk**: At launch, the `pi` daemon process reads workspace directives from `workspaces/<tenantId>/AGENTS.md` and loads session history from `workspaces/<tenantId>/.pi/sessions/<sessionId>.json`.
   - **Outputs to Disk**: As the `pi` daemon reasons and executes tool calls, it directly writes/edits codebase files (`projects/systems/`), mutates mission states in `db/missions.json`, and records session turns into `.pi/sessions/<sessionId>.json`.

2. **Secure VM Code Execution (`vm_eval`) <──> `pi` CLI & Disk Persistence**:
   - The VM Sandbox (`src/execution/sandbox.ts`) is designed for **Zero-Side-Effect Safety** and exposed as an **Agent Extension Tool** (`Fabrica_kernel/extensions/vm_eval_tool.js`).
   - The interactive `pi` agent uses the `vm_eval` tool to evaluate untrusted or pure algorithmic JS/TS logic (e.g. data transformers, mathematical models, regex validators) in a memory-isolated V8 sandbox with `process: undefined` and disabled network/filesystem bindings.
   - **Relation**: The user cannot trigger arbitrary VM code directly from the UI; the AI agent uses `vm_eval` to safely verify logic before committing changes to disk persistence (`projects/systems/`).

3. **Preset System & Harness Execution <──> `pi` CLI & Disk Persistence**:
   - Server endpoints (`/api/command`) enforce strict **preset administrative execution** (`restart_daemon`, daemon management, structured file CRUD). Arbitrary shell execution is completely disabled for users.
   - **Relation with `pi` CLI**: Arbitrary shell execution on the host OS is strictly reserved for the AI agent via its native `bash` tool inside the `pi` CLI daemon process. When the `pi` CLI daemon modifies source code, it uses its `bash` tool to run builds or tests to verify compile-time safety.

4. **Direct Pi CLI Process Control <──> Interactive `pi` CLI Daemon**:
   - Direct Pi CLI Process Control endpoints (`/api/pi/cli-exec`, `/api/pi/cli-stop`, `/api/pi/cli-logs`, `/api/pi/sessions`) operate as the **Process Monitor & Operations Layer**.
   - It maintains process references in `activePiDaemons`, streams live stdout/stderr log buffers to the UI terminal, and responds to manual user termination signals (`/api/pi/cli-stop`).

---

## 🧩 Complete Catalog of UI Interactions & Process Execution Flows

### 1. Primary Chat & Prompting (`pi <prompt>`)

#### 1.1 Main Chat Input Bar
- **UI Component**: Fixed bottom chat container in the central panel.
- **Trigger**: Pressing `Enter` or clicking the `Send (↵)` button.
- **Handler**: `handleSendChat()` -> `api.chatAgent()`.
- **Backend Flow**: Calls `POST /api/agent/chat` with `prompt`, `history`, `model`, `agentLang`, `sessionId`, and `tenantKey`.
- **Process Model**: `runPiAgent()` resolves active workspace directory (`workspaces/<tenantId>/`), retrieves or starts the active interactive daemon `pi` CLI process (`PiDaemonProcess`), injects `AGENTS.md` system directives, and submits the prompt into the daemon session.
- **Response**: Streams incremental markdown text chunks into the active UI chat list and records token metrics.

#### 1.2 Autonomous Heartbeat Cycle Engine
- **UI Component**: Top-right Autonomy Switcher set to `FULL AUTO` (Director mode) + 15s pulse runner (`useInterval`).
- **Trigger**: Automatic 15-second background timer tick when workspace context and API keys are present.
- **Handler**: `runHeartbeat()` in `frontend-next/app/dashboard/page.tsx`.
- **Backend Flow**: Formats a structured `[AUTONOMOUS AGENT HEARTBEAT CYCLE]` prompt and calls `api.chatAgent()`.
- **Process Model**: Submits into the interactive daemon `pi` CLI process. The agent inspects active mission stages in `db/missions.json`, identifies unblocked tasks, generates or updates code files, and appends the heartbeats and actions into the active Pi session transcript.

#### 1.3 Strategic Backlog Goal Execution
- **UI Component**: "Execute Goal" button inside Strategic Backlog detail cards.
- **Trigger**: User click on `⚡ Execute Goal`.
- **Handler**: Constructs prompt: `Please execute this strategic goal from our backlog: "<title>" - Description: "<desc>"` -> `handleSendChat()`.
- **Process Model**: Submits directly into the active daemon `pi` CLI session, which converts the strategic goal into concrete implementation tasks.

#### 1.4 Deep Research Assistant
- **UI Component**: `🔍 Auto Deep Research` panel button.
- **Trigger**: Submitting topic in the Deep Research modal.
- **Handler**: `handleDeepResearch()` -> `handleSendChat()`.
- **Backend Flow**: Passes prompt: `🔍 [DEEP RESEARCH INITIATED] ... Topic: "<query>"`.
- **Process Model**: Triggers Google Search grounding in the active `pi` daemon session, cross-examines facts, crawls references, and outputs a structured research report with citations into the chat.

#### 1.5 Context Distillation & User Signal Processing
- **UI Component**: `📄 Context` Tab -> `Distill Interview / Signal` button.
- **Trigger**: User click after entering user interview text or feedback signals.
- **Handler**: `api.distillContext()` -> `api.chatAgent()`.
- **Backend Flow**: Formats `📋 [CONTEXT DISTILLATION REQUEST]` prompt -> `POST /api/agent/chat`.
- **Process Model**: The interactive daemon `pi` CLI process synthesizes raw inputs into structured specification cards and saves them into workspace context.

#### 1.6 Product Roadmap & Discovery Feature Validation
- **UI Component**: `🎯 Discovery` / Roadmap board -> `Validate Feature` button.
- **Trigger**: Click on feature card validation button.
- **Handler**: `api.validateDiscovery()` -> `api.chatAgent()`.
- **Backend Flow**: Formats `🎯 [ROADMAP VALIDATION REQUEST]` prompt -> `POST /api/agent/chat`.
- **Process Model**: The `pi` daemon process validates feature technical requirements, checks compatibility with existing system components, and returns actionable build steps.

---

### 2. In-Session Slash Commands (`/command` inside `pi`)

#### 2.1 `/commands` Quick Dropdown Menu
- **UI Component**: `⚡ /commands` button in the chat toolbar.
- **Trigger**: User click on button or typing `/` in the input field.
- **Popup Logic**: Computes fixed viewport coordinates (`commandsMenuCoords`) to render a z-indexed popup above the input bar.
- **Available Commands & Actions**:
  - `/help` -> Submits `/help` command to print Pi CLI usage and options.
  - `/clear` -> Triggers session reset, clearing message history while maintaining workspace identity.
  - `/compact` -> Requests session token compaction to prune older turn histories.
  - `/stats` -> Queries and renders real-time token consumption breakdown.
  - `/models` -> Queries backend model registry (`GET /api/pi/models`) and displays active LLM options.
  - `/model <name>` -> Switches active session LLM model (e.g. `gemini-2.5-flash`, `claude-3-5-sonnet`).
  - `/skills` -> Lists active Fabrica kernel skills (`projects/systems/skills/`).
  - `/extensions` -> Displays active system prompt extensions and system hooks.
  - `/system` -> Inspects loaded `AGENTS.md` system directives and constraints.
  - `/reload` -> Hot-reloads system directives, skills, and extensions without restarting the process.
  - `/sessions` -> Opens session selector listing all workspace Pi CLI sessions on disk.
  - `/web` -> Toggles real-time web search grounding mode on or off.
  - `/export` -> Exports full execution transcript and conversation logs as a downloadable file.
  - `/stop` -> Calls `api.stopCliProcess()` to immediately kill running Pi CLI child processes.

---

### 3. Direct Pi CLI Process Control (`pi <flags/subcommands>`)

#### 3.1 Session Selector & Workspace Session Switcher
- **UI Component**: Top bar `🗂️ Sessions` selector.
- **Trigger**: Selecting a session or clicking `+ New Session`.
- **Handler**: `api.getPiSessions()`, `api.createPiSession()`, `api.deletePiSession()`.
- **Backend Flow**: Reads, creates, or deletes `.json` session files in `workspaces/<tenantId>/.pi/sessions/`.

#### 3.2 Context Window Usage Meter
- **UI Component**: Progress bar widget in the chat control bar (`Context Window %`).
- **Trigger**: Polling interval and post-chat update hook.
- **Handler**: `api.getPiContext()`.
- **Backend Flow**: `GET /api/pi/context` inspects active `.pi/sessions/<sessionId>.json` file on disk, sums message tokens, and calculates percentage against model maximum (e.g., 1,000,000 tokens for Gemini models).

#### 3.3 Raw Pi CLI Process Terminal & Debugger (Strict Process Control Only)
- **UI Component**: Debug Console Modal / Live Terminal panel.
- **Trigger**: User click on `📟 CLI Logs` or executing manual process management commands.
- **Handler**: `api.execPiCli()`, `api.getPiCliLogs()`, `api.stopCliProcess()`.
- **Backend Flow**:
  - `POST /api/pi/cli-exec`: Connects to or resumes the interactive `pi` CLI daemon process (`PiDaemonProcess`).
  - `POST /api/pi/cli-stop`: Sends `SIGTERM` / `SIGKILL` to stop the interactive `pi` CLI daemon process PID (`stopPiAgent()`).
  - `GET /api/pi/cli-logs`: Retrieves live child process execution logs from `getPiProcessLogs()`.

---

### 4. Secure Node.js VM Sandbox Execution (`vm.Script`)

#### 4.1 Custom Code Execution & System Testing
- **UI Component**: `⚙️ Systems` panel -> `Run Sandbox Test` button.
- **Trigger**: Executing dynamic JS/TS code blocks generated by user or agent.
- **Handler**: `api.executeSandboxedCode()` -> `POST /api/sandbox/execute`.
- **Backend Flow**:
  - Receives code string and context variables.
  - Wraps execution inside `executeSandboxedCode()` (`src/execution/sandbox.ts`).
  - Uses Node.js `vm.createContext()` with frozen prototype globals (`process: undefined`, `require: undefined`).
  - Enforces strict CPU execution timeout (default: 1000ms) to prevent infinite loop DoS attacks.
- **Response**: Returns execution output, console logs array, execution time in ms, and sanitized errors.

---

### 5. System Shell Command Executor (`/api/command`)

#### 5.1 Workspace Build & Harness Test Execution
- **UI Component**: Developer Tools / Harness Configuration Panel.
- **Trigger**: Clicking `Run Build`, `Run Lint`, or `Execute System Command`.
- **Handler**: Calls `POST /api/command` with `{ command: "npm run build" }`.
- **Backend Flow**: Executes command via Node.js `execSync` / `exec` in workspace CWD, returning exit code, stdout, and stderr.

---

### 6. UI / Disk Persistence (JSON Mirroring & Workspace Files)

#### 6.1 Workspace System Directives Editor (`AGENTS.md`)
- **UI Component**: `📄 Context` Tab -> `AGENTS.md` Directives Live Code Mirror.
- **Trigger**: Editing text and clicking `Save Directives`.
- **Handler**: `api.getAgentsMd()`, `api.saveAgentsMd()`.
- **Backend Flow**: `GET / POST /api/user/:tenantId/agents-md` reads or writes `workspaces/<tenantId>/AGENTS.md`. Automatically loaded into interactive `pi` daemon process instances.

#### 6.2 System Components & Toolboxes File Explorer
- **UI Component**: `⚙️ Systems` & `🧰 Toolboxes` file tree and code editor.
- **Trigger**: Creating, editing, renaming, or deleting files in toolboxes/skills.
- **Handler**: `api.getToolboxFiles()`, `api.mutateToolboxFile()`, `api.auditToolboxFiles()`.
- **Backend Flow**: Operates directly on disk files located in `projects/<project>/systems/` and `projects/<project>/toolboxes/`.

#### 6.3 Strategic Mission Matrix & Autonomy State Mirror
- **UI Component**: `🎯 Missions` Board & Autonomy Switcher (`FULL AUTO`, `SEMI-AUTO`, `SUPERVISED`).
- **Trigger**: Dragging mission cards across columns or toggling autonomy mode.
- **Handler**: `POST /api/db/missions`, `POST /api/user/:tenantId/db/runtime`.
- **Backend Flow**: Updates `db/missions.json` and `db/runtime.json` on disk, broadcasting state changes via Server-Sent Events.

---

### 7. Realtime Server-Sent Events (SSE Stream)

#### 7.1 Live System Activity Feed & Timeline Ticker
- **UI Component**: Footer event ticker and Activity Log modal.
- **Trigger**: Permanent SSE connection opened on dashboard load (`new EventSource("/events")`).
- **Backend Flow**: `GET /events` maintains active HTTP response connection. Whenever server tasks finish, heartbeats pulse, or files mutate, `sendSSEEvent()` pushes JSON payloads to all connected clients.

---

### 8. Multi-Key LLM Provider Pool Load Balancer

#### 8.1 Multi-Key API Key Load Balancer (`keyPoolManager`)
- **UI Component**: Header key status badge & Account Modal (`🔑 API Key Pool`).
- **Trigger**: Modal open, key addition, or automatic key rotation upon rate-limiting (429 / quota exhaustion).
- **Handler**: `GET /api/llm/key-pool/stats`, `POST /api/llm/key-pool/add-key`.
- **Execution Mechanism**:
  - **Custom Express Endpoints**: Manage pool statistics and key registration via `keyPoolManager` (`src/db/llm_key_pool.ts`).
  - **`pi` Daemon Process Injection**: During `runPiAgent()`, `pi_runner.ts` queries `keyPoolManager.acquireKey()`. The acquired API key is passed as an environment variable (`GEMINI_API_KEY` or `OPENROUTER_API_KEY`) to the active `pi` CLI daemon process. If a 429 rate limit is returned by `pi`, `pi_runner.ts` marks the key rate-limited for 60 seconds and transparently re-spawns the daemon with the next available key in the pool.

---

## 🔄 Sequence Diagram: User Prompt -> Interactive Pi CLI Daemon -> Disk State

```
[ User UI Chat Bar ] 
        │
        │ 1. Submits Prompt / Slash Command
        ▼
[ Next.js API Route / Client ]
        │
        │ 2. POST /api/agent/chat { prompt, sessionId, tenantId }
        ▼
[ Express Server (server.ts) ]
        │
        │ 3. Invokes runPiAgent() in src/pi_runner.ts
        ▼
[ Pi Runner Engine ]
        │
        ├─► Retrieves or Starts Active Daemon Process (PiDaemonProcess)
        ├─► Reads System Directives: workspaces/<tenantId>/AGENTS.md
        ├─► Reads Session History: .pi/sessions/<sessionId>.json
        │
        │ 4. Feeds Prompt into Interactive Daemon: PiDaemonProcess.sendPrompt()
        ▼
[ Interactive Daemon Pi CLI Binary Process ]
        │
        ├─► Executes Web Grounding / Workspace File Operations / Tool Calling
        ├─► Updates Session State: .pi/sessions/<sessionId>.json
        │
        │ 5. Returns Stdout Text Stream & Token Metadata
        ▼
[ Express Server ]
        │
        ├─► Broadcasts SSE Event to /events
        │ 6. Returns JSON Response { ok: true, text, tokens }
        ▼
[ User UI Chat Bar ] ──► Renders Incremental Response & Updates Context Window Meter
```

---

## 🎯 Summary of Architecture Principles

1. **Daemon Interactive Execution**: All Primary Chat, Heartbeats, Deep Research, Backlog Goals, Context Distillations, Roadmap Validations, and In-Session Slash Commands route into the long-running interactive daemon `pi` CLI binary process (`PiDaemonProcess`).
2. **Dedicated Direct Process Control**: Direct Pi CLI Process Control endpoints (`cli-exec`, `cli-stop`, `cli-logs`) are kept strictly for starting, ending/killing, and live-streaming standard output/logs from the interactive daemon process.
3. **Session Continuity**: Session context is maintained deterministically on disk in `.pi/sessions/<sessionId>.json`.
4. **Sandboxed Safety vs Direct Execution**: Code evaluation is isolated inside Node.js VM contexts (`executeSandboxedCode()`) for zero side effects, while system shell builds (`/api/command`) operate on the real workspace environment.
5. **Real-time Observability**: System activities and background runner events stream continuously to the UI via Server-Sent Events (`/events`).
