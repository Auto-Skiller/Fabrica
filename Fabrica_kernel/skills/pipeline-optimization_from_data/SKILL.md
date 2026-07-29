# Optimization From Data Pipeline — Agent

## Metadata
- **What**: Orchestrates simultaneous ingestion of raw datasets and surgical refactoring of existing codebase modules to consume and visualize new data.
- **When**: Triggered when a user creates a mission of type `optimization_from_data` with fresh raw data and active system modules.
- **Why**: Evolves data schemas and UI modules concurrently under a Unified Migration Scope.
- **Triggers**: User creation of an `optimization_from_data` mission with linked datasets and system components.
- **Inputs**: Mission record (`optimization_from_data`), target system components (`system_components`), target raw datasets (`raw_data`).
- **Outputs**: Hybrid Integration Blueprint (`missions.workflow_history`), integrated dashboard component (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: optimization_from_data) | User | **UI: User selects target system module AND uploads new dataset** |
| Target systems | `system_components` records | User | **UI: Linked component(s) in Panel C** |
| Target datasets | `raw_data` records | User | **UI: Linked dataset file(s) in Panel C** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Hybrid Integration Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Integrated Dashboard Component | Updated database schema + code modules | User | **UI: Updated relational metrics cards rendered in Panel C** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (simultaneous data upload and dashboard target link)
- **Ends at**: phase-planning.md â†’ database migration + integrated frontend layouts

---

## Pipeline Steps

### `planning/step_1_combined_audit.md`
- **What**: Invokes Analytics Mode to run a Code + Data Health Report, evaluating the code snapshot structure alongside the raw dataset layout.
- **When**: On mission start.
- **Mode**: Analytics

### `planning/step_2_integration_best_practices.md`
- **What**: Invokes Deep Research Mode to research integration binding patterns, API routing standards, and data visualization schemas matching the stack.
- **When**: After Step 1 completes.
- **Mode**: Deep Research

### `planning/step_3_hybrid_plan_qa.md`
- **What**: Step-owned logic. Formulates exactly 3 hybrid options (different levels of normalization and UI updates) with "Why" tradeoffs, writing to `missions.qa_state`.
- **When**: After Step 2.
- **Mode**: Step-owned
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_gate.md`
- **What**: User gate step halting pipeline execution until the user selects and confirms their hybrid integration plan.
- **When**: After Step 3 options write.
- **Mode**: None
- **User Gate**: YES â€” user action required

### `planning/step_5_unified_scope.md`
- **What**: Invokes Analytics Mode on user selections to output a detailed descriptive Unified Migration & UI Scope (database changes + frontend route impact maps).
- **When**: After user confirmation.
- **Mode**: Analytics

### `planning/step_6_library_syntaxes.md`
- **What**: Invokes Deep Research Mode to research verified charting syntaxes, database query parameters, and API serializers selected in the scope.
- **When**: After Step 5.
- **Mode**: Deep Research

### `planning/step_7_hybrid_blueprint.md`
- **What**: Step-owned logic. Consolidates database schema updates and React code modifications into a single Hybrid Blueprint, handing off to Phase Planning.
- **When**: After Step 6.
- **Mode**: Step-owned

