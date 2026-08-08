# Comprehensive Architectural Restructuring & Consolidation Plan

## 1. Executive Summary & Enterprise Architecture Benchmarking

This plan outlines the complete restructuring, renaming, consolidation, and modularization strategy for the **Fabrica AI Platform** (`src/` backend and `frontend-next/` Next.js frontend). 

Drawing inspiration from enterprise AI IDE and cloud workspace platforms (**Replit, Google AI Studio, CodeSandbox, GitHub Codespaces, NotebookLM, Bolt, and Lovable**), this architectural overhaul addresses critical maintainability issues, eliminates massive monolith files, unifies API clients, enforces strict type safety, and organizes codebase domains cleanly.

---

## 2. Current Architecture & Identified Deficiencies

### Backend (`src/`)
* **Monolithic Core Modules**: `src/core/harness.ts` (~1,430 lines) mixes prompt building, model provider routing, extension execution, streaming SSE logic, and GCS state sync in a single file.
* **Scattered Services & Utilities**: Service layer (`cloudrun.orchestrator.ts`) is separated from container domain logic (`tenant.ts`), while file utility functions are broadly dumped into `src/utils.ts`.
* **Tight Coupling between Routes and Core**: Direct route-to-core calls without dedicated controller layers or request schema validations.

### Frontend (`frontend-next/`)
* **Massive Monolithic Dashboard**: `frontend-next/app/dashboard/page.tsx` exceeds **18,600 lines of code** in a single file. It contains inline definitions for chat panels, code editors, file tree views, preview frames, mission graphs, settings drawers, and terminal outputs.
* **Scattered & Duplicated API Clients**: 8 separate API files (`auth/api.ts`, `harness/api.ts`, `tenant/api.ts`, `workspace/api.ts`, `missions/api.ts`, `drive-api.ts`, `github-api.ts`, `components/api.ts`) repeat fetch setups, bearer token handling, and error logging.
* **Lack of Domain Component Isolation**: Key workspace features lack modular sub-components, making UI state re-renders inefficient and debugging difficult.

---

## 3. Target Directory & File Structure

```
/
├── src/                          # Express / Node.js Backend Engine
│   ├── config/                   # Global configuration & env variables
│   │   ├── env.ts
│   │   └── constants.ts
│   ├── types/                    # Backend DTOs & Domain Interfaces
│   │   ├── auth.types.ts
│   │   ├── harness.types.ts
│   │   ├── missions.types.ts
│   │   ├── tenant.types.ts
│   │   └── workspace.types.ts
│   ├── middlewares/              # Express Middlewares
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── services/                 # External Integrations & Infrastructure Services
│   │   ├── cloudrun.service.ts   # Provisioning & Cloud Run management
│   │   ├── gcs.service.ts        # Storage buckets & user workspace file persistence
│   │   ├── google-drive.service.ts # Drive API sync
│   │   ├── github.service.ts    # GitHub repo export/import
│   │   └── supabase.service.ts  # Auth & database queries
│   ├── core/                     # Core Business Logic & Domain Controllers
│   │   ├── auth/
│   │   │   ├── session.manager.ts
│   │   │   └── kms.vault.ts
│   │   ├── harness/              # Agent Execution Harness (Split from harness.ts)
│   │   │   ├── prompt.builder.ts
│   │   │   ├── model.providers.ts
│   │   │   ├── extensions.registry.ts
│   │   │   └── harness.engine.ts
│   │   ├── missions/
│   │   │   └── missions.engine.ts
│   │   ├── tenant/
│   │   │   └── tenant.manager.ts
│   │   └── workspace/
│   │       ├── file.manager.ts
│   │       └── preview.tunnel.ts
│   ├── api/                      # Route Handlers / Controllers
│   │   ├── auth.controller.ts
│   │   ├── harness.controller.ts
│   │   ├── missions.controller.ts
│   │   ├── tenant.controller.ts
│   │   └── workspace.controller.ts
│   ├── runner/                   # Agent Execution Sub-process Runner
│   │   ├── agent-runner.ts
│   │   └── server.ts
│   └── utils/                    # Utility Functions
│       ├── crypto.utils.ts
│       └── path.utils.ts
│
└── frontend-next/                # Next.js 15 Client Platform
    ├── lib/                      # Unified Client Utilities & API Gateway
    │   ├── api/                  # Centralized Typed API Gateway (Consolidated)
    │   │   ├── client.ts         # Base Axios/Fetch instance with token interceptors
    │   │   ├── auth.api.ts
    │   │   ├── harness.api.ts
    │   │   ├── missions.api.ts
    │   │   ├── tenant.api.ts
    │   │   ├── workspace.api.ts
    │   │   ├── drive.api.ts
    │   │   └── github.api.ts
    │   ├── hooks/                # Custom React Hooks
    │   │   ├── useAuth.ts
    │   │   ├── useHarnessStream.ts
    │   │   ├── useWorkspaceFiles.ts
    │   │   └── useTenantContainer.ts
    │   └── utils/                # Utility helpers
    ├── types/                    # Frontend TypeScript Definitions
    │   ├── auth.ts
    │   ├── harness.ts
    │   ├── missions.ts
    │   ├── tenant.ts
    │   └── workspace.ts
    ├── components/               # Modularized Domain UI Components
    │   ├── ui/                   # Primitive UI Controls (Buttons, Modals, Badges)
    │   ├── layout/               # Topbar, Sidebars, Resizable Panes
    │   │   ├── HeaderNav.tsx
    │   │   └── WorkspaceLayout.tsx
    │   ├── editor/               # Code Editing & File Explorer Domain
    │   │   ├── FileExplorer.tsx
    │   │   ├── CodeEditor.tsx
    │   │   └── DiffViewer.tsx
    │   ├── preview/              # App Preview & Console Frame Domain
    │   │   ├── LivePreviewFrame.tsx
    │   │   └── ConsoleTerminal.tsx
    │   ├── agent/                # Agent Harness & Chat Domain
    │   │   ├── ChatInterface.tsx
    │   │   ├── AgentNotice.tsx
    │   │   ├── ContextPickerModal.tsx
    │   │   └── SkillsExtensionsModal.tsx
    │   ├── missions/             # Mission Graph & Runtime Board Domain
    │   │   ├── MissionGraphView.tsx
    │   │   └── RuntimeBoardView.tsx
    │   ├── tenant/               # Container & Sandbox Management Domain
    │   │   └── ContainerBadge.tsx
    │   └── auth/                 # Authentication & Account Modals
    │       └── AccountWorkspaceModal.tsx
    └── app/                      # Next.js App Router Pages
        ├── page.tsx              # Clean Landing Page
        ├── dashboard/            # High-Performance Modular Workbench
        │   └── page.tsx          # Clean Orchestrator Component (<500 lines)
        ├── onboard/
        │   └── page.tsx
        └── oauth/
            └── page.tsx
```

---

## 4. File Consolidation & Splitting Strategy

### A. Splitting Strategy for Monoliths

1. **`frontend-next/app/dashboard/page.tsx` (18,600+ lines -> ~350 lines Orchestrator)**:
   * **Extract `ChatInterface.tsx`**: Agent streaming response visualizer, prompt box, tool call badges, model selection.
   * **Extract `FileExplorer.tsx` & `CodeEditor.tsx`**: File tree navigation, file tabs, Monaco/inline editor state.
   * **Extract `LivePreviewFrame.tsx`**: Iframe launcher, device viewports, tunnel URL status, refresh handlers.
   * **Extract `ConsoleTerminal.tsx`**: Container logs visualizer, shell command launcher, status streams.
   * **Extract `MissionGraphView.tsx`**: Interactive graph viewer for user missions, stages, runtime node status.
   * **Extract `SettingsModal.tsx` & `ContextPickerModal.tsx`**: Workspace configuration drawer, extensions, skills, and GCP context selectors.

2. **`src/core/harness.ts` (1,427 lines -> 4 specialized modules)**:
   * **`prompt.builder.ts`**: System prompt composition, skill inclusion, context window framing.
   * **`model.providers.ts`**: Google GenAI SDK calls, Anthropic/OpenAI compatibility layers, fallback chains.
   * **`extensions.registry.ts`**: Skill invocation, tool definitions, custom extension execution.
   * **`harness.engine.ts`**: High-level turn lifecycle manager and SSE dispatch.

3. **`src/core/auth.ts` (588 lines -> 2 specialized modules)**:
   * **`session.manager.ts`**: Supabase session verification, token renewal, user workspace binding.
   * **`kms.vault.ts`**: GCP KMS encryption/decryption routines for user secret storage.

4. **`src/core/workspace.ts` (598 lines -> 2 specialized modules)**:
   * **`file.manager.ts`**: Local workspace tree parsing, GCS bucket sync, diff generation.
   * **`preview.tunnel.ts`**: Dev server proxy, reverse tunnel setup, port routing.

### B. Consolidation Strategy for API Clients

1. **Consolidate Client API Layer**:
   * Combine all 8 fragmented `api.ts` files in `frontend-next/components/*` into a unified API Gateway under `frontend-next/lib/api/`.
   * Create a single `client.ts` with standardized error handling, request timeout, authorization header injection, and retry logic.
   * Export domain-specific namespace modules (`authApi`, `harnessApi`, `tenantApi`, `workspaceApi`, `missionsApi`, `driveApi`, `githubApi`).

2. **Consolidate Type Definitions**:
   * Create unified domain type files under `frontend-next/types/` and `src/types/` to prevent duplication across component folders.

---

## 5. Execution Roadmap

### Phase 1: Planning & Baseline Verification
* Create & approve restructuring plan.
* Verify baseline compilation (`compile_applet`) and server stability.

### Phase 2: Backend Restructuring (`src/`)
* Reorganize `src/core/` monoliths into modular domain folders (`harness/`, `auth/`, `workspace/`, `missions/`, `tenant/`).
* Move external provider APIs into `src/services/` (`cloudrun.service.ts`, `gcs.service.ts`, `supabase.service.ts`).
* Create explicit controllers in `src/api/` and update import statements across `server.ts` and `src/runner/`.
* Test and verify backend routes using `compile_applet`.

### Phase 3: Frontend API & Types Consolidation (`frontend-next/lib/`)
* Build centralized `lib/api/` HTTP client with interceptors.
* Consolidate domain API functions (`auth.api.ts`, `harness.api.ts`, `workspace.api.ts`, `tenant.api.ts`, `missions.api.ts`, `drive.api.ts`, `github.api.ts`).
* Consolidate shared TypeScript interfaces into `frontend-next/types/`.

### Phase 4: Modularizing the Frontend UI (`frontend-next/components/`)
* Deconstruct `frontend-next/app/dashboard/page.tsx`:
  * Move domain components into `components/editor/`, `components/preview/`, `components/agent/`, `components/missions/`, and `components/layout/`.
  * Reduce `dashboard/page.tsx` down to an elegant orchestrator screen.
* Update import paths in `app/page.tsx`, `app/onboard/page.tsx`, and `app/oauth/page.tsx`.

### Phase 5: Final Compilation & Quality Verification
* Run `compile_applet` and linting to ensure zero syntax or build errors.
* Verify that all existing API contracts, agent execution workflows, live previews, and cloud run orchestrations remain 100% functional.

---

## 6. Risk Mitigation & Integrity Commitments
* **Zero Logic Loss**: All features, agent hooks, prompt builders, telemetry streams, and Cloud Run integrations will be preserved without altering functional signatures.
* **Backward Compatibility**: Any internal route URLs or payload contracts between `frontend-next` and `src/` will remain synchronized.
* **Step-by-step Compilation**: Verification through `compile_applet` will occur after each phase to catch missing imports or typing defects immediately.
