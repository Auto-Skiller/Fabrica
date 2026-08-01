# Harness & Agent Process Architecture (`harness_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for the Autonomous Harness, Pi Daemon Process Management, Skill Registry, and Agent Execution Subsystem.

---

## 1. Subsystem Overview & Execution Lifecycle

The Harness Subsystem acts as the continuous autonomous engine of the platform. It manages isolated background `pi` CLI agent daemon processes, handles recurring heartbeat cycles, routes AI prompts, manages skill files in `.pi/skills/`, and persists execution logs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Dashboard UI (page.tsx)                           │
│  - Autonomy Power Button (Glowing Green/Yellow Pulse)                       │
│  - Heartbeat Interval Dropdown (1m, 2m, 5m, 15m, 30m, 1h, 4h, 1D)          │
│  - Auto-Processing Indicator Signals (Green/Red LED)                       │
│  - Skills & Extensions Drawer (SkillsAndExtensions.tsx)                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP API Calls (frontend-next/components/harness/api.ts)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Harness Express API Routes                            │
│                      (src/api/routes/harness.routes.ts)                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Core Harness Engine                               │
│                          (src/core/harness.ts)                              │
│  - Active Daemon Process Map (activeDaemons: Map<tenantId, ChildProcess>)   │
│  - Environment & Exec Options Resolver (getPiExecutionOptions)             │
│  - Background Heartbeat Loop Engine                                          │
│  - Skill Manager (.pi/skills/ & .pi/extensions/)                           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ File System Persistence
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tenant Storage (workspaces/<tenant_id>/)                  │
│  ├── harness.json  (Daemon status, heartbeat interval, config, logs)        │
│  ├── .pi/skills/   (SKILL.md files & executable skill modules)              │
│  └── .pi/extensions/ (System tool extensions & MCP modules)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/components/harness/` and `frontend-next/app/dashboard/`:

### A. Data Types & Interfaces (`frontend-next/components/harness/types.ts`)

- **`PiModel`**: Available AI model definition (`id`, `name`, `provider`, `contextWindow`, `description`).
- **`PiDaemonState`**: Current state of background agent process:
  - `status: 'idle' | 'running' | 'paused' | 'error' | 'stopped'`
  - `pid?: number`: Operating system Process ID of background `pi` process.
  - `autonomyEnabled: boolean`: Whether automatic background cycles are toggled on.
  - `heartbeatInterval: string`: Active interval duration (`1m`, `2m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1D`).
  - `lastHeartbeatAt?: string`: Timestamp of last automated execution.
  - `nextHeartbeatAt?: string`: Projected timestamp for next trigger.
  - `activeTasksCount: number`: Number of concurrently running prompts.
  - `currentTask?: string`: Description of task currently processing.
- **`HarnessExecutionConfig`**:
  - `model: string`: Selected model identifier (e.g., `gemini-2.5-flash`).
  - `provider: string`: AI Provider (`google`, `anthropic`, `openai`, `deepseek`).
  - `temperature: number`: Sampling temperature (0.0 to 1.0).
  - `maxTokens: number`: Output token boundary.
  - `systemPrompt?: string`: Active system instructions override.
  - `cliFlags: string[]`: Array of extra flags passed to `pi` process.
- **`HarnessSession`**:
  - `sessionId: string`: Unique session identifier.
  - `startedAt: string`: ISO timestamp.
  - `status: string`: Session state.
  - `promptCount: number`: Total user/agent messages in session.
- **`HarnessLogEntry`**:
  - `id: string`: Unique log entry ID.
  - `timestamp: string`: ISO 8601 timestamp.
  - `level: 'info' | 'warn' | 'error' | 'debug' | 'agent'`: Severity level.
  - `message: string`: Text output or stdout/stderr stream from agent process.
  - `source?: string`: Subsystem origin (`daemon`, `cli`, `heartbeat`).
- **`SkillsAndExtensionsProps`**: Modal/Drawer interface props for Skill management.

### B. Model Registry (`frontend-next/components/harness/pi-models.ts`)

- **`PI_MODELS` Array**:
  - Includes Google Gemini 2.5 Flash / Pro, Anthropic Claude 3.5 Sonnet, OpenAI GPT-4o, and DeepSeek R1.
- **`DEFAULT_HARNESS_CONFIG`**: Default options preset (`model: 'gemini-2.5-flash'`, `provider: 'google'`, `temperature: 0.7`, `maxTokens: 4096`).

### C. Client API Wrapper (`frontend-next/components/harness/api.ts`)

- **`harnessApi` Methods**:
  - `getStatus()`: `GET /api/harness/status` — Retrieves real-time daemon status & state.
  - `startDaemon(config)`: `POST /api/harness/start` — Boots background daemon process.
  - `stopDaemon()`: `POST /api/harness/stop` — Safely sends SIGTERM/SIGKILL to daemon.
  - `restartDaemon()`: `POST /api/harness/restart` — Reboots daemon process.
  - `execPrompt(prompt, extraFlags)`: `POST /api/harness/exec` — Dispatches prompt for execution.
  - `updateConfig(updates)`: `POST /api/harness/config` — Updates `harness.json` configuration.
  - `getLogs()`: `GET /api/harness/logs` — Fetches process execution logs.
  - `clearLogs()`: `POST /api/harness/logs/clear` — Clears stored log history.
  - `listSkills()`: `GET /api/harness/skills` — Returns array of skills in `.pi/skills/`.
  - `installSkill(name, content)`: `POST /api/harness/skills/install` — Writes `SKILL.md` file.
  - `uninstallSkill(name)`: `POST /api/harness/skills/uninstall` — Deletes skill directory.

### D. Skill Manager UI (`frontend-next/components/harness/SkillsAndExtensions.tsx`)

- Renders a dual-tabbed panel for **Skills** and **Extensions**.
- Reads skills directly from `.pi/skills/` via `harnessApi.listSkills()`.
- Supports inline markdown editing of `SKILL.md` files.
- Includes quick-search filtering, creation modal, and active enablement toggle switches.

### E. Dashboard Header Integration (`frontend-next/app/dashboard/page.tsx`)

- **Autonomy Button**:
  - Displays glowing green-yellow pulse effect when active (`autonomyEnabled: true`).
  - Includes dual LED status indicators: Green (Processing Active) and Red (Error / Stopped).
  - Toggles daemon state via `harnessApi.startDaemon()` / `harnessApi.stopDaemon()`.
- **Heartbeat Interval Select**:
  - Positioned adjacent to the autonomy button.
  - Options: `1 min`, `2 min`, `5 min`, `15 min`, `30 min`, `1 h`, `4 h`, `1 D`.
  - Persists changes instantly to backend via `harnessApi.updateConfig({ heartbeatInterval })`.

---

## 3. Routes Architecture (`routes_arch`)

Located in `src/api/routes/harness.routes.ts`:

| Method | Endpoint | Description | Request Payload | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/harness/status` | Fetches active daemon status & stats | Query: `?tenantId=...` | `{ ok: true, state: PiDaemonState }` |
| `POST` | `/api/harness/start` | Boots background daemon process | `{ config: HarnessConfig }` | `{ ok: true, state: PiDaemonState }` |
| `POST` | `/api/harness/stop` | Terminates daemon child process | `{} ` | `{ ok: true, state: PiDaemonState }` |
| `POST` | `/api/harness/restart` | Reboots daemon child process | `{ config?: HarnessConfig }` | `{ ok: true, state: PiDaemonState }` |
| `POST` | `/api/harness/exec` | Executes single agent prompt | `{ prompt: string, flags?: string[] }` | `{ ok: true, result: ExecutionResult }` |
| `POST` | `/api/harness/config` | Updates harness configuration | `{ heartbeatInterval?, model?, ... }` | `{ ok: true, config: HarnessConfig }` |
| `GET` | `/api/harness/logs` | Returns stdout/stderr log stream | Query: `?tenantId=...` | `{ ok: true, logs: HarnessLogEntry[] }` |
| `POST` | `/api/harness/logs/clear` | Clears all log entries | `{} ` | `{ ok: true }` |
| `GET` | `/api/harness/skills` | Lists all skills in `.pi/skills/` | Query: `?tenantId=...` | `{ ok: true, skills: SkillItem[] }` |
| `POST` | `/api/harness/skills/install` | Creates or updates skill directory | `{ name: string, content: string }` | `{ ok: true, skill: SkillItem }` |
| `POST` | `/api/harness/skills/uninstall` | Removes skill directory from disk | `{ name: string }` | `{ ok: true }` |

---

## 4. Core Architecture (`core_arch`)

Located in `src/core/harness.ts`:

### A. Core Memory State & Process Registry

```typescript
// In-memory mapping of active daemon processes indexed by tenant ID
const activeDaemons = new Map<string, {
  process: ChildProcess | null;
  timer: NodeJS.Timeout | null;
  state: PiDaemonState;
  config: HarnessConfig;
}>();
```

### B. Helper & Lifecycle Functions

- **`getPiExecutionOptions(tenantId)`**:
  - Resolves workspace root: `workspaces/<tenant_id>/`.
  - Ensures required directories (`.pi/skills/`, `.pi/extensions/`) exist.
  - Constructs environment variables (`GEMINI_API_KEY`, `PATH`, workspace `CWD`).
  - Assembles CLI flags (`--workspace`, `--skills-dir`).
- **`ensureUserHarness(tenantId)`**:
  - Guarantees `harness.json` exists in `workspaces/<tenant_id>/`.
  - Creates `.pi/skills/` and `.pi/extensions/` directories if not present.
- **`getHarnessState(tenantId)`**: Reads `harness.json` and parses runtime state.
- **`saveHarnessState(tenantId, state, config, logs)`**: Atomically writes updated state to `harness.json`.
- **`startPiDaemon(tenantId, config)`**:
  - Checks if daemon already running for tenant.
  - Initializes background heartbeat timer based on `config.heartbeatInterval` (`parseIntervalMs`).
  - Spawns background process or handles scheduled trigger execution.
  - Updates `state.status = 'running'` and `state.autonomyEnabled = true`.
- **`stopPiDaemon(tenantId)`**:
  - Clears heartbeat timer (`clearInterval`).
  - Kills active child process (`process.kill('SIGTERM')`).
  - Sets `state.status = 'stopped'` and `state.autonomyEnabled = false`.
- **`executeHarnessTask(tenantId, prompt, flags)`**:
  - Executes isolated command via `child_process.exec` using `pi` executable.
  - Captures `stdout` and `stderr` streams.
  - Appends execution log entry to `harness.json`.
  - Returns `ExecutionResult` object (`{ success, stdout, stderr, exitCode, executionTimeMs }`).
- **`getAvailableSkills(tenantId)`**:
  - Reads directories under `workspaces/<tenant_id>/.pi/skills/`.
  - Parses `SKILL.md` frontmatter metadata (name, description, triggers).
  - Returns array of installed skills.
- **`installSkill(tenantId, name, content)`**:
  - Creates folder `workspaces/<tenant_id>/.pi/skills/<name>/`.
  - Writes `SKILL.md` file with specified markdown content.
- **`uninstallSkill(tenantId, name)`**: Recursively deletes `workspaces/<tenant_id>/.pi/skills/<name>/`.

---

## 5. User Tenant Persistence Architecture (`user_arch`)

Located in `workspaces/<tenant_id>/`:

### A. Configuration & State File: `harness.json`

```json
{
  "tenantId": "default_user",
  "state": {
    "status": "running",
    "pid": 48210,
    "autonomyEnabled": true,
    "heartbeatInterval": "5m",
    "lastHeartbeatAt": "2026-08-01T16:10:00.000Z",
    "nextHeartbeatAt": "2026-08-01T16:15:00.000Z",
    "activeTasksCount": 0
  },
  "config": {
    "model": "gemini-2.5-flash",
    "provider": "google",
    "temperature": 0.7,
    "maxTokens": 4096,
    "heartbeatInterval": "5m",
    "cliFlags": ["--verbose"]
  },
  "logs": [
    {
      "id": "log_1772467800000_1a",
      "timestamp": "2026-08-01T16:10:00.000Z",
      "level": "info",
      "message": "Heartbeat cycle completed. 0 backlog items pending.",
      "source": "heartbeat"
    }
  ]
}
```

### B. Directory Hierarchy Under Tenant Root:

```
workspaces/<tenant_id>/
├── harness.json                # Harness state, config, and logs
└── .pi/                        # Agent configuration folder
    ├── skills/                 # User skills directory
    │   ├── web_search/
    │   │   └── SKILL.md
    │   └── data_extraction/
    │       └── SKILL.md
    └── extensions/             # User extensions directory
        ├── custom_tool.ts
        └── mcp_config.json
```
