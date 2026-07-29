# Step 7: Architectural Blueprint

## What
A step-owned prescriptive logic file that synthesizes all research and configuration data into a final Architectural Blueprint and triggers Phase Planning.

## When
Runs automatically after Step 6.

## Why
The blueprint serves as the final contract. Once created, it is handed off to `phase-planning.md` to generate structured implementation tasks.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| configuration_map | JSON | Agent: step_5_selection_analysis.md | â€” |
| verified_specs | JSON | Agent: step_6_targeted_research.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| architectural_blueprint | JSON | Agent: phase-planning.md | Triggers planning proposal generation |

## Rules
1. **Blueprint Verification**: The final blueprint must specify exact files and schemas.
2. **Handback Gating**: Deliver the blueprint and trigger the phase planning proposal.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_6_targeted_research.md`
- **Delivers to**: Agent: `phase-planning.md` (triggers task decomposition phase)


## Workflow
1. Read the configuration map and verified specs from history.
2. Compile database schemas, route paths, and component structures into a single blueprint.
3. Save the final blueprint to missions.workflow_history.
4. Transition the mission to the planning phase.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 7 architectural blueprint spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

