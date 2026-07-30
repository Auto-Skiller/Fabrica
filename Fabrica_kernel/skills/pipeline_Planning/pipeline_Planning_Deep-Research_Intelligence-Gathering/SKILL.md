---
name: pipeline_Planning_Deep-Research_Intelligence-Gathering
description: Deep Research & Intelligence Gathering skill for multi-vector web scrapers, official documentation verification, and registering research assets into Sources/Deep Research & Intelligence Gathering.
---

# Pipeline Skill: Deep Research & Intelligence Gathering

## 1. Overview & Context
This skill operates inside the **Planning** loop stage of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It conducts deep searches, scrapes authoritative web sources, fetches technical documentations, PDFs, and competitor breakdowns, and indexes findings into **Sources/Deep Research & Intelligence Gathering**.

## 2. Phase Operational Rules
- **Loop Status**: Active Loop until User Approval Gate is passed or EFFORT depth rounds complete.
- **Evolutionary Tracking (Round > 1)**: Flags already processed URLs, papers, and datasets to prevent redundant re-crawling.
- **Inputs**: Strategic parameters from `Sources/Discovery & Scoping`.
- **Outputs**: Structured Research Papers, API Schemas, Benchmark Summaries in `Sources/Deep Research & Intelligence Gathering`.

## 3. Step-by-Step Workflow
1. **Query Formulation**: Extract key entities, technical requirements, and market benchmarks from Discovery scoping.
2. **Multi-Vector Web Research**: Query authoritative documentation, official SDK repos, industry reports, and competitor landscapes.
3. **De-duplication & Intelligence Indexing**: Filter out duplicate research outputs across rounds.
4. **Register Source Item**: Store intelligence summaries and raw data assets under `Sources -> Deep Research & Intelligence Gathering`.

## 4. Sub-Domain Mapping & Extensions
- `/skills/pipeline_Planning/pipeline_Planning_Deep-Research_Intelligence-Gathering/domain-api-docs-research`
- `/skills/pipeline_Planning/pipeline_Planning_Deep-Research_Intelligence-Gathering/domain-competitor-scraping`
