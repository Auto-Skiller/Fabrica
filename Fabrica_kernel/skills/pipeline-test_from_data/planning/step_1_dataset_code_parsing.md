# Step 1: Dataset Code Parsing

## What
Invokes Analytics Mode to review incoming dataset field formats alongside the codebase modules that ingest them.

## When
Runs automatically at the start of a `system_test_from_data` mission.

## Why
Identifies parsing mismatches (e.g. string dates in data vs expected Date types in code) before generating simulation scripts.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| target_code_snapshot | string | User | Code components linked to the mission |
| raw_datasets | array (UUIDs) | User | Dataset files linked to the mission |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| parsing_match_report | JSON | Agent: step_2_simulation_design.md | Stored in `missions.workflow_history` |

## Rules
1. **Data Parsing**: Verify the functional mapping schema contains exactly Express route and database entity structures.
2. **Type Protection**: Functional maps must specify field types for all objects.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (via dataset uploads and system component selections)
- **Delivers to**: Agent: `step_2_simulation_design.md`


## Workflow
1. Ingest the user's objective text and attached file list.
2. Invoke Analytics mode to structure functional capabilities.
3. Partition capabilities into Express endpoints, relational tables, and n8n webhooks.
4. Write the functional boundary map to the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 1 dataset code parsing spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

