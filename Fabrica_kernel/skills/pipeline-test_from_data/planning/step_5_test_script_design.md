# Step 5: Test Script Design

## What
Invokes Analytics Mode to compile the user selections and generate a detailed configuration of how simulation data will stream through tests.

## When
Runs automatically after User Gate in Step 4.

## Why
Builds a descriptive plan of the mock streams and metrics reporting structures before limits verification.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| user_selections | JSON | User | Retrieved from `missions.qa_state.user_selections` |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| simulation_run_config | JSON | Agent: step_6_boundary_limits.md | Stored in `missions.workflow_history` |

## Rules
1. **Detail Mapping**: Translate selected architectural design into exact directory layouts.
2. **Index Structure**: Ensure route maps declare RLS filters on every table.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (via Step 4)
- **Delivers to**: Agent: `step_6_boundary_limits.md`


## Workflow
1. Retrieve user's confirmed option selection from missions.qa_state.
2. Invoke Analytics mode to compile a detailed target scoping map.
3. Outline route handlers, components, and database tables.
4. Save the configuration mapping to the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 5 test script design spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

