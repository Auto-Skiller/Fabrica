# Phase Workflow: Planning

This workflow governs how the agent compiles findings, structures proposals, scores deliverables, and presents actionable task lists for user approval.

## 1. PURPOSE & INSTRUCTIONS
Planning is the gateway between cognitive analysis and physical execution. Its purpose is to formulate an unambiguous, step-by-step action plan. The plan must describe exactly *what* files will be touched, *what* tables will be written, and *what* visual assets will be modified, backed by a cost-benefit calculation.

When executing a Planning step:
1. **Consolidate Synthesis**: Fetch the final analytics blueprint (outcome of Analytics 4).
2. **Draft Task Deliverables (Cases)**: Divide the blueprint into highly concrete, individual items.
3. **Score Each Case**: For each task, assign explicit metrics:
   - **Benefit**: High/Medium/Low (Business impact, user-value).
   - **Cost**: High/Medium/Low (Estimated development time, token consumption, complexity).
   - **Worth-It**: Yes/No (The agent's final recommendation based on the ROI).
4. **Publish Proposal**: Write the structured cases and task lists directly into the database under `missions.workflow_history` and flip the status to **PLANNING**.

---

## 2. CONCRETE CASE CONSTRAINTS
- **No Abstract Steps**: A planning task must be a concrete, actionable move. An item like "classify inputs" or "evaluate routes" is forbidden in Planning. Instead, write exact steps like: "Create Express API proxy route inside `/src/routes/api.ts` to process requests."
- **One Functional Goal = One Case**: Group overlapping tasks under one concrete item rather than spamming 20 micro-items. This keeps the proposal highly scannable and easy to approve.
- **Reference Real Paths**: Always include exact file paths, database tables, or UI components affected by each task.

---

## 3. APPROVAL GATING & AUTO-EXECUTION
- **User Approval**: By default, the system remains locked in the PLANNING state. The agent must pause and wait for the user to click "Approve Execution" in the overlay panel.
- **Autonomy Mode**: If `app_config.settings.autonomy` is set to `true`, the planning phase is automatically approved. The agent will log the transition and immediately transition the mission to **EXECUTION** to start implementing.

---

## 4. EXPECTED OUTCOME STRUCTURE & SDK SCHEMAS
Every planning proposal must output a structured JSON plan stored under `missions.workflow_history` or processed via `/api/missions/generate-planning`. This is strictly enforced via the SDK's `responseSchema` using standard `@google/genai` types (`Type.OBJECT`, `Type.ARRAY`, `Type.STRING`) to guarantee 100% compliant JSON structures and eliminate erratic markdown backticks.

### Enforced SDK responseSchema Definition:
```typescript
export const missionPlanningSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Unambiguous summary of the planned actions" },
    cases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Unique snake_case identifier for the task" },
          title: { type: Type.STRING, description: "Descriptive task title" },
          concrete_step: { type: Type.STRING, description: "Clear, physical action step mentioning specific files and actions" },
          benefit: { type: Type.STRING, description: "HIGH | MEDIUM | LOW" },
          cost: { type: Type.STRING, description: "HIGH | MEDIUM | LOW" },
          worth_it: { type: Type.STRING, description: "YES | NO" }
        },
        required: ["id", "title", "concrete_step", "benefit", "cost", "worth_it"]
      },
      description: "List of concrete task cases with scored benefits and costs"
    }
  },
  required: ["summary", "cases"]
};
```

### Specific Inputs & Outputs:
- **Phase Inputs**: Finalized analysis blueprint (from Analytics 4 or `/api/missions/generate-analytics`).
- **Phase Outputs**: Compliant JSON payload matching `missionPlanningSchema` containing explicit task steps. No markdown wrap.


## Rules
1. **Compute ROI**: Every task must carry a Cost/Benefit score rated on a 1-10 matrix.
2. **Explicit Targeting**: List exact files, database columns, and UI components in the task plan.
3. **Tenant Security**: Ensure every planned query explicitly complies with RLS constraints.
4. **User Confirmation**: Require explicit user approval or autonomy mode activation before execution.

## Handoffs
- **Receives from**: Architectural Blueprint (step_7 of the calling pipeline)
- **Delivers to**: phase-execution.md after user approval or auto-execution trigger



# Phase Workflow: Execution

This workflow governs how the agent processes approved planning tasks sequentially, writes production-grade code, maintains transaction safety, and runs QA verifications.

## 1. PURPOSE & INSTRUCTIONS
Execution is the active development phase of the system. Its purpose is to process each approved case/task sequentially, modifying files or database schemas to achieve the final deployment. High rigor, attention to compiler output, and graceful error recovery are mandatory.

When executing an Execution step:
1. **Initialize Phase**: Flip `missions.status` to `execution` and log the start event in `runtime_state.recent_events`.
2. **Process Tasks Sequentially**: Pull the approved task list. Execute tasks one by one. Do not attempt to batch edit unconnected components in parallel.
3. **Surgical Writes & Backups**: Follow standard file operation rules. Maintain backup copies for complex programmatic database/schema updates.
4. **Iterative Linting & Compiling**: Immediately after editing a module, run `lint_applet` and `compile_applet`. Never let compilation errors accumulate.
5. **Log Outcomes**: Record progress in the `missions.workflow_history` task tracker, appending success or error status.

---

## 2. ERROR RECOVERY & ROBUSTNESS RULES
- **Graceful Fail-Safe**: If a build fails or a critical error is encountered, immediately reverse the last change to restore the system to a stable compiling state. Analyze the failure and try a different implementation approach.
- **Limit Failures**: If three consecutive distinct approaches fail, halt the execution loop, write a detailed blocker record inside `missions.qa_state`, notify the user, and wait for human intervention.
- **API Key Guard**: Ensure no execution logic initializes an external client with missing env keys. Handle missing keys gracefully by logging a warning and disabling only that integration, rather than crashing the full Express app server.

---

## 3. PROMOTION TO ARCHIVE
Once all approved tasks are successfully completed, type-checked, and linted, perform a final full-system build:
1. Run `compile_applet`.
2. If successful, write a summary of built systems to `system_components`.
3. Set `missions.status` to `archive` and `missions.phase` to `execution` (completed).
4. Append a final `[+] Mission Completed` log to the `runtime_state.recent_events` history list.


## Rules
1. **Surgical Writes**: Edit target files incrementally and atomically, never overwriting whole folders.
2. **Immediate Linting**: Run the linter (`lint_applet`) and compiler (`compile_applet`) after every single file modification to prevent error accumulation.
3. **No Sibling Side-effects**: Do not modify functions adjacent to the target unless they are explicitly within the impact zone.
4. **Validation Gate**: Execute full validation suites and create a system component artifact before archival.

## Handoffs
- **Receives from**: Approved task plan from phase-planning.md
- **Delivers to**: Production workspace and final archive state (archived via missions.status = 'archive')

