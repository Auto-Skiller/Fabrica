# Step 2: Conceptual Research

## What
Invokes Deep Research Mode to research best practices, library options, and design precedents based on the functional boundary map.

## When
Runs automatically after Step 1 completes.

## Why
Ensures that the architectural choices are guided by real-world documentation, official API specs, and matching technology options rather than guesswork.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| functional_boundary_map | JSON | Agent: step_1_idea_analysis.md | Retracted from `missions.workflow_history` |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| research_reference_sheet | JSON | Agent: step_3_synthesis_qa_formulation.md | Stored in `missions.workflow_history` |

## Rules
1. **Query Scoping**: Restrict official source queries to active version-pinned frameworks.
2. **Registry Verification**: Source domains must match the official registry.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_1_idea_analysis.md`
- **Delivers to**: Agent: `step_3_synthesis_qa_formulation.md`


## Workflow
1. Read the functional boundary map from the database history.
2. Invoke Deep Research mode with version-pinned search queries.
3. Retrieve official specs for target libraries and modules.
4. Compile research facts into the reference sheet.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 2 conceptual research spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

