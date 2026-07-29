# Build From Data Pipeline — Agent

## Metadata
- **What**: Orchestrates the conversion of unstructured or structured raw datasets into a production relational DB schema and analytics dashboard.
- **When**: Triggered when a user creates a mission of type `build_from_data` with spreadsheet datasets.
- **Why**: Transforms raw data dumps into structured, queryable relational systems with visual dashboards.
- **Triggers**: User creation of a `build_from_data` mission with attached raw dataset.
- **Inputs**: Mission record (`build_from_data`), target datasets (`raw_data`).
- **Outputs**: Data System Blueprint (`missions.workflow_history`), deployed relational tables and dashboard (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: build_from_data) | User | **UI: User creates mission with target dataset references** |
| Target datasets | `raw_data` records | User | **UI: Selected files in Panel C are linked to the mission** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Data System Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Relational Tables + Dashboard | Deployed code & schema changes | User | **UI: Relational dashboard component rendered in Panel C** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (data upload and mission link)
- **Ends at**: phase-planning.md â†’ database migrations + frontend analytics dashboard

---

## Pipeline Steps

### `planning/step_1_dataset_discovery.md`
- **What**: Invokes Analytics Mode to run a Dataset Shape Report on the linked raw files, detecting column types, row counts, null counts, and samples.
- **When**: Immediately on mission start.
- **Mode**: Analytics

### `planning/step_2_normalization_research.md`
- **What**: Invokes Deep Research Mode to research normalization rules, common database formats, and indexing needs based on the data columns.
- **When**: After Step 1 discovery completes.
- **Mode**: Deep Research

### `planning/step_3_schema_formulation_qa.md`
- **What**: Step-owned logic. Formulates exactly 3 database schema patterns (flat vs. normalized levels) with "Why" tradeoffs, writing to `missions.qa_state`.
- **When**: After Step 2.
- **Mode**: Step-owned
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_confirmation.md`
- **What**: User gate step halting pipeline execution until the user selects and confirms their preferred schema pattern.
- **When**: After Step 3 options write.
- **Mode**: None
- **User Gate**: YES â€” user action required

### `planning/step_5_schema_mapping.md`
- **What**: Invokes Analytics Mode on user selections to output a detailed descriptive database fields mapping sheet (types, constraints, foregin keys).
- **When**: After user schema approval.
- **Mode**: Analytics

### `planning/step_6_performance_indexing_research.md`
- **What**: Invokes Deep Research Mode on the finalized columns and estimated row counts to research indices, query performance, and charting library syntax.
- **When**: After Step 5.
- **Mode**: Deep Research

### `planning/step_7_data_system_blueprint.md`
- **What**: Step-owned logic. Combines database schemas and charting configs into a single Data System Blueprint, handing off to Phase Planning.
- **When**: After Step 6.
- **Mode**: Step-owned

