# Step 7: Data System Blueprint

## What
A step-owned prescriptive logic file that constructs the final Data System Blueprint (DB scripts + analytics dashboard layouts) and hands off to Phase Planning.

## When
Runs automatically after Step 6.

## Why
Acts as the final system layout blueprint representing the database structure and the visual panels, triggering the task planning phase.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| schema_mapping_sheet | JSON | Agent: step_5_schema_mapping.md | â€” |
| performance_visual_specs | JSON | Agent: step_6_performance_indexing_research.md | â€” |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| data_system_blueprint | JSON | Agent: phase-planning.md | Triggers planning proposal generation |

## Rules
1. **Blueprint Verification**: The final blueprint must specify exact files and schemas.
2. **Handback Gating**: Deliver the blueprint and trigger the phase planning proposal.
1. **Data Safety**: Never mutate user data fields without explicit step-level configuration.
2. **Type Preservation**: Output values must strictly conform to the defined Output schemas.

## Handoffs
- **Receives from**: Agent: `step_6_performance_indexing_research.md`
- **Delivers to**: Agent: `phase-planning.md`


## Workflow
1. Read the configuration map and verified specs from history.
2. Compile database schemas, route paths, and component structures into a single blueprint.
3. Save the final blueprint to missions.workflow_history.
4. Transition the mission to the planning phase.
1. **Retrieve Inputs**: Parse the required input parameters from the database workflow history.
2. **Invoke Operations**: Run the target operations or mode matching the step 7 data system blueprint spec.
3. **Construct Output**: Normalize and serialize results to match destination definitions.

