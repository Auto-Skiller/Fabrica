# Deep Research Mode — Agent

## Metadata
- **What**: Authoritative multi-vector knowledge retrieval engine that queries official docs, verifies API structures, extracts typed code snippets, flags integration blockers, and fetches video transcripts.
- **When**: Triggered whenever verified external knowledge is required to make technical decisions during research steps or standalone queries.
- **Why**: Eliminates hallucinated APIs and deprecated packages by grounding decisions in live, verified documentation.
- **Triggers**: Invoked by build, test, optimization pipeline steps or research queries.
- **Inputs**: Research topic list, target domain/technology string, optional YouTube search subject.
- **Outputs**: Research reference sheet (topics, references, snippets, blockers, transcripts).

## Rules
1. **Strict Context Alignment**: Only perform actions defined by the deep_research mode.
2. **No Assumptions**: Reference official coding library specifications exclusively.
3. **Isolated Testing**: Verify each component independently after updates.

## Handoffs
- **Receives from**: Calling pipeline step (structured topic list)
- **Delivers to**: Calling pipeline step (structured reference sheet JSON)

---

## Indexer
Below is the directory index of all supporting files organized across `workflows/`, `rules/`, and `references/`:

### Workflows
- **`workflows/keyword_generation.md`**:
  - **What**: Generates targeted search keywords and boolean query phrases.
  - **When**: Always executed first in research cycles.
  - **Why**: Determines relevance and quality of search results.
  - **Triggers**: Research task initiation.

- **`workflows/official_source_query.md`**:
  - **What**: Queries official, authoritative documentation endpoints exclusively.
  - **When**: Executed after search keyword generation.
  - **Why**: Eliminates reliance on deprecated forums or hallucinated APIs.
  - **Triggers**: Primary research pass.

- **`workflows/api_verification.md`**:
  - **What**: Verifies API endpoints, auth scopes, and request/response structures.
  - **When**: Executed whenever integrating external services.
  - **Why**: Prevents broken API integrations and runtime type mismatches.
  - **Triggers**: API research task.

- **`workflows/snippet_extraction.md`**:
  - **What**: Extracts typed code snippets and lazy-loading guards from official docs.
  - **When**: Applied after retrieving official documentation.
  - **Why**: Delivers actionable implementation patterns to build/optimization modes.
  - **Triggers**: Documentation retrieval complete.

- **`workflows/blocker_detection.md`**:
  - **What**: Identifies integration blockers (billing requirements, rate limits, missing keys).
  - **When**: Applied as a final verification pass over research outputs.
  - **Why**: Prevents pipeline execution halts caused by hidden access locks.
  - **Triggers**: Research summary pass.

- **`workflows/youtube_research.md`**:
  - **What**: Selects authoritative YouTube videos and extracts complete transcripts.
  - **When**: Executed when video tutorials contain vital implementation details.
  - **Why**: Captures practical edge cases not covered in static docs.
  - **Triggers**: Video research request.

### Rules
- **`rules/youtube_ranking_criteria.md`**:
  - **What**: Ranking criteria for evaluating video recency, authority, and accuracy.
  - **When**: Consulted during video selection.
  - **Why**: Filters out low-quality or outdated video content.
  - **Triggers**: YouTube research filter pass.

### References
- **`references/source_registry.md`**:
  - **What**: Registry of authoritative documentation URLs per tech domain.
  - **When**: Referenced during official source queries.
  - **Why**: Restricts search boundaries to trusted domains.
  - **Triggers**: Search domain lookup.

- **`references/search_strategy_guide.md`**:
  - **What**: Strategies for effective technical documentation querying.
  - **When**: Referenced when refining queries.
  - **Why**: Maximizes search precision.
  - **Triggers**: Query optimization.


