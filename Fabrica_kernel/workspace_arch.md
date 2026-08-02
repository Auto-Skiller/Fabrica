# Workspace File Engine & Integration Architecture (`workspace_arch.md`)

This document provides a complete, production-grade architectural audit and logic walkthrough for the Workspace Filesystem Engine, Single `workspace.json` Index Store, Google Drive / Sheets Integration, and GitHub Sync Subsystem.

---

## 1. Subsystem Overview & Hierarchy Architecture

The Workspace Subsystem manages files, sources, deliverables, Google Drive documents, and GitHub repository sync. Files are organized under `workspaces/<tenant_id>/workspace/` into structured folders.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Client User Interfaces                            │
│  - File Explorer & Workspace File Manager                                   │
│  - Google Drive & Sheets Import Drawer (drive-api.ts / drive-auth.ts)       │
│  - GitHub Repository Importer & Exporter (github-api.ts)                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP API Calls (frontend-next/components/workspace/api.ts)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Workspace Express API Routes                           │
│                    (src/api/routes/workspace.routes.ts)                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Core Workspace Engine                              │
│                         (src/core/workspace.ts)                             │
│  - Path Resolver & Boundary Guard (resolveUserPath)                         │
│  - File Operations (listUserFiles, readUserFile, writeUserFile, etc.)       │
│  - Single Index Synchronizer (syncWorkspaceJson)                            │
│  - Cloud Storage Bucket Sync Simulator (listCloudStorageObjects)            │
│  - Action History & Pending Import Manager                                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Disk Storage & Metadata Mapping
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Tenant Storage (workspaces/<tenant_id>/)                  │
│  ├── workspace.json  (Single Index: sources, deliverables, pendings, actions)│
│  ├── AGENTS.md       (Workspace rules & prompt conventions)                 │
│  └── workspace/                                                             │
│      ├── Sources/                                                           │
│      │   ├── Discovery & Scoping/                                           │
│      │   ├── Deep Research & Intelligence Gathering/                        │
│      │   ├── Data Analysis & Pattern Extraction/                            │
│      │   └── Strategic Synthesis & Decision Support/                        │
│      └── Deliverables/                                                      │
│          ├── Executions/                                                    │
│          ├── Reviews/                                                       │
│          └── Completed/                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture (`components_arch`)

Located in `frontend-next/components/workspace/`:

### A. Data Types & Interfaces (`frontend-next/components/workspace/types.ts`)

- Unused legacy types (`Toolbox`, `ToolboxesYaml`, `InboxItem`, `InboxYaml`, `PromptsYaml`) have been completely removed from the workspace types registry.

### B. Workspace Frontend API (`frontend-next/components/workspace/api.ts`)

- **`workspaceApi` Core Methods**:
  - `getWorkspaceFiles(subDir)`: `GET /api/workspace/files?path=...` — Lists directory contents.
  - `readWorkspaceFile(filePath)`: `GET /api/workspace/file/read?path=...` — Reads raw file content.
  - `writeWorkspaceFile(filePath, content)`: `POST /api/workspace/file/write` — Creates or updates file.
  - `moveWorkspaceFile(src, dest)`: `POST /api/workspace/file/move` — Renames or moves file.
  - `deleteWorkspaceFile(filePath)`: `POST /api/workspace/file/delete` — Deletes file or directory.
  - `getWorkspaceMap()`: `GET /api/workspace/map` — Retrieves full `workspace.json` file index.
  - `getAgentsMd() / saveAgentsMd(content)`: Reads and updates workspace `AGENTS.md` instructions.

### C. External Service Integrations

- **Google Drive & Sheets Integration (`drive-auth.ts` & `drive-api.ts`)**:
  - `googleSignIn()`: Opens Firebase Google Auth popup requesting `drive.readonly` and `spreadsheets.readonly` OAuth scopes.
  - `listDriveFiles(filterSpreadsheetsOnly)`: Calls `https://www.googleapis.com/drive/v3/files` to fetch file lists.
  - `fetchGoogleSheetAsCSV(spreadsheetId, sheetName)`: Calls Google Sheets API v4 to parse cell grids into RFC 4180 CSV strings.
  - `fetchDriveFileContent(fileId, mimeType)`: Exports Google Docs to plain text or downloads raw media.
- **GitHub REST API Integration (`github-api.ts`)**:
  - `fetchGitHubContents(owner, repo, path, branch, token)`: Retrieves directory tree from GitHub API v3.
  - `downloadGitHubFile(downloadUrl, token)`: Downloads file content from GitHub repository.
  - `exportToGitHub(params)`: Encodes UTF-8 strings into Base64 and commits file updates directly to GitHub branches using `PUT /repos/{owner}/{repo}/contents/{path}`.

---

## 3. Routes Architecture (`routes_arch`)

Located in `src/api/routes/workspace.routes.ts`:

| Method | Endpoint | Description | Request Payload | Response Schema |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/workspace/files` | Fetches items & state from `workspace.json` with path sanitization | Query: `?path=subDir` | `{ ok: true, files: WorkspaceItem[] }` |
| `POST` | `/api/workspace/create` | Creates or imports workspace item with metadata | `{ path, content?, type?, level?, description?, when_to_use?, triggers?, isImport?, flagged_as_action? }` | `{ ok: true, path, item: WorkspaceItem }` |
| `GET` | `/api/workspace/file/read` | Reads file text content | Query: `?path=filePath` | `{ ok: true, content, path, size }` |
| `POST` | `/api/workspace/file/write` | Writes content to workspace file | `{ path, content, isImport? }` | `{ ok: true, path, size }` |
| `POST` | `/api/workspace/clear-pending` | Clears workspace pending item flag | `{ path: string }` | `{ ok: true }` |
| `POST` | `/api/workspace/flag-action` | Flags item as action item | `{ path?: string, item?: WorkspaceItem }` | `{ ok: true }` |
| `POST` | `/api/workspace/file/move` | Moves/renames file or directory | `{ src, dest }` | `{ ok: true, src, dest, size }` |
| `POST` | `/api/workspace/file/delete` | Deletes file or directory | `{ path: string }` | `{ ok: deleted: boolean }` |
| `GET` | `/api/workspace/map` | Fetches index `workspace.json` | Query: `?tenantId=...` | `{ ok: true, map: WorkspaceMap }` |

---

## 4. Core Architecture (`core_arch`)

Located in `src/core/workspace.ts`:

### A. TypeScript Interfaces

- **`WorkspaceItem`**: Unified item record containing `{ name, path, isDirectory, type, level: { maturity, readability }, description, when_to_use, triggers, size, modified_at, created_at?, flagged_as_action? }`
- **`WorkspacePendingItem`**: `{ id, name, path, type, level, description, when_to_use, triggers, size, modified_at, created_at }`
- **`WorkspaceActionItem`**: `{ id, path, action: 'imported'|'created'|'updated'|'deleted'|'moved'|'processed'|'flagged', details?, timestamp }`
- **`WorkspaceMap`**: Unified index containing `sources` categories, `deliverables` categories, `pendings`, `actions`, `action_items` (items flagged as actions), and `updated_at`.

### B. Core Workspace Engine Functions

- **`syncWorkspaceJson(tenantId)`**:
  - Ensures required workspace folder structure exists (`workspace/Sources/` and `workspace/Deliverables/`).
  - Scans four Source subdirectories: `Discovery & Scoping`, `Deep Research & Intelligence Gathering`, `Data Analysis & Pattern Extraction`, `Strategic Synthesis & Decision Support`.
  - Scans three Deliverable subdirectories: `Executions`, `Reviews`, `Completed`.
  - Aggregates file metadata and preserves/populates item attributes (`type`, `level`, `description`, `when_to_use`, `triggers`, `flagged_as_action`).
  - Populates `action_items` array for items flagged as actions.
  - Atomically writes updated `workspace.json` in real time.
- **`listWorkspaceItemsFromJson(tenantId, subDir)`**:
  - Fetches workspace items and state directly from `workspace.json`.
  - Performs strict path sanitization against directory traversal (`..` blocking and `resolveUserPath` validation).
- **`createWorkspaceItem(tenantId, params)`**:
  - Creates or imports a workspace item, writes file to disk, saves custom metadata (`type`, `level`, `description`, `when_to_use`, `triggers`), flags action if requested, and triggers real-time `workspace.json` sync.
- **`flagWorkspaceAction(tenantId, pathOrItem)`**: Flags item as action item and adds to `action_items` array in `workspace.json`.
- **`recordWorkspaceAction(tenantId, action)`**: Appends action record to historical log array (capped at 100 entries).
- **`clearWorkspacePending(tenantId, pendingIdOrPath)`**: Removes item from `pendings` and records a `'processed'` action.
- **`getWorkspaceMap(tenantId)`**: Reads `workspace.json` from tenant directory or runs `syncWorkspaceJson` if missing.
- **`getWorkspaceArtifactsFromIndex(tenantId, existingMission?)`**: Reads sources and deliverables directly from `workspace.json` index and maps them for mission tracking while preserving `processed` state flags.
- **`resolveUserPath(tenantId, relativePath)`**: Security path resolver enforcing workspace boundary checks.
- **`writeUserFile(tenantId, relativePath, content, isImport)`**: Writes file content, flags pending item if written to `workspace/`, records action log, appends tenant audit event, and syncs `workspace.json` in real time.
- **`moveUserFile(tenantId, srcRelativePath, destRelativePath)`**: Renames file on disk and updates `workspace.json` in real time.
- **`deleteUserFile(tenantId, relativePath)`**: Removes file/folder from disk and updates index in real time.

---

## 5. User Tenant Persistence Architecture (`user_arch`)

Stored at: `workspaces/<tenant_id>/workspace.json`

### File Schema Example:

```json
{
  "sources": {
    "discovery_and_scoping": [
      {
        "name": "market_research.pdf",
        "path": "workspace/Sources/Discovery & Scoping/market_research.pdf",
        "size": 1048576,
        "modified_at": "2026-08-01T12:00:00.000Z"
      }
    ],
    "deep_research": [],
    "data_analysis": [],
    "strategic_synthesis": [],
    "all": []
  },
  "deliverables": {
    "executions": [],
    "reviews": [],
    "completed": [
      {
        "name": "final_report.md",
        "path": "workspace/Deliverables/Completed/final_report.md",
        "size": 4096,
        "modified_at": "2026-08-01T15:30:00.000Z"
      }
    ],
    "all": []
  },
  "pendings": [],
  "actions": [
    {
      "id": "wksp_a_1772467800000_1x9z",
      "path": "workspace/Deliverables/Completed/final_report.md",
      "action": "created",
      "details": { "size": 4096 },
      "timestamp": "2026-08-01T15:30:00.000Z"
    }
  ],
  "updated_at": "2026-08-01T16:10:00.000Z"
}
```
