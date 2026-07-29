# Optimization Pipeline — Agent

## Metadata
- **What**: Orchestrates surgical refactoring, performance tuning, and security hardening of existing code modules and database schemas.
- **When**: Triggered when a user creates a mission of type `optimization` to improve codebase efficiency or resolve latency.
- **Why**: Prevents chaotic manual edits and guarantees optimizations are guided by audits and verified standards.
- **Triggers**: User creation of an `optimization` mission with linked target systems.
- **Inputs**: Mission record (`optimization`), target system components (`system_components`).
- **Outputs**: Refactoring Blueprint (`missions.workflow_history`), hardened system snapshot (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: optimization) | User | **UI: User selects target system module(s) to optimize** |
| Target systems | `system_components` records | User | **UI: Linked component(s) in Panel C** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Refactoring Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Hardened system snapshot | Updated `system_components` record | User | **UI: Updated system components displayed in Panel C** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (target selection)
- **Ends at**: phase-planning.md â†’ surgical code updates â†’ regression validation

---

## Pipeline Steps

### `planning/step_1_code_audit.md`
- **What**: Invokes Analytics Mode to run a Code Health Report on the target code snapshot, identifying complexity, duplicate logic, and dependencies.
- **When**: On mission start.
- **Mode**: Analytics

### `planning/step_2_upgrade_discovery.md`
- **What**: Invokes Deep Research Mode to research deprecation warnings, package upgrades, security updates, and performance tuning rules.
- **When**: After Step 1 completes.
- **Mode**: Deep Research

### `planning/step_3_refactoring_plan_qa.md`
- **What**: Step-owned logic. Formulates exactly 3 optimization approaches (e.g. minor cleanups vs. major caching layer vs. schema refactor) with impact risk, writing to `missions.qa_state`.
- **When**: After Step 2.
- **Mode**: Step-owned
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_gate.md`
- **What**: Halts execution until the user selects their preferred optimization scope and risk level from the QA cards.
- **When**: After Step 3 options write.
- **Mode**: None
- **User Gate**: YES â€” user action required

### `planning/step_5_refactoring_scope.md`
- **What**: Invokes Analytics Mode on user selection + code audit to output a detailed descriptive impact map (downstream modules, tables, endpoints affected).
- **When**: After user path selection.
- **Mode**: Analytics

### `planning/step_6_integration_specifics.md`
- **What**: Invokes Deep Research Mode to retrieve syntax specs, index rules, or caching libraries chosen in the optimization scope.
- **When**: After Step 5.
- **Mode**: Deep Research

### `planning/step_7_refactoring_blueprint.md`
- **What**: Step-owned logic. Synthesizes all steps into a Refactoring Blueprint, handing off to Phase Planning.
- **When**: After Step 6.
- **Mode**: Step-owned

