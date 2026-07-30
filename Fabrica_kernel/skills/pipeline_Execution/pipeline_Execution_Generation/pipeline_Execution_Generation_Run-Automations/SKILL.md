---
name: pipeline_Execution_Generation_Run-Automations
description: Sub-skill for building, configuring, and deploying automated workflows, n8n pipelines, and scheduled sync jobs under Deliverables/Executions.
---

# Pipeline Skill: Execution Generation — Run Automations

## 1. Overview & Context
Handles automated workflow generation, webhook triggers, n8n json graph configurations, and cron job schedules under `Deliverables/Executions`.

## 2. Operational Rules & Subroutines
- Ingests automation specifications, API credentials, and trigger criteria.
- Configures webhook endpoints, workflow nodes, and error retry handlers.
- Registers runnable workflow modules under `Deliverables -> Executions`.
