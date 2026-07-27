# Test Mode — Agent

## Metadata
- **What**: Verification and quality gating engine for identifying test scope, running compilers/linters, verifying multi-tenant RLS security, and compiling pass/fail matrices.
- **When**: Triggered after build or optimization tasks to validate correctness, type safety, and security; also primary mode for test pipelines.
- **Why**: Maintains zero-defect deployment standards and prevents compilation errors, type mismatches, and security leaks from reaching production.
- **Triggers**: Quality gate after build/optimization execution or test pipeline missions.
- **Inputs**: Testing blueprint, code snapshot / source files (`system_components`), optional test data (`raw_data`).
- **Outputs**: Validation matrix (`missions.workflow_history`), compilation/lint reports.

## Rules
1. **Strict Context Alignment**: Only perform actions defined by the test mode.
2. **No Assumptions**: Reference official coding library specifications exclusively.
3. **Isolated Testing**: Verify each component independently after updates.

## Handoffs
- **Receives from**: phase-execution.md (blueprint + code) OR calling pipeline step
- **Delivers to**: phase-execution.md (validation matrix → pass/fail gate)

---

## Indexer
Below is the directory index of all supporting files organized across `workflows/`, `rules/`, and `references/`:

### Workflows
- *(No specific workflow sub-files; test execution is governed by rules and runners)*

### Rules
- **`rules/scope_rules.md`**:
  - **What**: Rules for defining test scope (modules, endpoints, DB tables, and RLS policies).
  - **When**: Always executed first before test design.
  - **Why**: Focuses testing cycles on actual failure boundaries.
  - **Triggers**: Test planning pass.

- **`rules/scenario_rules.md`**:
  - **What**: Rules for designing positive, negative, and extreme edge-case test scenarios.
  - **When**: Applied after scope definition.
  - **Why**: Ensures comprehensive scenario coverage before execution.
  - **Triggers**: Scenario generation pass.

- **`rules/compiler_rules.md`**:
  - **What**: Rules for running lint and compilation with a zero-error policy.
  - **When**: Executed immediately after source file creation or edits.
  - **Why**: Guarantees codebase remains in a known-good state.
  - **Triggers**: Post-edit compiler check.

- **`rules/rls_rules.md`**:
  - **What**: Rules for verifying multi-tenant Row-Level Security isolation.
  - **When**: Enforced whenever database schema or queries are modified.
  - **Why**: Prevents multi-tenant data leaks.
  - **Triggers**: DB query verification pass.

- **`rules/validation_rules.md`**:
  - **What**: Rules for formatting and logging validation results and pass/fail matrices.
  - **When**: Applied after all test scenarios complete.
  - **Why**: Provides clear audit trails in `missions.workflow_history`.
  - **Triggers**: Test run completion.

### References
- **`references/jest_vitest_setup.md`**:
  - **What**: Setup and config patterns for Jest and Vitest.
  - **When**: Referenced when initializing test runners.
  - **Why**: Standardizes test harness configurations.
  - **Triggers**: Runner initialization.

- **`references/mock_patterns.md`**:
  - **What**: Mocking strategies for Supabase, Express routes, and external APIs.
  - **When**: Referenced during unit test scaffolding.
  - **Why**: Enables isolated unit testing without external network calls.
  - **Triggers**: Mock setup pass.

- **`references/rls_test_patterns.md`**:
  - **What**: Test patterns for verifying multi-tenant RLS isolation per tenant.
  - **When**: Consulted when writing RLS security tests.
  - **Why**: Provides verified patterns for tenant boundary testing.
  - **Triggers**: RLS test design.

- **`references/test_data_samples.md`**:
  - **What**: Sample datasets for testing edge cases and realistic data loads.
  - **When**: Referenced when designing data payloads.
  - **Why**: Provides instant test fixtures.
  - **Triggers**: Fixture generation pass.


