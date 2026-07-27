# Coding Mission Mode — Agent

## Metadata
- **What**: Integrated system logic formulation, TypeScript interface design, structural file scaffolding, surgical refactoring, security hardening, and performance tuning engine.
- **When**: Triggered during the Execution Phase when constructing new code modules or refactoring existing system components.
- **Why**: Guarantees type-safe, modular, and performant code that adheres to architectural blueprints without regressions or security vulnerabilities.
- **Triggers**: Execution tasks from build, optimization, or hybrid pipelines.
- **Inputs**: Approved build/refactoring tasks, architectural blueprints, code files (`system_components`), technology reference patterns.
- **Outputs**: Created/modified source files, updated `system_components` snapshots, build and execution logs.

## Rules
1. **Strict Context Alignment**: Only perform actions defined by the coding mode.
2. **No Assumptions**: Reference official coding library specifications exclusively.
3. **Isolated Testing**: Verify each component independently after updates.

## Handoffs
- **Receives from**: phase-execution.md (approved task + blueprint + existing code)
- **Delivers to**: phase-execution.md (patched files + log) → testing mode for verification

---

## Indexer
Below is the directory index of all supporting files organized across `workflows/`, `rules/`, and `references/`:

### Workflows
- **`workflows/architecture_scaffolding.md`**:
  - **What**: Rules and procedures for setting up project structures, directories, and file layouts.
  - **When**: Executed at the start of new module creation.
  - **Why**: Establishes clean architectural boundaries and prevents coupling.
  - **Triggers**: Initial scaffolding step.

- **`workflows/component_synthesis.md`**:
  - **What**: Standards for synthesizing responsive, accessible UI components.
  - **When**: Executed during frontend feature construction.
  - **Why**: Guarantees visual quality, mobile responsiveness, and token adherence.
  - **Triggers**: UI component build phase.

- **`workflows/logic_formulation.md`**:
  - **What**: Rules for formulating server-side API routes, state machines, and algorithms.
  - **When**: Executed during backend endpoint implementation.
  - **Why**: Ensures edge case handling, error safety, and proper key isolation.
  - **Triggers**: Backend route/service build step.

- **`workflows/build_verification.md`**:
  - **What**: Procedures for checking syntax, import correctness, and exports.
  - **When**: Applied immediately after code generation/edits.
  - **Why**: Eliminates broken imports and syntax errors before compilation.
  - **Triggers**: Post-code edit verification.

### Rules
- **`rules/impact_mapping_rules.md`**:
  - **What**: Rules for mapping affected downstream files and dependencies before editing.
  - **When**: Executed before modifying any existing code files.
  - **Why**: Prevents unintended side effects in sibling modules.
  - **Triggers**: Refactoring or edit initiation.

- **`rules/refactoring_rules.md`**:
  - **What**: Surgical editing rules (read-modify-write, target-block replacement).
  - **When**: Applied during code editing tasks.
  - **Why**: Preserves existing stable code while making targeted updates.
  - **Triggers**: Code edit execution.

- **`rules/security_rules.md`**:
  - **What**: Security hardening standards (key protection, input sanitization, SQL safety).
  - **When**: Enforced whenever handling credentials, user input, or external APIs.
  - **Why**: Guarantees defense-in-depth across client and server boundaries.
  - **Triggers**: API/Database code formulation.

- **`rules/performance_rules.md`**:
  - **What**: Rules for query tuning, caching, and lazy initialization.
  - **When**: Applied when tuning high-latency paths or heavy data handlers.
  - **Why**: Prevents performance degradation under production volume.
  - **Triggers**: Performance optimization pass.

- **`rules/regression_rules.md`**:
  - **What**: Audit rules to ensure existing contracts and layouts remain unbroken.
  - **When**: Applied after significant edits before marking tasks complete.
  - **Why**: Guarantees backward compatibility.
  - **Triggers**: Pre-completion audit pass.

- **`rules/refactoring_checklists.md`**:
  - **What**: Step-by-step checklists for complex code migrations.
  - **When**: Consulted during major refactoring workflows.
  - **Why**: Ensures complete task coverage during large modifications.
  - **Triggers**: Refactoring task execution.

### References
- **`references/interface_design.md`**:
  - **What**: Reference patterns for strict TypeScript interfaces and schema types.
  - **When**: Referenced when designing cross-layer data contracts.
  - **Why**: Guarantees type consistency between client, server, and DB.
  - **Triggers**: Schema/Type definition.

- **`references/nextjs_structure.md`**: Next.js routing and component conventions.
- **`references/react_component_patterns.md`**: React composition, custom hooks, and prop design.
- **`references/express_route_patterns.md`**: Express.js route structure, middleware, and handlers.
- **`references/supabase_query_patterns.md`**: Safe Supabase/PostgreSQL query patterns.
- **`references/security_patterns.md`**: Code snippets for input validation and RLS.
- **`references/caching_patterns.md`**: Server-side caching strategies.
- **`references/query_optimization.md`**: SQL index strategies and planner rules.
- **`references/odoo_integration.md`**: Odoo JSON-RPC/XML-RPC integration examples.
- **`references/n8n_workflow_patterns.md`**: n8n webhook and workflow payload references.
- **`references/typescript_patterns.md`**: Common TypeScript design patterns.


