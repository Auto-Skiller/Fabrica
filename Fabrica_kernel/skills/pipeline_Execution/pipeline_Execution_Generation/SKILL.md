---
name: pipeline_Execution_Generation
description: Master Generation skill for creating assets, writing production code, and running automations based on Strategic Synthesis or review/verification feedback, outputting into Deliverables/Executions.
---

# Pipeline Skill: Execution Generation

## 1. Overview & Context
This skill governs the **Generation** phase of the **Execution** stage in the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It handles asset generation, code compilation, and automated workflow deployment, producing deliverables in **Deliverables/Executions**.

## 2. Phase Operational Rules
- **Loop Status**: Non-loop execution phase (triggered by new plan, verification retry, or user review feedback).
- **Inputs**: `Sources/Strategic Synthesis & Decision Support` OR Verification Feedback OR Review Feedback.
- **Outputs**: Codebases, visual assets, compiled tools, and reports in `Deliverables/Executions`.

## 3. Step-by-Step Workflow
1. **Target Identification**: Determine output type (Code Path vs Document / Automation Path).
2. **Sub-Skill Routing**: Dispatch to Assets, Coding, or Automation sub-skills based on task nature.
3. **Build & Optimize**: Execute code scaffolding, asset creation, or workflow configuration.
4. **Register Deliverable**: Save output to `Deliverables -> Executions` for verification.

## 4. Sub-Domain Mapping & Extensions
- `/skills/pipeline_Execution/pipeline_Execution_Generation/pipeline_Execution_Generation_Assets`
- `/skills/pipeline_Execution/pipeline_Execution_Generation/pipeline_Execution_Generation_Coding`
- `/skills/pipeline_Execution/pipeline_Execution_Generation/pipeline_Execution_Generation_Run-Automations`
