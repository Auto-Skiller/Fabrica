---
name: Delivering
description: Master Stage Skill for Stage 4 (Delivering) in the Fabrica 4-Stage Looped Pipeline. Oversees user review gates, release presentation, and final promotion to Deliverables/Completed.
---

# Pipeline Stage Skill: Delivering

## 1. Overview & Universal Context
The **Delivering** stage is Stage 4 of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It is global, domain-agnostic, and outcome-driven. Its primary objective is to present verified production deliverables from **Deliverables / Reviews** to the human operator, manage user approval/feedback loops, and promote accepted assets to **Deliverables / Completed**.

## 2. Stage Structure & Sub-Skills
- **`Delivering/pipeline_Delivering_Review/SKILL.md`**: Present production deliverables for user review, handle feedback loops, and promote accepted items to `Deliverables/Completed`.

## 3. Workflow Execution
1. Ingest verified deliverable items sitting in **Deliverables / Reviews**.
2. Present work to the user with release notes and verification proof.
3. Handle gate decision:
   - **User Accepts**: Move item to **Deliverables / Completed** and archive mission.
   - **User Feedback**: Move item back to **Deliverables / Executions** and re-trigger Execution loop.
