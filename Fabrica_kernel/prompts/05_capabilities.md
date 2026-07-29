# Tools & Capabilities Guide

This guide defines what a "Tool" is in the Fabrica Business OS, how tools are registered, how they scale, and how the partner utilizes them.

## 1. TOOLS VS INTERNAL WORKFLOWS
It is critical to distinguish between the two structural layers in the kernel:
- **Internal Workflows**: Workflows (`analytics`, `research`, `build`, etc.) are operational guidelines that govern *how* the agent thinks, plans, and structures its execution. They are part of the core product and reside read-only in the agent kernel.
- **Tools**: Tools are functional *extensions* or *integrations* (plugins, MCP servers, domain skills, secondary agents, execution engines) that the agent uses to interact with the outside world. Tools reside in the client workspace, are declared in the Supabase `tools` table, and can be activated or deactivated by the user.

---

## 2. TYPES OF TOOLS & SYSTEM ENDPOINTS

### A. Plugins
Code blocks or API proxies that connect the agent to external platforms (e.g., Shopify, Stripe, Gmail, Slack). Plugins expose distinct server routes and methods that the agent can execute via JSON payloads.

### B. MCP (Model Context Protocol) Servers
External modular service servers that expose standardized tool APIs, resources, and prompt templates. MCPs enable the agent to query local file structures, run SQL commands, or execute bash scripts.

### C. Sandboxed Code Execution Engine (`POST /api/sandbox/execute`)
A secure VM execution channel allowing agents to run dynamically generated JavaScript/TypeScript routines within an isolated context with prototype locks and time budgets.

### D. Pipeline Orchestrator Status (`GET /api/pipeline/status`)
Exposes live task queue metrics, worker thread pool stats, and background mission simulation health.

### E. Model Selection & Live Streaming Voice
- **Model Selector (`chatModel`)**: Dynamic model provider switching (`gemini-3.6-flash`, `claude-3-5-sonnet`, `openrouter/`).
- **Live Voice Stream (🎙️)**: Real-time bi-directional voice streaming channel adjacent to active session controls.

### F. Domain Skills & Secondary Agents
Sub-agents or specialist LLM pipelines spawned by the orchestrator to solve nested tasks in parallel (e.g., a "QA testing agent", "database administrator agent").

---

## 3. THE MATURITY LADDER & METRICS
Every tool registered in the database carries a performance or completeness rating called the **Maturity Ladder**:

```
[ STUB ] ──> [ FUNCTIONAL ] ──> [ HARDENED ] ──> [ BATTLE-TESTED ]
```

- **Stub**: The tool schema, inputs, and outputs are defined, but the underlying API or script is not yet written or verified.
- **Functional**: The tool is connected, can accept test inputs, and returns basic functional responses.
- **Hardened**: The tool includes extensive error handling, input validation, and log recording. It has successfully completed live test sessions.
- **Battle-Tested**: The tool handles rate-limiting, handles concurrent multi-user requests, and has operated reliably across multiple production missions.

---

## 4. ACTIVATION & SECURITY
- **Activation Status**: Every tool row in the `tools` table carries an `active: boolean` flag under its metadata JSONB.
- **Agent Rule**: The agent is STRICTLY FORBIDDEN from executing any tool whose `active` flag is set to `false`. Users toggle tool activation directly from the dashboard bottom control bar.
- **Security Isolation**: Tools must never expose raw database credentials or Master Secret API keys to the client-side browser. All tool operations must run server-side via proxies.

# Data and Systems Guide

This guide describes how Fabrica manages and processes unstructured data inputs, structured system components, and the relationships/dependencies between them.

## 1. THE DUALITY OF DATA AND SYSTEMS

In Fabrica, everything is categorized into one of two fundamental pillars:
1. **Raw Data (`raw_data` table)**: This contains the user's unstructured inputs. Examples include email dumps, live chat histories, CSV tables, server performance logs, and legacy spreadsheets. It acts as the "source of truth" and "context reservoir".
2. **System Components (`system_components` table)**: This contains the structured, operational, and executable elements. Examples include database schemas, active API routes, d3 visualizer configurations, prompt templates, and codebase files.

---

## 2. PANEL C DUAL-COLUMN LAYOUT & DIVISION

In the workspace interface (Panel C), Raw Data and System Components are displayed side-by-side in an expanded 50/50 split layout:

- **Equal Flex Widths**: Both sections flex to equal widths (`flex: 1, minWidth: 0`), preventing overflow or compression.
- **Vertical Divider Line**: A crisp `1.5px solid var(--border-soft)` dividing line spans continuously down the center, cleanly separating the Data controls/header on the left from the System controls/header on the right.
- **Sub-Section Header Controls**:
  - **Left Half (Data)**: Features an Import button, Source Filter dropdown, search input, and List/Graph view toggle.
  - **Right Half (Systems)**: Features an Export button, System Category Filter dropdown, search input, and List/Graph view toggle.

---

## 3. INGESTION & PIPELINE METRIC TRACING

When raw unstructured files or streams enter the system, they are processed through dedicated **pipelines** (e.g., System Build From Data, System Optimization From Data, System Test From Data, or Analytics).

### Ingestion Flow
1. **Raw Ingestion**: Documents are written to the `raw_data` table with detailed mime-type headers and origin metadata.
2. **Analysis and Mapping**: The Analytics or Research phase maps these inputs to active operational systems.
3. **Upgrades & Normalization**: The optimization or build workflow converts raw inputs into schema definitions, seed queries, or routing modules.

---

## 4. DEPENDENCY & SYSTEM FLOW VISUALIZATIONS

The relationships between raw data and active systems are visualized in the workspace via the **Dependency Graph** and **Data/Systems List views**:

- **Implicit/Heuristic Links**: Fabrica automatically infers connections between raw data nodes and system component nodes based on keyword matches, file types, or shared status descriptors.
- **Custom Links**: Users and agents can declare explicit connections, which are persisted locally inside the user's workspace to define clean DAGs (Directed Acyclic Graphs).
- **Interactive Modeling**: The workspace utilizes high-contrast d3 force-directed simulations and Cytoscape graphs to model active dependencies, preventing code fragmentation and highlighting single-points-of-failure.


# Missions Guide

Missions are the primary control surfaces of the Fabrica kernel. They govern all autonomous partner operations, allowing both enterprise leaders and power users to map raw business states into fully functional outputs.

## 1. AGENTIC INPUT-TO-OUTPUT MATRIX
Every mission is a highly customized pipeline that ingests any input format, executes specific agentic tasks, and compiles tailored functional outputs:

### A. The Input Spectrum (What we ingest)
- **Ideas & Concepts**: User-supplied descriptions, business briefs, PM logs, and core requirements.
- **Raw Data & Ledger Tables**: Spreadsheets (Excel, CSVs), client feedback chats, support logs, email logs, and documents.
- **Pre-Existing Systems**: Legacy software codebases, Odoo database schemas, active webhooks, and live server endpoints.

### B. Specialized Agentic Tasks (How we operate)
- **Digital Transformation & Architecture**: Mapping data workflows and assessing integrations.
- **Development & Product Engineering**: Scaffold, compile, and configure real software components.
- **Marketing & Media Buying**: Setting up ad campaigns, auditing budgets, and tracking analytics logs.
- **Content Creation & Distribution**: Synthesizing high-converting ad copy, copy decks, and dynamic visual assets.
- **Customer Response & Sales**: Formulating auto-responders and routing sales queues.

### C. The Output Spectrum (What we build & deploy)
- **Deployed ERP & Custom Systems**: Customized relational modules, database partitions, and enterprise tables.
- **Workflow Automations & Pipelines**: Completed n8n workflows, connected API pipelines, and automated webhooks.
- **Knowledge & Deep Analytics Engines**: SWOT metrics, competitive research briefs, synthesized spreadsheets, and insights logs.
- **Operational Dashboards**: Real-time monitoring interfaces with customized tracking telemetry.

---

## 2. AGENTIC KERNEL ARCHITECTURE TAXONOMY
Every operation inside the Fabrica kernel is organized into three distinct structural components: Phases, Modes, and Pipelines.

### A. Core Phases (The Stages of Execution)
- **Planning Phase (`phase-planning.md`)**: Coordinates strategic design, analytics, research, and defining development tasks. No actual code generation or file writing happens during this phase—only analysis and scored task backlog generation.
- **Execution Phase (`phase-execution.md`)**: Executes approved development tasks sequentially with transaction-level write safety, iterative linting, compilation, and automatic rollbacks upon failure.

### B. Agent Operating Modes (The Behavioral Protocols)
These modes define the overall agent operational behaviors, rules, laws, and required inputs/outputs when operating under specific constraints. They can be triggered by pipelines or manually by the user:
- **Brainstorming Mode (`mode-brainstorming.md`)**: Blends analytics, exploratory deep research, and intensive user QA gates to draft new system horizons, visual options, and architecture specs.
- **Deep Research Mode (`mode-deep_research.md`)**: Executes multi-vector technical scans, official documentation verification, and package/library research.
- **Analytics Mode (`mode-analytics.md`)**: Gathers and parses unstructured log tables, error metrics, and support logs to identify bottlenecks.
- **Build Mode (`mode-build.md`)**: Governs system logic formulation, shared TypeScript interface design, and structural file scaffolding.
- **Optimization Mode (`mode-optimization.md`)**: Oversees software refactoring, continuous upgrades, security hardening, and query performance tuning.
- **Test Mode (`mode-test.md`)**: Coordinates lint checks, automated test-suite compilation, type-safety validations, and sandbox test harness executions.

### C. Standard Mission (The Custom Engine)
- **Standard Mission (`mission-standard.md`)**: Can perform any action based on user intent and goals. It is fully flexible and dynamically leverages different Modes and Task Pipelines as needed during its lifecycle.

### D. Specialized Task Pipelines (The Orchestration Sequences)
These pipelines govern specialized task-specific workflow execution sequences. They specify the exact sequence of modes, inputs, and outputs required to solve specific business problems:
- **Build Pipeline (`pipeline-build`)**: Moves from a raw conceptual text/idea to a fully functional, production-ready system.
- **Build From Data Pipeline (`pipeline-build_from_data`)**: Ingests unstructured datasets (sheets, chats, logs) and transforms them into active databases, seed queries, and dashboard modules.
- **Optimization Pipeline (`pipeline-optimization`)**: Gathers system metrics and upgrades existing codebases, schemas, and configurations for speed and robustness.
- **Optimization From Data Pipeline (`pipeline-optimization_from_data`)**: Takes both an existing system AND raw unstructured data to perform extensive refactoring and dataset feeding.
- **Test Pipeline (`pipeline-test`)**: Automatically compiles test suites, generates mocking utilities, and validates functional routes.
- **Test From Data Pipeline (`pipeline-test_from_data`)**: Uses real unstructured datasets to build and execute behavioral simulation and validation tests.

---

## 3. HORIZONTAL STATUS FLOW (The State Pipeline)
A mission transitions through four major status blocks, visible in the tracker interface:

```
[ DRAFTING ] ──> [ PLANNING ] ──> [ EXECUTION ] ──> [ ARCHIVE ]
```

- **DRAFTING**: The initial scoping phase. The agent runs analytical and research loops to understand the parameters. During this phase, the mission tracks detailed **Phases** (Analytics, Research, QA).
  - *User-Created Missions (`user_created: true`)*: Always pause at the QA gate phase, waiting for explicit user selection or approval before moving to Planning.
  - *Agent/System-Created Missions*: In **FULL AUTO** mode, the agent automatically evaluates workspace context, answers QA gates, and advances missions to Planning automatically.
- **PLANNING**: The mission has a clear proposal. The agent has generated a prioritized task list scored on `benefit`, `cost`, and `worth-it: yes|no`.
  - In **FULL AUTO** or **SEMI-AUTO**, the system compiles the implementation blueprint and advances to Execution automatically. In **SUPERVISED**, it waits for user confirmation.
- **EXECUTION**: The mission is active. The agent sequentially completes tasks, runs verification, and hot-swaps compiled production modules into `system_components`.
- **ARCHIVE**: The task is finished or canceled (`status = 'archive'`). Finished missions are marked as DONE and historical progress is locked in the database.

---

## 4. THE 7-STEP DRAFTING PIPELINE
For specialized pipelines (System Build, System Build From Data, System Optimization, System Optimization From Data, System Test, System Test From Data), the **DRAFTING** status is subdivided into a highly structured 7-step pipeline. Each step must be completed sequentially:

1. **Analytics 1 (Initial Analytics)**: Analyze the user's initial inputs (e.g. ad briefs, spreadsheets, Odoo schemas), identify core boundaries, and outline gaps.
2. **Research 1 (Initial Research)**: Query external APIs, search documentation, or scan existing systems to find matching patterns (e.g. competitor benchmarks, API routes).
3. **Analytics 2 (Research Analytics)**: Synthesize findings from Research 1 and prepare questions for the user or enterprise stakeholder.
4. **QA (User Confirmation Gate)**: Prompt the user with options and explanations of "why". The user makes selections or inputs custom text. **Execution freezes until the user provides input.**
5. **Analytics 3 (User-Response Analytics)**: Analyze user feedback, mapping their preferences to system configurations (e.g. choosing custom Odoo schemas or n8n endpoints).
6. **Research 2 (Final Specific Research)**: Run highly targeted research addressing details or tools specified in the QA selection.
7. **Analytics 4 (Final Synthesis)**: Combine all insights, research, and QA selections into a unified blueprint, ready to transition the mission status to **PLANNING**.

---

## 5. MISSION TELEMETRY & LIVE MONITORING
Missions do not operate in a vacuum. During both the **Execution** and **Archive** phases, active systems pipe telemetry metrics back to the mission's database row:
- **ERP Telemetry**: Track connection state, JSON-RPC success rates, and database sync frequencies.
- **Automation Telemetry**: Track webhook execution rates, trigger counts, and error-to-success ratios from n8n nodes.
- **Marketing Telemetry**: Pipe CPC (Cost-per-Click), dynamic reach metrics, and content engagement analytics.
- **System Health Logs**: Monitor latency, uptime percentage, and exception stacktraces on live-hosted portals.

---

## 6. MISSION INTERACTIVE OVERLAY PANEL
When a user opens a mission card on the tracker, a rich interactive overlay panel is presented. This panel dynamically changes its visual elements and controllers based on the current active phase:
- **During QA Phase**: Displays multiple-choice selection cards, descriptive "Why" explainers, and a text area for custom answers.
- **During Analytics/Research Steps**: Shows live streaming logs, lists active research topics with keywords, and renders structural bento-grids of current insights.
- **During Planning Phase**: Displays the generated task list, allowing the user to view benefit/cost metrics, toggle auto-run options, and click a prominent "Approve Execution" button.
- **During Execution Phase**: Displays a terminal log, a visual progress wheel, and live success/error counts with active telemetry charts.
- **During Archive Phase**: Renders historical logs, built artifacts, and allows downloading completed systems.
