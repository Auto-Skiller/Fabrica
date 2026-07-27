# Step 6: Targeted Research

## What
Invokes Deep Research Mode to perform targeted research on the exact libraries, query patterns, and syntax dependencies required by the configuration map.

## When
Runs automatically after Step 5.

## Why
Prepares the precise, verified syntaxes and code snippet templates so build mode can execute tasks with zero code hallucinations.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| configuration_map | JSON | Agent: step_5_selection_analysis.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| verified_specs | JSON | Agent: step_7_architectural_blueprint.md | Stored in `missions.workflow_history` |

## Rules
1. **Syntax Hardening**: Retrieve only copy-paste-ready syntaxes with correct import paths.
2. **Credential Safety**: Confirm API setups do not expose key variables.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_5_selection_analysis.md`
- **Delivers to**: Agent: `step_7_architectural_blueprint.md`


## Workflow
1. Read the scoping map from history.
2. Invoke Deep Research mode to verify API parameters, database index formats, and libraries.
3. Retrieve exact code snippets and boundary limits.
4. Compile verified specs into the database history.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 6 targeted research spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

