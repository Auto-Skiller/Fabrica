---
name: pipeline_Drafting_Discovery-Scoping
description: Discovery & Scoping Loop skill for interactive user brainstorming, option presentation, cost/trade-off debate, and scoping parameter capture into Sources/Discovery & Scoping.
---

# Pipeline Skill: Discovery & Scoping Loop

## 1. Overview & Context
This skill operates inside the **Drafting** stage of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It governs interactive discovery, goal clarifying, option trade-off assessment, and capturing initial project parameters into **Sources/Discovery & Scoping**.

## 2. Phase Operational Rules
- **Loop Status**: Active Loop until User Approval Gate is satisfied or manually passed.
- **Effort Parameter**: Driven by `EFFORT` setting (Low, Medium, High, Deep).
- **Inputs**: User prompt, raw goals, user-uploaded initial files.
- **Outputs**: Formatted Scoping Document registered in **Sources/Discovery & Scoping**.

## 3. Step-by-Step Workflow
1. **Interactive Q&A & Brainstorming**: Engage with the user to clarify operational goals, boundaries, key features, and success criteria.
2. **Present Architectural Options**: Present at least 3 distinct strategic options with explicit pros, cons, estimated effort, and cost trade-offs.
3. **Capture & Debate Preferences**: Store approved strategic choices, constraints, and operational preferences.
4. **Register Source Item**: Output structured JSON/Markdown scoping manifest into `Sources -> Discovery & Scoping`.

## 4. Sub-Domain Mapping & Extensions
- `/skills/pipeline_Drafting/pipeline_Drafting_Discovery-Scoping/domain-product-scoping`
- `/skills/pipeline_Drafting/pipeline_Drafting_Discovery-Scoping/domain-technical-architecture`
- `/skills/pipeline_Drafting/pipeline_Drafting_Discovery-Scoping/domain-marketing-strategy`
