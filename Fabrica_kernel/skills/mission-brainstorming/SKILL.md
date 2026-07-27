# Brainstorming Mode — Agent

## Metadata
- **What**: Creative exploration engine for system design, product concepts, and visual directions; generates diverse design paths and synthesizes selections into blueprints.
- **When**: Triggered at the start of build, system design, or strategic planning tasks requiring exploration before commitment.
- **Why**: Prevents tunnel vision by surfacing distinct paths backed by real precedents for informed architectural choices.
- **Triggers**: Invoked by build or optimization pipeline steps or creative user briefs.
- **Inputs**: User brief or concept (free text or JSON), optional raw reference files (`raw_data`).
- **Outputs**: Option cards (3+ directions in `missions.qa_state`), confirmed blueprint.

## Rules
1. **Strict Context Alignment**: Only perform actions defined by the brainstorming mode.
2. **No Assumptions**: Reference official coding library specifications exclusively.
3. **Isolated Testing**: Verify each component independently after updates.

## Handoffs
- **Receives from**: User (via mission creation) or Pipeline step
- **Delivers to**: User (QA panel for option selection) → then back to calling pipeline step

---

## Indexer
Below is the directory index of all supporting files organized across `workflows/`, `rules/`, and `references/`:

### Workflows
- **`workflows/brief_interpretation.md`**:
  - **What**: Parses raw inputs, maps goals, surfaces ambiguities, and produces a structured problem map.
  - **When**: Always the first step in brainstorming execution.
  - **Why**: Prevents downstream ideation on vague or misunderstood inputs.
  - **Triggers**: Start of brainstorming mission phase.

- **`workflows/creative_ideation.md`**:
  - **What**: Generates diverse creative directions and conceptual options from the problem map.
  - **When**: Executed after brief interpretation.
  - **Why**: Ensures options are distinct and novel rather than incremental variations.
  - **Triggers**: Completion of brief interpretation.

- **`workflows/options_presentation.md`**:
  - **What**: Formats 3+ options into structured QA cards with rationale for user selection.
  - **When**: Executed after ideation; writes to `missions.qa_state`.
  - **Why**: Provides clear, comparable choices with explicit engineering reasoning.
  - **Triggers**: Output generation for user QA gate.

- **`workflows/precedents_research.md`**:
  - **What**: Queries SaaS/UI/UX patterns and market benchmarks to ground ideation.
  - **When**: Executed in parallel with creative ideation.
  - **Why**: Ensures design directions are inspired by proven industry precedents.
  - **Triggers**: Ideation pass initiation.

- **`workflows/layout_synthesis.md`**:
  - **What**: Translates confirmed option selection into a final actionable blueprint.
  - **When**: Executed after user submits option selection in QA panel.
  - **Why**: Converts abstract user choices into concrete architectural blueprints.
  - **Triggers**: User QA option selection submission.

### Rules
- *(No specific sub-rule files present in this mode; governance rules defined in root SKILL.md)*

### References
- **`references/creative_brief_template.md`**:
  - **What**: Standard template for structuring creative problem statements.
  - **When**: Referenced during brief interpretation.
  - **Why**: Ensures consistent problem framing across brainstorming tasks.
  - **Triggers**: Brief structure validation.

- **`references/competitor_analysis_template.md`**:
  - **What**: Template for competitive landscape and benchmark analysis.
  - **When**: Consulted during precedents research.
  - **Why**: Standardizes market comparison matrices.
  - **Triggers**: Market research pass.

- **`references/ui_pattern_references.md`**:
  - **What**: Curated modern UI/UX design pattern library.
  - **When**: Referenced during creative ideation and layout synthesis.
  - **Why**: Guarantees adherence to anti-slop visual design standards.
  - **Triggers**: Layout design pass.


