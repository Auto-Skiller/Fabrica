# Step 4: QA User Confirmation

## What
A user-facing gate step that halts pipeline execution until the user selects and confirms their simulation matrix options.

## When
Runs when options are written to `missions.qa_state`.

## Why
Prevents running intensive, time-consuming data simulations without direct user approval.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| simulation_options | JSON | Agent: step_3_simulation_matrix_qa.md | Rendered in QA panel |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| user_selections | JSON | Agent: step_5_test_script_design.md | **UI: User selected simulation path card** |

## Rules
1. **Gate Lock**: Freeze execution state until user confirms selection.
2. **Validation**: Check that the confirmed option matches a valid schema index.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (UI selection)
- **Delivers to**: Agent: `step_5_test_script_design.md`


## Workflow
1. Render options in user-facing QA cards.
2. Halt execution, waiting for user interaction event.
3. Capture user's selected choice from the overlay confirm event.
4. Verify option matching database schema state and resume.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 4 qa user confirmation spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

