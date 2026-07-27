# Mission Workflow: Standard

## Metadata
- **What**: Standard mission workflow for processing general work tasks, one-off updates, configuration patches, and quick maintenance routines.
- **When**: Invoked when handling standard, general-purpose tasks that do not fit into complex multi-step pipelines.
- **Why**: Provides a fast, flexible execution path for direct tasks, recurring maintenance rounds, and simple prototyping without unnecessary analytical overhead.
- **Triggers**: Standard mission created by user, scheduled maintenance interval, or fast-path task initiation.
- **Inputs**: User brief, optional raw data IDs, optional system component references.
- **Outputs**: Code/configuration changes, execution reports, updated mission state.

This workflow governs how the agent handles custom Standard missions, processing arbitrary inputs to produce arbitrary business outputs.

## 1. PURPOSE & INSTRUCTIONS
Standard missions are the default vehicle for general work tasks. Unlike specialized pipelines (which require a strict 7-step drafting sequence), a Standard mission can bypass the deep analytics/research steps to perform quick, direct tasks like updating a visual card, correcting a typo, or writing a custom database query.

Use standard missions for:
- One-off visual corrections, text updates, or configuration patches.
- Periodic, recurring maintenance tasks (such as checking database backup states or refreshing API tokens).
- Fast prototyping of simple client tools.

---

## 2. STRUCTURAL CHARACTERISTICS

### Recurring Rounds
A Standard mission can be configured to repeat automatically using two parameters under its database metadata:
- `rounds.status` (Boolean): If set to `true`, the mission restarts in PLANNING/EXECUTION status after completion.
- `rounds.persistent` (Boolean): If `true`, the mission repeats indefinitely. If `false`, it repeats up to a maximum round limit (`rounds.max`).

### Arbitrary Data Inputs
A Standard mission can link to any combination of `raw_data` or `system_components` records without requiring a strict schema structure.

---

## 3. FLEXIBLE DRAFTING PIPELINE
For Standard missions, the agent is permitted to compress the 7-step drafting process:
- **Direct Drafting**: Ingest the user's quick brief.
- **Shorthand Scoping**: Formulate the plan directly within a single Analytics/Planning cycle.
- **Immediate Execution**: Flip the status to Execution (or auto-execute under autonomy mode) and apply the changes.
- **Final Reporting**: Summarize the output and archive the card.


## Rules
1. **Direct Drafting**: Only bypass deep analytical phases if the task is a simple fix and does not modify shared database schemas.
2. **No Unapproved Writes**: Code edits must be defined in planning task lists and approved before execution.
3. **Safety Fallbacks**: Save existing configurations and create file backups before applying updates.

## Handoffs
- **Receives from**: User creation interface, user brief, or direct integration trigger
- **Delivers to**: phase-planning.md or the direct execution runner

