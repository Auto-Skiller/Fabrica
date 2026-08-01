# Mission & Task Management Architecture (`missions_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for the Missions, Dependency Graph Visualizer, Workspace Artifact Sync, and Pipeline Processing Subsystem.

---

## 1. Subsystem Overview & Mission Pipeline Architecture

The Missions Subsystem orchestrates goal-oriented agent tasks ("Missions"). Missions pass through standard pipeline stages (`discovery` ➔ `blueprint` ➔ `scaffold` ➔ `execute` ➔ `review`) and automatically generate markdown and JSON artifacts stored within the tenant workspace.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Frontend Client UI                                │
│   - Mission Management Drawer / Task Roadmaps                               │
│   - DependencyGraph.tsx (Interactive D3.js Force-Directed Simulation Graph) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Requests (frontend-next/components/missions/api.ts)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Missions Express API Routes                           │
│                     (src/api/routes/missions.routes.ts)                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Core Missions Engine                              │
│                          (src/core/missions.ts)                             │
│  - Directory Orchestrator (ensureMissionWorkspaceDirs)                      │
│  - Dual-Sync Persistence Engine (syncMissionWorkspaceArtifacts)             │
│  - Single Store Synchronizer (syncMissionsJson)                             │
│  - Pending & Action History Manager                                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Workspace Filesystem Writes
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tenant Storage (workspaces/<tenant_id>/)                  │
│  ├── missions.json  (Single index: { missions, pendings, actions })         │
│  └── missions/<mission_id>/                                                 │
│      ├── planning/                                                          │
│      │   ├── plan.json        (Task structure & status)                     │
│      │   └── blueprint.md     (Auto-generated markdown roadmap)             │
│      └── execution/                                                         │
│          ├── execution.json   (Metrics & workflow history)                  │
│          └── execution_history.md (Formatted execution logs)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/components/missions/`:

### A. Data Types & Interfaces (`frontend-next/components/missions/types.ts`)

- **`MissionClass`**: Stage classification `'DRAFT' | 'PLANNING' | 'EXECUTION' | 'DONE'`.
- **`Priority`**: Priority level `'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`.
- **`MissionGoal`**: Detailed goal metadata:
  - `status: boolean`: Completion status.
  - `priority: Priority`: Urgency.
  - `goal: string`: Main statement.
  - `why / cause / how: string`: Rationale and methodology.
  - `benefits / costs: string[]`: Trade-off analysis.
  - `worth_it: string`: Cost-benefit evaluation result.
  - `instructions: string[]`: Actionable step-by-step guidance.
- **`MissionTask`**:
  - `priority_ref: number`: Numerical order.
  - `progress: 'completed' | 'in-progress' | 'blocked' | 'not-started'`: Task progress.
  - `task: string`: Task title.
  - `instructions: string[]`: Sub-instructions.
  - `depends_on?: string[]`: Dependency array linking to prerequisite task IDs.
- **`Mission`**: Frontend model holding objective, priority, state, metrics, goals, and tasks map.
- **`MissionsYaml`**: Legacy store wrapper structure.

### B. Frontend API Wrapper (`frontend-next/components/missions/api.ts`)

- **`missionsApi` Methods**:
  - `getMissions()`: `GET /api/missions` — Fetches array of all active missions.
  - `createMission(title, objective, type)`: `POST /api/missions/create` — Provisions new mission.
  - `updateMission(id, updates)`: `POST /api/missions/update` — Updates mission metadata or tasks.
  - `deleteMission(id)`: `POST /api/missions/delete` — Deletes mission and removes folder.
  - `getMissionSchema(type)`: `GET /api/missions/schema` — Loads stage definition schema.
  - `saveDbMission(mission)`: Smart helper routing to `createMission` or `updateMission`.

### C. D3.js Visualizer: `DependencyGraph.tsx`

- **Visual Force Simulation Engine**:
  - Built using D3.js (`d3.forceSimulation`, `d3.forceLink`, `d3.forceManyBody`, `d3.forceCenter`, `d3.forceCollide`).
  - Converts raw data sources (`RawDataNode`) and system components (`SystemNode`) into an interactive directed graph network.
- **Interactive Features**:
  - **Node Dragging**: Users can drag data (`📄`) and system (`⚙️`) nodes to inspect architecture.
  - **Dynamic Link Builder**: Allows users to manually establish custom dependency links between any two nodes.
  - **Animated Flow Packets**: Visualizes real-time data flow using SVG circles traveling along curved paths (`d3.timer`).
  - **Tactical Zoom Controls**: Zoom In (`+`), Zoom Out (`-`), Fit Screen (`⌂`), and Reset Layout (`🔄`).
  - **Node Inspection Panel**: Shows detailed metadata, role, status, and ID upon clicking any graph node.

---

## 3. Routes Architecture (`routes_arch`)

Located in `src/api/routes/missions.routes.ts`:

| Method | Endpoint | Description | Request Body | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/missions` | Lists all active tenant missions | Query: `?tenantId=...` | `{ ok: true, missions: Mission[] }` |
| `GET` | `/api/missions/data` | Returns unified store data (missions + pendings + actions) | Query: `?tenantId=...` | `{ ok: true, missions, pendings, actions }` |
| `POST` | `/api/missions/clear-pending` | Clears pending flag for a mission | `{ id: string }` | `{ ok: true }` |
| `POST` | `/api/missions/create` | Provisions a new mission | `{ title, objective, type? }` | `{ ok: true, mission: Mission }` |
| `POST` | `/api/missions/update` | Updates mission metadata or tasks | `{ id: string, ...updates }` | `{ ok: true, mission: Mission }` |
| `POST` | `/api/missions/delete` | Purges mission and folder from disk | `{ id: string }` | `{ ok: true }` |
| `GET` | `/api/missions/schema` | Fetches pipeline stage schema | Query: `?type=standard` | `{ ok: true, schema: MissionSchema }` |

---

## 4. Core Architecture (`core_arch`)

Located in `src/core/missions.ts`:

### A. TypeScript Interfaces

- **`MissionTask`**: `{ id, title, cost?, benefit?, worth_it?, completed, assigned_agent?, deliverable_path? }`
- **`MissionBlueprint`**: `{ id, title, objective, type, status, phase, qa_state?, tasks }`
- **`MissionExecutionArtifact`**: `{ id, status, phase, workflow_history, system_ids, input_data_ids, metrics }`
- **`MissionSchema`**: Stage definition object with storage paths and pipeline stages (`["discovery", "blueprint", "scaffold", "execute", "review"]`).
- **`MissionsStoreData`**: `{ missions: Mission[], pendings: MissionPendingItem[], actions: MissionActionItem[] }`.

### B. Artifact Creation & Synchronization Engine

- **`getMissionSchema(missionType)`**: Returns normalized mission schema configuration.
- **`ensureMissionWorkspaceDirs(tenantId, missionType, missionId)`**:
  - Resolves path to `workspaces/<tenant_id>/missions/<mission_id>/`.
  - Creates subdirectories `/planning/` and `/execution/`.
- **`syncMissionWorkspaceArtifacts(mission)`**:
  - Writes `/planning/plan.json` (Structured JSON representation of mission tasks).
  - Writes `/planning/blueprint.md` (Human-readable Markdown roadmap with checkboxes `- [x]` or `- [ ]`).
  - Writes `/execution/execution.json` (Execution status, metrics, and workflow timestamps).
  - Writes `/execution/execution_history.md` (Formatted Markdown execution log).
  - Triggers `syncMissionsJson(tenantId)`.
- **`syncMissionsJson(tenantId)`**:
  - Scans `workspaces/<tenant_id>/missions/` directory on disk.
  - Reads `plan.json` and `execution.json` from each mission folder.
  - Reconciles disk state with existing `missions.json`.
  - Atomically writes updated `missions.json`.
- **`createMission(tenantId, { title, objective, type })`**:
  - Generates unique ID `msn_<timestamp>_<random>`.
  - Initializes phase to `'discovery'` and status to `'drafting'`.
  - Invokes `syncMissionWorkspaceArtifacts` to write disk files.
  - Flags pending item in `pendings` and records action log in `actions`.
- **`updateMission(tenantId, missionId, updates)`**: Applies partial updates and resynchronizes all folder artifacts.
- **`deleteMission(tenantId, missionId)`**: Recursively deletes folder `workspaces/<tenant_id>/missions/<missionId>/` and updates `missions.json`.

---

## 5. User Tenant Persistence Architecture (`user_arch`)

Located in `workspaces/<tenant_id>/`:

### A. Central State Store: `missions.json`

```json
{
  "missions": [
    {
      "id": "msn_1772467200000_3x8a",
      "title": "Build Autonomous Crawler",
      "objective": "Scrape and index domain documentation automatically",
      "type": "standard",
      "user_id": "default_user",
      "status": "in_progress",
      "phase": "execute",
      "scratchpad": "missions/msn_1772467200000_3x8a/",
      "planning_artifacts": {
        "plan_json": "missions/msn_1772467200000_3x8a/planning/plan.json",
        "blueprint_md": "missions/msn_1772467200000_3x8a/planning/blueprint.md"
      },
      "execution_artifacts": {
        "execution_json": "missions/msn_1772467200000_3x8a/execution/execution.json",
        "execution_history_md": "missions/msn_1772467200000_3x8a/execution/execution_history.md"
      },
      "metadata": {
        "tasks": [
          {
            "id": "task_1",
            "title": "Configure target URLs",
            "completed": true
          },
          {
            "id": "task_2",
            "title": "Extract DOM content",
            "completed": false
          }
        ]
      },
      "workflow_history": [
        { "timestamp": "2026-08-01T10:00:00Z", "phase": "discovery", "status": "created" },
        { "timestamp": "2026-08-01T10:05:00Z", "phase": "execute", "status": "in_progress" }
      ]
    }
  ],
  "pendings": [],
  "actions": [
    {
      "id": "act_1772467200000_91z2",
      "mission_id": "msn_1772467200000_3x8a",
      "action": "created",
      "timestamp": "2026-08-01T10:00:00.000Z"
    }
  ]
}
```

### B. Mission Folder Hierarchy:

```
workspaces/<tenant_id>/missions/msn_1772467200000_3x8a/
├── planning/
│   ├── plan.json            # Structured task roadmap
│   └── blueprint.md         # Markdown blueprint with task checkboxes
└── execution/
    ├── execution.json       # Status, metrics, workflow timestamps
    └── execution_history.md # Formatted execution event stream
```
