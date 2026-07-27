# Build Pipeline — Agent

## Metadata
- **What**: Orchestrates the full journey from a user-supplied text concept or business brief to a production-ready Architectural Blueprint, then through Planning and Execution to a deployed system.
- **When**: Triggered when a user creates a new mission of type `build` for building a new product or feature from scratch.
- **Why**: Ensures every build is grounded in verified research, QA validation, and architectural planning before code is generated.
- **Triggers**: User creation of a `build` mission.
- **Inputs**: Mission record (`build`), optional raw reference files (`raw_data`).
- **Outputs**: Architectural Blueprint (`missions.workflow_history`), deployed system component snapshot (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: build) | User | **UI: User creates mission via the mission creation form — title (concept name) + objective (description of what to build)** |
| Raw reference files (optional) | `raw_data` records | User | **UI: User can attach raw files (requirements docs, wireframes) via the Raw Data panel in Panel C** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Architectural Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Deployed system snapshot | `system_components` record | User | **UI: Appears as a new card in the System Snapshots section of Panel C with a "Deploy Snapshot" button** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (mission creation)
- **Ends at**: phase-planning.md â†’ phase-execution.md â†’ `system_components` record

---

## Pipeline Steps

### `planning/step_1_idea_analysis.md`
- **What**: Invokes Analytics Mode on the user's raw concept brief. Produces a functional boundary map.
- **When**: Immediately after mission creation.
- **Mode**: Analytics

### `planning/step_2_conceptual_research.md`
- **What**: Invokes Deep Research Mode on the functional boundary map to find architectures, package versions, and API compatibility.
- **When**: After step_1 produces the functional boundary map.
- **Mode**: Deep Research

### `planning/step_3_synthesis_qa_formulation.md`
- **What**: Step-owned logic. Interprets analytics + research outputs to formulate 3 distinct engineering design paths with "Why" rationale. Writes to `missions.qa_state`.
- **When**: After step_2 produces the research reference sheet.
- **Mode**: Step-owned (no mode invoked)
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_gate.md`
- **What**: Waits for user to select their preferred design path from the QA panel.
- **When**: After step_3 writes options to `missions.qa_state`.
- **Mode**: None â€” user I/O only
- **User Gate**: YES â€” execution frozen until user submits

### `planning/step_5_selection_analysis.md`
- **What**: Invokes Analytics Mode on user selections + research sheet. Produces a configuration map (folder layouts, schemas, integrations).
- **When**: After user submits QA selections.
- **Mode**: Analytics

### `planning/step_6_targeted_research.md`
- **What**: Invokes Deep Research Mode on the specific libraries, APIs, and platforms selected in step_4. Produces verified specs and code snippets.
- **When**: After step_5 produces the configuration map.
- **Mode**: Deep Research

### `planning/step_7_architectural_blueprint.md`
- **What**: Step-owned logic. Combines all outputs into a final Architectural Blueprint. Transitions mission to PLANNING phase.
- **When**: After step_6 produces verified specs.
- **Mode**: Step-owned (no mode invoked)
- **Output**: Triggers phase-planning.md

