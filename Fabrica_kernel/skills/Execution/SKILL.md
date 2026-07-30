---
name: Execution
description: Master Stage Skill for Stage 3 (Execution) in the Fabrica 4-Stage Looped Pipeline. Oversees Generation (Assets, Coding, Automations) and Verification feedback loops under Deliverables/Executions.
---

# Pipeline Stage Skill: Execution

## 1. Overview & Universal Context
The **Execution** stage is Stage 3 of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It is global, domain-agnostic, and outcome-driven. Its primary objective is to execute production building (codebases, visual design, automations) based on the Actionable Strategic Plan, verify output quality against requirements, and handle self-repair loops before promotion to review.

## 2. Stage Structure & Sub-Skills
1. **`Execution/Generation/SKILL.md`**: Master generation coordinator for:
   - `Execution/Generation/Assets Generation/SKILL.md`
   - `Execution/Generation/Coding/SKILL.md`
   - `Execution/Generation/Automations Runing/SKILL.md`
2. **`Execution/verification/SKILL.md`**: Verification loop that audits outputs in `Deliverables/Executions` against specs in `Sources/Strategic Synthesis & Decision Support`.

## 3. Workflow Execution
1. Ingest blueprint from **Sources / Strategic Synthesis & Decision Support** (or review feedback).
2. Invoke `Execution/Generation` sub-skills to build target deliverables under **Deliverables / Executions**.
3. Run `Execution/verification` audit:
   - If FAIL: Trigger generation loop with error feedback notes.
   - If PASS: Promote item to **Deliverables / Reviews** and transition mission to **Delivering** stage.
