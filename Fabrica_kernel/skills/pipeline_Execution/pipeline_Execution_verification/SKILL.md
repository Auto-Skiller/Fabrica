---
name: pipeline_Execution_verification
description: Verification skill for cross-referencing generated execution outputs against Strategic Synthesis requirements, validating correctness, and promoting items to Deliverables/Reviews or looping back.
---

# Pipeline Skill: Execution Verification

## 1. Overview & Context
This skill operates inside the **Verification** phase of the **Execution** stage in the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It verifies that generated items in `Deliverables/Executions` accurately meet requirements defined in `Sources/Strategic Synthesis & Decision Support`.

## 2. Operational Rules & Subroutines
- **Inputs**: `Sources/Strategic Synthesis & Decision Support` + `Deliverables/Executions`.
- **Validation Audit**: Checks for missing specifications, type errors, or functional gaps.
- **Routing Logic**:
  - **IF NOT OK**: Re-triggers Generation with explicit verification error feedback.
  - **IF OK**: Promotes deliverable item from `Deliverables/Executions` to `Deliverables/Reviews`.
