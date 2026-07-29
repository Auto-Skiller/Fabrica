# Step 1: Idea Analysis

## What
Invokes Analytics Mode to dissect the user's raw concept brief, mapping the functional boundaries and identifying early logical components.

## When
Triggered automatically as the first step of the `system_build` pipeline.

## Why
Raw ideas are unstructured and vague. Analyzing them descriptively extracts clear logical modules and dependencies, setting a clean target for research.

## Inputs
| Field | Type | From | UI/UX Note |
|-------|------|------|------------|
| concept_brief | string | User | Captured from `missions.objective` field in mission creation |
| attached_files | array (UUIDs) | User | Attached `raw_data` records |

## Outputs
| Field | Type | To | UI/UX Note |
|-------|------|----|------------|
| functional_boundary_map | JSON | Agent: step_2_conceptual_research.md | Stored in `missions.workflow_history` |

## Rules
1. **Data Parsing**: Verify the functional mapping schema contains exactly Express route and database entity structures.
2. **Type Protection**: Functional maps must specify field types for all objects.
3. **Data Safety**: Never mutate user data fields without explicit step-level configuration.

## Handoffs
- **Receives from**: User (via mission objective and raw data attachments)
- **Delivers to**: Agent: `step_2_conceptual_research.md` (via system invocation of Deep Research Mode)

## Workflow
1. Ingest the user's objective text and attached file list.
2. Invoke Analytics mode to structure functional capabilities.
3. Partition capabilities into Express endpoints, relational tables, and n8n webhooks.
4. Write the functional boundary map to the database history.

