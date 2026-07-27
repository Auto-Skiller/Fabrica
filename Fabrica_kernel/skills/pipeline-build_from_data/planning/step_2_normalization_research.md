# Step 2: Normalization Research

## What
Invokes Deep Research Mode to research relational database designs, best-practice entity relationships, and indexing requirements matching the discovered column profile.

## When
Runs automatically after Step 1.

## Why
Prevents simple flat-file database conversions. Relational normal forms (1NF, 2NF, 3NF) must be researched relative to the dataset domain.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| dataset_shape_report | JSON | Agent: step_1_dataset_discovery.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| normalization_spec | JSON | Agent: step_3_schema_formulation_qa.md | Stored in `missions.workflow_history` |

## Rules
1. **Query Scoping**: Restrict official source queries to active version-pinned frameworks.
2. **Registry Verification**: Source domains must match the official registry.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_1_dataset_discovery.md`
- **Delivers to**: Agent: `step_3_schema_formulation_qa.md`


## Workflow
1. Read the functional boundary map from the database history.
2. Invoke Deep Research mode with version-pinned search queries.
3. Retrieve official specs for target libraries and modules.
4. Compile research facts into the reference sheet.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 2 normalization research spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

