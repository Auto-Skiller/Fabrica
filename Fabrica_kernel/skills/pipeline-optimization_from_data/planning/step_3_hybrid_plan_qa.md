# Step 3: Hybrid Plan QA

## What
Step-owned prescriptive logic that converts the descriptive combined audit and research specifications into exactly 3 integration paths with tradeoff reasoning, writing to `missions.qa_state`.

## When
Runs automatically after Step 2.

## Why
Gives the user transparent, comparable choices about integration complexity, schema changes, and visualization updates.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| combined_audit_report | JSON | Agent: step_1_combined_audit.md | â€” |
| integration_spec_sheet | JSON | Agent: step_2_integration_best_practices.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| integration_options | JSON | User | Rendered as option cards in the QA panel |

## Rules
1. **Option Formulation**: Present exactly 3 conceptual designs (Simple/Custom, Normalized/Denormalized).
2. **QA Output**: Save choices to missions.qa_state before proceeding.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_2_integration_best_practices.md`
- **Delivers to**: User (QA panel options)


## Workflow
1. Read the research sheet and functional boundary map.
2. Evaluate design tradeoffs based on risk, complexity, and performance goals.
3. Draft 3 architectural options with specific descriptions.
4. Format and save these options to the QA overlay state.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 3 hybrid plan qa spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

