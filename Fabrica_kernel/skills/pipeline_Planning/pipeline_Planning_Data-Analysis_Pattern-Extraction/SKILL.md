---
name: pipeline_Planning_Data-Analysis_Pattern-Extraction
description: Data Analysis & Pattern Extraction skill for ingesting raw datasets, computing key metrics, extracting anomalies, and registering insights into Sources/Data Analysis & Pattern Extraction.
---

# Pipeline Skill: Data Analysis & Pattern Extraction

## 1. Overview & Context
This skill operates inside the **Planning** stage of the Fabrica 4-Stage Looped Pipeline (`Drafting -> Planning -> Execution -> Delivering`).
It ingests unstructured datasets, CSVs, logs, and research files to compute statistical metrics, detect anomalies, and extract actionable insights.

## 2. Phase Operational Rules
- **Loop Status**: Non-loop stage driven by Planning phase execution.
- **Inputs**: `Sources/Discovery & Scoping` + `Sources/Deep Research & Intelligence Gathering` + User uploaded raw files.
- **Outputs**: Analytical Insights, Pattern Maps, Metric Calculations stored in `Sources/Data Analysis & Pattern Extraction`.

## 3. Step-by-Step Workflow
1. **Dataset Ingestion**: Load raw CSVs, JSON logs, or document manifests.
2. **Metric Computation & Anomaly Detection**: Compute ratios, detect statistical outliers, evaluate trend lines.
3. **Pattern Extraction**: Categorize findings into operational opportunities and structural bottlenecks.
4. **Register Source Item**: Store analytical reports into `Sources -> Data Analysis & Pattern Extraction`.

## 4. Sub-Domain Mapping & Extensions
- `/skills/pipeline_Planning/pipeline_Planning_Data-Analysis_Pattern-Extraction/domain-financial-metrics`
- `/skills/pipeline_Planning/pipeline_Planning_Data-Analysis_Pattern-Extraction/domain-log-telemetry`
