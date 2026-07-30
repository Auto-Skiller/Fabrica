# Fabrica 4-Stage Looped Pipeline & Execution Architecture

This document defines the core 4-stage looped pipeline engine in Fabrica:
`Drafting ──> Planning ──> Execution ──> Delivering`

## 1. PIPELINE STAGES & SUB-PHASES

### Stage 1: Drafting (Non-Loop stage with active Discovery Loop)
- **Discovery & Scoping** (Loop): Interactive user brainstorming, option presentation, cost/trade-off debate, capturing parameters into `Sources / Discovery & Scoping`.
- *Skill*: `pipeline_Drafting/pipeline_Drafting_Discovery-Scoping`

### Stage 2: Planning (Loop stage)
- **Deep Research & Intelligence Gathering** (Loop): Multi-vector web scrapers, documentation verification, competitor scans into `Sources / Deep Research & Intelligence Gathering`.
  - *Skill*: `pipeline_Planning/pipeline_Planning_Deep-Research_Intelligence-Gathering`
- **Data Analysis & Pattern Extraction** (Non-loop): Ingesting datasets, calculating metrics, detecting anomalies into `Sources / Data Analysis & Pattern Extraction`.
  - *Skill*: `pipeline_Planning/pipeline_Planning_Data-Analysis_Pattern-Extraction`
- **Strategic Synthesis & Decision Support** (Non-loop): Actionable Strategic Plan & Interactive Decision Matrix in `Sources / Strategic Synthesis & Decision Support`.
  - *Skill*: `pipeline_Planning/pipeline_Planning_Strategic-Synthesis_Decision-Support`

### Stage 3: Execution (Non-loop stage)
- **Generation** (Non-loop): Codebases, visual assets, automations under `Deliverables / Executions`.
  - *Skill*: `pipeline_Execution/pipeline_Execution_Generation` (with sub-skills `Assets`, `Coding`, `Run-Automations`)
- **Verification** (Non-loop): Cross-references `Deliverables / Executions` against `Sources / Strategic Synthesis & Decision Support`.
  - If **FAIL**: Re-triggers Generation loop with error feedback.
  - If **PASS**: Promotes deliverable to `Deliverables / Reviews`.
  - *Skill*: `pipeline_Execution/pipeline_Execution_verification`

### Stage 4: Delivering (Non-loop stage)
- **Review** (Non-loop): User review gate for production-grade deliverables in `Deliverables / Reviews`.
  - If **FEEDBACK GIVEN**: Moves work back to `Deliverables / Executions` and re-runs execution generation.
  - If **ACCEPTED**: Promotes deliverable to `Deliverables / Completed`.
  - *Skill*: `pipeline_Delivering/pipeline_Delivering_Review`

---

## 2. EFFORT PARAMETERS & APPROVAL GATES
- **EFFORT Level**: Sets loop depth (Low: 1 round, Medium: 2 rounds, High: 3 rounds, Deep: 5 rounds).
- **User Approval Gates**: User can toggle Approval Gates ON/OFF globally or per-loop. When ON, execution pauses at the end of the loop/phase until approved by the user.

---

## 3. DEPENDENCY GRAPH & HISTORICAL TRACKING
- **Evolutionary Tracking (Round > 1)**: In multi-round loops, previously analyzed files, URLs, and data blocks are tracked to eliminate duplicate work.
- **Dependency Mapping**: Every deliverable item explicitly links to its source documents in `Sources`.


