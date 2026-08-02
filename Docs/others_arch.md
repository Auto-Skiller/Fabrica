# System Runtime, V8 VM Sandbox & Utility Architecture (`others_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for the Node.js Express Server Setup, V8 VM Execution Sandbox (`vm_sandbox.ts`), Global Utility Functions (`utils.ts`), and Next.js Root Layout / Dashboard Components.

---

## 1. Subsystem Overview & Infrastructure Topology

This subsystem manages entry points, isolated V8 JavaScript execution sandboxes, atomic YAML file persistence, and top-level UI application layouts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Next.js Dashboard UI                              │
│                (app/layout.tsx & app/dashboard/page.tsx)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Requests / API Invocation
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Express HTTP Server (src/server.ts)                     │
│  - Port 3000 Binding                                                        │
│  - Middleware: CORS, express.json(), authMiddleware                         │
│  - Routes: /api/auth, /api/harness, /api/missions, /api/tenant, /api/workspace│
│  - Health Check Endpoint (GET /health)                                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
┌──────────────────────────────────────┐┌──────────────────────────────────────┐
│       V8 VM Sandbox Execution        ││      System Utilities Engine         │
│       (src/core/vm_sandbox.ts)       ││            (src/utils.ts)            │
│  - Frozen Prototype Context          ││  - Atomic Temp File Writes (.tmp_)   │
│  - Disabled Process/Network Globals  ││  - Smart Freshness Sync (YAML)       │
│  - Strict Execution Timeout (1000ms) ││  - Toolbox Path Resolvers             │
└──────────────────────────────────────┘└──────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/app/`:

### A. Root Layout (`frontend-next/app/layout.tsx`)

- **Font Configuration**: Configures custom display, body, and monospace font families.
- **Global CSS**: Imports `@import "tailwindcss";` and defines root theme variables (`--bg`, `--surface`, `--accent`, `--text`, `--mono`).
- **Structure**: Wraps child pages inside HTML document body with theme attributes.

### B. Dashboard View (`frontend-next/app/dashboard/page.tsx`)

- **Header Toolbar**:
  - **Autonomy Toggle Button**: Pulsing green/yellow animation indicating daemon status.
  - **Heartbeat Interval Selector**: Adjacent dropdown with options `1 min`, `2 min`, `5 min`, `15 min`, `30 min`, `1 h`, `4 h`, `1 D`.
  - **Live Processing LED Signals**: Dual green/red indicator dots reflecting real-time agent activity.
  - **Skills & Integrations Button**: Opens skill drawer.
  - **Context Button**: Opens workspace instructions context drawer.
- **Navigation Tabs**: Switch between Overview, Missions, Dependency Graph, File Explorer, and System Health panels.
- **Real-Time Polling Engine**: Runs background periodic polling (`useEffect`) to refresh daemon state, telemetry, and pending items.

---

## 3. Server & Routes Architecture (`routes_arch`)

Located in `src/server.ts`:

### A. Express Server Configuration

```typescript
import express from 'express';
import cors from 'cors';
import authRoutes from './api/routes/auth.routes.js';
import harnessRoutes from './api/routes/harness.routes.js';
import missionsRoutes from './api/routes/missions.routes.js';
import tenantRoutes from './api/routes/tenant.routes.js';
import workspaceRoutes from './api/routes/workspace.routes.js';
import { authMiddleware } from './api/middlewares/auth.middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Global Authentication & Tenant Middleware
app.use(authMiddleware);

// Router Mounting
app.use('/api/auth', authRoutes);
app.use('/api/harness', harnessRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/workspace', workspaceRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage()
  });
});
```

- **Port Binding**: Operates strictly on port 3000 as required by container reverse-proxy infrastructure.
- **Error Middleware**: Global error handling middleware catches unhandled promise rejections and returns standardized `{ ok: false, error: err.message }` responses.

---

## 4. Core Sandbox & Utility Architecture (`core_arch`)

Located in `src/core/vm_sandbox.ts` & `src/utils.ts`:

### A. V8 VM Sandbox Engine (`src/core/vm_sandbox.ts`)

- **`executeSandboxedCode(code, contextVariables, timeoutMs)`**:
  - Creates isolated execution context using Node.js `vm.createContext()`.
  - Overrides and disables dangerous global objects: `process`, `require`, `import`, `module`, `exports`, `global`, `globalThis`, `fetch`, `XMLHttpRequest`, `WebSocket`, `setTimeout`, `setInterval`.
  - Executes prototype freezing inside VM context:
    ```javascript
    Object.freeze(Object.prototype);
    Object.freeze(Array.prototype);
    Object.freeze(Function.prototype);
    Object.freeze(String.prototype);
    Object.freeze(Number.prototype);
    Object.freeze(Boolean.prototype);
    ```
    This prevents prototype pollution security exploits from escaping the sandbox.
  - Executes code snippet via `vm.Script.runInContext()` with hard CPU execution timeout (default: 1000ms).
  - Captures console output (`log`, `warn`, `error`, `info`) into a log array.
  - Returns `SandboxResult` object (`{ success, result, logs, executionTimeMs, error? }`).
- **`executePiAgentCommand(prompt, tenantId, extraArgs)`**:
  - Invokes `pi` agent CLI command via `child_process.exec`.
  - Enforces 60-second execution timeout.
  - Returns `PiAgentExecResult` (`{ success, stdout, stderr, exitCode, error? }`).
- **`registerVmEvalTool(pi)`**: Registers tool definition `vm_eval` into `pi` agent framework.

### B. Global Utilities Engine (`src/utils.ts`)

- **YAML I/O & Atomic Writes**:
  - `readYaml(filePath)`: Reads and parses YAML file using `yaml` package.
  - `writeYaml(filePath, data)`:
    - Writes content to a temporary file (`.tmp_<basename>_<timestamp>_<random>`).
    - Atomically renames temporary file to target path (`fs.renameSync`). This prevents corrupt file reads if process crashes during write.
- **Freshness & Smart Change Detection**:
  - `stripFreshness(obj)`: Removes `freshness` metadata keys prior to comparison.
  - `hasRealChange(oldData, newData)`: Deep compares JSON representation to detect genuine content edits.
  - `stampFreshness(block)`: Increments `sync_count` and updates `last_synced` timestamp.
  - `smartWrite(filePath, oldData, newData)`: Writes file only if real content changes are detected.
- **Path Resolvers**:
  - `getTbDiskPath(root, prefix, kind, parents, name)`: Resolves disk path for toolboxes, skills (`.pi/skills/`), extensions (`.pi/extensions/`), and agents.
  - `getTbYamlPath(kind, parents, name)`: Generates nested YAML object key array.

---

## 5. User Tenant Auxiliary Persistence Architecture (`user_arch`)

Located under `workspaces/<tenant_id>/`:

```
workspaces/<tenant_id>/
├── raw_data/          # Input data files & uploads
├── components/        # Registered system components
├── entities/          # Tenant entity definitions
└── systems/           # Specialized toolbox and domain configurations
```
