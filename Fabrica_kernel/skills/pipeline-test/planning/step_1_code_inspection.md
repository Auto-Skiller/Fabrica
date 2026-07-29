# Step 1: Code Inspection

## What
Invokes Analytics Mode to inspect codebase structures, locating function exports, API request patterns, and database interactions.

## When
Runs automatically at the start of a `system_test` mission.

## Why
We must locate key business paths and export boundaries descriptively so we know exactly what is available to be tested.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| target_code_snapshot | string | User | Code components linked to the mission |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| export_surface_report | JSON | Agent: step_2_framework_matching.md | Stored in `missions.workflow_history` |

## Rules
1. **Data Parsing**: Verify the functional mapping schema contains exactly Express route and database entity structures.
2. **Type Protection**: Functional maps must specify field types for all objects.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (via system component select)
- **Delivers to**: Agent: `step_2_framework_matching.md`


## Workflow
1. Ingest the user's objective text and attached file list.
2. Invoke Analytics mode to structure functional capabilities.
3. Partition capabilities into Express endpoints, relational tables, and n8n webhooks.
4. Write the functional boundary map to the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 1 code inspection spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

