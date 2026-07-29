# Test Pipeline — Agent

## Metadata
- **What**: Orchestrates design, compilation, and execution of a complete test suite on an existing codebase.
- **When**: Triggered when a user creates a mission of type `test` after adding features or refactoring.
- **Why**: Guarantees codebase integrity, type safety, and security gates before promotion.
- **Triggers**: User creation of a `test` mission with linked target systems.
- **Inputs**: Mission record (`test`), target system components (`system_components`).
- **Outputs**: Testing Blueprint (`missions.workflow_history`), verified test suite and pass/fail matrix (`system_components`).

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| Mission record | `missions` row (type: test) | User | **UI: User selects target system component(s) to verify** |
| Target systems | `system_components` records | User | **UI: Linked component(s) in Panel C** |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| Testing Blueprint | Structured JSON â†’ `missions.workflow_history` | Agent: phase-planning.md | â€” |
| Verified Test Suite | Deployed test script files | User | **UI: Test pass/fail matrix rendered in Panel C** |

## Rules

## Rules
1. **Pipeline Sequencing**: Execute steps in strict chronological order (step 1 to 7).
2. **Gate Lock**: Freeze execution during user-gate steps until confirmation is received.
3. **Blueprint Handback**: The final step must deliver a structured blueprint to planning phase.

## Handoffs
- **Starts from**: User (target system selection)
- **Ends at**: phase-planning.md â†’ test runners execution â†’ pass/fail validation report

---

## Pipeline Steps

### `planning/step_1_code_inspection.md`
- **What**: Invokes Analytics Mode to run a Code Health Report, auditing export surfaces, API endpoints, database interactions, and failure boundaries in the target components.
- **When**: On mission start.
- **Mode**: Analytics

### `planning/step_2_framework_matching.md`
- **What**: Invokes Deep Research Mode to research matching testing frameworks, mock configurations, and runner syntaxes suitable for the tech stack.
- **When**: After Step 1 inspection completes.
- **Mode**: Deep Research

### `planning/step_3_coverage_plan_qa.md`
- **What**: Step-owned logic. Formulates exactly 3 test coverage levels (happy path only vs. comprehensive unit vs. full integration + security) with "Why" tradeoffs, writing to `missions.qa_state`.
- **When**: After Step 2.
- **Mode**: Step-owned
- **User Gate**: YES â€” writes to QA panel

### `planning/step_4_qa_user_gate.md`
- **What**: User gate step halting pipeline execution until the user selects and confirms their test suite coverage plan.
- **When**: After Step 3 options write.
- **Mode**: None
- **User Gate**: YES â€” user action required

### `planning/step_5_scaffold_specification.md`
- **What**: Invokes Analytics Mode on user selections to output a descriptive test scaffold spec (mock setups, assertion libraries, test directories structure).
- **When**: After user selection.
- **Mode**: Analytics

### `planning/step_6_utility_validation.md`
- **What**: Invokes Deep Research Mode to research verified mock handlers, assertion library syntaxes, and API headers selected in the test spec.
- **When**: After Step 5.
- **Mode**: Deep Research

### `planning/step_7_testing_blueprint.md`
- **What**: Step-owned logic. Consolidates mock templates and test scripts into a single Testing Blueprint, handing off to Phase Planning.
- **When**: After Step 6.
- **Mode**: Step-owned

