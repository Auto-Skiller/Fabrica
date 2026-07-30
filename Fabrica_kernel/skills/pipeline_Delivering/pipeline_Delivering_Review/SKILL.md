---
name: pipeline_Delivering_Review
description: Final Review & Delivery skill for presenting production-grade deliverables in Deliverables/Reviews to the user, capturing human feedback, and promoting accepted items to Deliverables/Completed.
---

# Pipeline Skill: Delivering Review

## 1. Overview & Context
This skill operates inside the **Delivering** stage of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It presents verified items from `Deliverables/Reviews` for final human evaluation and deployment signoff.

## 2. Operational Rules & Subroutines
- **Inputs**: `Deliverables/Reviews`.
- **User Review Gate**: Presents deliverable preview, release notes, and acceptance checklist.
- **Routing Logic**:
  - **IF USER GIVES FEEDBACK**: Re-routes item with feedback notes back to `Deliverables/Executions` and restarts Execution generation loop.
  - **IF USER APPROVES**: Promotes item from `Deliverables/Reviews` to `Deliverables/Completed` as a finalized production asset.
