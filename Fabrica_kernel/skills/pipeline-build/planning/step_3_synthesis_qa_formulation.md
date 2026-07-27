# Step 3: Synthesis QA Formulation

## What
A step-owned prescriptive logic file that consumes the descriptive research and functional maps, synthesizes them into exactly 3 engineering paths, and writes them to `missions.qa_state`.

## When
Invoked after Step 2 completes.

## Why
Bridges analytical findings to design decisions. Formulating clear, comparable choices with tradeoffs allows the user to steer the build early.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| functional_boundary_map | JSON | Agent: step_1_idea_analysis.md | â€” |
| research_reference_sheet | JSON | Agent: step_2_conceptual_research.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| design_options | JSON | User | Written directly to `missions.qa_state` to render option cards in the QA panel |

## Rules
1. **Option Formulation**: Present exactly 3 conceptual designs (Simple/Custom, Normalized/Denormalized).
2. **QA Output**: Save choices to missions.qa_state before proceeding.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_2_conceptual_research.md`
- **Delivers to**: User (QA option cards inside Panel B overlay)


## Workflow
1. Read the research sheet and functional boundary map.
2. Evaluate design tradeoffs based on risk, complexity, and performance goals.
3. Draft 3 architectural options with specific descriptions.
4. Format and save these options to the QA overlay state.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 3 synthesis qa formulation spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

