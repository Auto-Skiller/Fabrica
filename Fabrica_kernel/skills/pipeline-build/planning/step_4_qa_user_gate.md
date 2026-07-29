# Step 4: QA User Gate

## What
A user-facing gate step that halts pipeline execution until the user selects a preferred design option and submits it.

## When
Triggered after Step 3 writes the options to `missions.qa_state`.

## Why
Ensures human-in-the-loop control. The agent must never choose the system's core architecture autonomously without explicit user approval.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| design_options | JSON | Agent: step_3_synthesis_qa_formulation.md | Rendered in QA panel |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| user_selections | JSON | Agent: step_5_selection_analysis.md | **UI: Captured when the user selects a card and clicks "Confirm Selection" in the overlay** |

## Rules
1. **Gate Lock**: Freeze execution state until user confirms selection.
2. **Validation**: Check that the confirmed option matches a valid schema index.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (UI interaction)
- **Delivers to**: Agent: `step_5_selection_analysis.md`


## Workflow
1. Render options in user-facing QA cards.
2. Halt execution, waiting for user interaction event.
3. Capture user's selected choice from the overlay confirm event.
4. Verify option matching database schema state and resume.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 4 qa user gate spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

