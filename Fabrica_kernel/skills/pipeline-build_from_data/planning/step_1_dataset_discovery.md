# Step 1: Dataset Discovery

## What
Invokes Analytics Mode to discover data structures, column headers, data types, null distributions, and format anomalies across the uploaded datasets.

## When
Runs automatically at the start of a `system_build_from_data` mission.

## Why
Raw files may have mixed types, corrupted rows, or nested keys. Parsing them descriptively creates a precise data profile before schema planning.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| raw_datasets | array (UUIDs) | User | Dataset files linked to mission |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| dataset_shape_report | JSON | Agent: step_2_normalization_research.md | Stored in `missions.workflow_history` |

## Rules
1. **Data Parsing**: Verify the functional mapping schema contains exactly Express route and database entity structures.
2. **Type Protection**: Functional maps must specify field types for all objects.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: User (via raw dataset uploads)
- **Delivers to**: Agent: `step_2_normalization_research.md`


## Workflow
1. Ingest the user's objective text and attached file list.
2. Invoke Analytics mode to structure functional capabilities.
3. Partition capabilities into Express endpoints, relational tables, and n8n webhooks.
4. Write the functional boundary map to the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 1 dataset discovery spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

