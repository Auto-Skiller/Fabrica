# Test From Data Pipeline — Agent

## Metadata
- **What**: Orchestrates design, setup, and execution of data-driven behavioral simulation tests using production or historical datasets.
- **When**: Triggered when a user creates a mission of type `test_from_data` to test system performance under realistic data loads.
- **Why**: Catches edge cases caused by dirty data, unexpected nulls, or performance degradation under large payloads.
- **Triggers**: User creation of a `test_from_data` mission with linked raw datasets and system components.
- **Inputs**: Mission record (`test_from_data`), target system components (`system_components`), target raw datasets (`raw_data`).
- **Outputs**: Data-Driven Test Blueprint (`missions.workflow_history`), behavioral simulation suite and run logs (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: test_from_data) | User | **UI: User selects target system module AND target raw dataset** |
| Target systems | `system_components` records | User | **UI: Linked component(s) in Panel C** |
| Target datasets | `raw_data` records | User | **UI: Linked dataset file(s) in Panel C** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Data-Driven Test Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Behavioral Simulation Suite | Test scripts + simulation configs | User | **UI: Live simulation run logs and error boundaries rendered in Panel C** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (simultaneous target selection and data upload)
- **Ends at**: phase-planning.md â†’ data-driven simulation runs â†’ pass/fail validation matrix

---

## Pipeline Steps

### `planning/step_1_dataset_code_parsing.md`
- **What**: Invokes Analytics Mode to run a Code + Data Health Report, evaluating the dataset row format alongside the target codebase ingestion functions.
- **When**: On mission start.
- **Mode**: Analytics

### `planning/step_2_simulation_design.md`
- **What**: Invokes Deep Research Mode to research stream parsers, simulation models, and timeout profiles for processing massive datasets in Vitest/Jest.
- **When**: After Step 1 completes.
- **Mode**: Deep Research

### `planning/step_3_simulation_matrix_qa.md`
- **What**: Step-owned logic. Formulates exactly 3 simulation paths (e.g. subset smoke test vs. full volume run vs. speed-up rate simulation) with tradeoffs, writing to `missions.qa_state`.
- **When**: After Step 2.
- **Mode**: Step-owned
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_confirmation.md`
- **What**: User gate step halting pipeline execution until the user selects and confirms their simulation matrix.
- **When**: After Step 3 options write.
- **Mode**: None
- **User Gate**: YES â€” user action required

### `planning/step_5_test_script_design.md`
- **What**: Invokes Analytics Mode on user selections to output a detailed descriptive Test Script Configuration (data iteration speed, streaming pipelines, metrics logs).
- **When**: After user confirmation.
- **Mode**: Analytics

### `planning/step_6_boundary_limits.md`
- **What**: Invokes Deep Research Mode to research boundary constraints, database write locks, and API rate limits during data ingestion.
- **When**: After Step 5.
- **Mode**: Deep Research

### `planning/step_7_data_driven_test_blueprint.md`
- **What**: Step-owned logic. Consolidates simulation models and verified boundaries into a final Data-Driven Testing Blueprint, handing off to Phase Planning.
- **When**: After Step 6.
- **Mode**: Step-owned

