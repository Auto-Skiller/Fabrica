# Step 1: Combined Audit

## What
Invokes Analytics Mode to analyze the uploaded raw dataset structures alongside the existing frontend dashboard code structure.

## When
Runs automatically at the start of a `system_optimization_from_data` mission.

## Why
Provides a unified baseline. We must profiles column formats of the new data and code imports of the dashboard together before drafting an integration plan.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| target_code_snapshot | string | User | Code components linked to the mission |
| raw_datasets | array (UUIDs) | User | Dataset files linked to the mission |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| combined_audit_report | JSON | Agent: step_2_integration_best_practices.md | Stored in `missions.workflow_history` |

## Rules
1. **Data Parsing**: Verify the functional mapping schema contains exactly Express route and database entity structures.
2. **Type Protection**: Functional maps must specify field types for all objects.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (via dataset uploads and system component selections)
- **Delivers to**: Agent: `step_2_integration_best_practices.md`


## Workflow
1. Ingest the user's objective text and attached file list.
2. Invoke Analytics mode to structure functional capabilities.
3. Partition capabilities into Express endpoints, relational tables, and n8n webhooks.
4. Write the functional boundary map to the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 1 combined audit spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

