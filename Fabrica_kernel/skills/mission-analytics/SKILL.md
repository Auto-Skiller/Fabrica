# Analytics Mode — Agent

## Metadata
- **What**: Purely descriptive and diagnostic cognitive engine for processing raw data, code snapshots, research outputs, and concepts into structured, machine-readable diagnostic reports.
- **When**: Triggered by pipeline steps requiring structured analytical evaluation before judgment or execution.
- **Why**: Provides a rigorous factual foundation that downstream pipeline steps and phases use to make prescriptive decisions.
- **Triggers**: Invoked by build, test, optimization pipelines or direct analytical user requests.
- **Inputs**: Raw data files (`raw_data`), code snapshots (`system_components`), research reference sheets, user selections, concept briefs.
- **Outputs**: Descriptive analytics report (structured JSON).

## Rules
1. **Strict Context Alignment**: Only perform actions defined by the analytics mode.
2. **No Assumptions**: Reference official coding library specifications exclusively.
3. **Isolated Testing**: Verify each component independently after updates.

## Handoffs
- **Receives from**: Calling pipeline step
- **Delivers to**: Calling pipeline step (structured descriptive JSON report)

---

## Indexer
Below is the directory index of all supporting files organized across `workflows/`, `rules/`, and `references/`:

### Workflows
- **`workflows/data_ingestion.md`**:
  - **What**: Parses and normalizes raw inputs (CSV, JSON, text, code) into a clean, typed form.
  - **When**: Always runs first during analytics mode execution.
  - **Why**: Ensures clean input normalization to prevent unreliable pattern downstream.
  - **Triggers**: Start of analytics ingestion phase.

- **`workflows/pattern_detection.md`**:
  - **What**: Identifies recurring patterns, structural regularities, and correlations across inputs.
  - **When**: Executed after initial data ingestion is complete.
  - **Why**: Uncovers hidden structural trends and regularities across large datasets.
  - **Triggers**: Post-ingestion analytics pass.

- **`workflows/frequency_analysis.md`**:
  - **What**: Computes precise counts, distributions, rates, and trend metrics.
  - **When**: Triggered when processing countable elements or log streams.
  - **Why**: Delivers exact quantitative metrics for downstream scoring.
  - **Triggers**: Quantitative analytics requirement.

- **`workflows/insight_extraction.md`**:
  - **What**: Surfaces notable factual observations without interpretation or speculation.
  - **When**: Executed after pattern detection completes.
  - **Why**: Condenses complex data patterns into actionable signals.
  - **Triggers**: Post-pattern processing pass.

- **`workflows/report_compilation.md`**:
  - **What**: Assembles descriptive findings into a unified, typed JSON report.
  - **When**: Final step of analytics mode.
  - **Why**: Guarantees parseable output schema for calling pipeline steps.
  - **Triggers**: Completion of all analytical sub-steps.

### Rules
- **`rules/anomaly_flagging.md`**:
  - **What**: Rules for detecting outliers, errors, security risks, and structural mismatches.
  - **When**: Applied during pattern analysis and report compilation.
  - **Why**: Ensures potential bugs, vulnerabilities, and data gaps are flagged immediately.
  - **Triggers**: Anomaly detection pass.

### References
- **`references/data_format_guide.md`**:
  - **What**: Reference standards for formatting analytical output streams.
  - **When**: Consulted when structuring descriptive JSON outputs.
  - **Why**: Ensures consistent syntax across all analytics modes.
  - **Triggers**: Output generation or schema design.

- **`references/output_schema_templates.md`**:
  - **What**: Standardized JSON output schemas for diagnostic reports.
  - **When**: Referenced during report compilation.
  - **Why**: Enforces predictable JSON payloads for downstream parsers.
  - **Triggers**: Report compilation phase.


