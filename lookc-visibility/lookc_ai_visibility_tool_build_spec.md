# LookC AI Visibility & Recommendation Tool

## Build Specification for Claude Code

## 1. Purpose

Build an internal tool for LookC that monitors how AI systems describe, mention, cite, and recommend LookC across a defined set of prompts, then turns those observations into clear, evidence-backed recommendations for content and positioning work.

This is **not** a multi-tenant SaaS product.

This is **not** a billing product.

This is **not** an attribution-first analytics platform.

This is an **internal strategy tool** for the LookC team.

Its job is to answer these questions repeatedly and reliably:

1. Does LookC appear in relevant AI answers?
2. How prominently does LookC appear?
3. Which competitors appear instead?
4. Which domains and pages are cited as evidence?
5. Which conceptual categories does AI associate LookC with?
6. What content or positioning should we create next to improve visibility?

---

## 2. Product Principles

These are hard rules for the build.

### 2.1 Core product principles

- Optimisation-first, monitoring-backed.
- Internal-use-first, not customer-facing SaaS.
- Deterministic scoring, LLM-assisted interpretation.
- Store raw outputs before parsing anything.
- Every recommendation must be traceable to stored evidence.
- Avoid fake precision.
- Avoid overbuilding.
- Keep architecture boring, explicit, typed, and modular.

### 2.2 Things the system must not pretend to know

- Do not claim exact ranking when the answer format is ambiguous.
- Do not claim causal attribution from mention data alone.
- Do not infer that a citation caused a recommendation unless explicitly supported.
- Do not present stochastic one-off runs as stable truths.
- Do not treat all prompt types as equally important.

### 2.3 Product constraints

- Single internal project to start: LookC.
- No auth beyond basic internal protection in v1 if needed.
- No Stripe.
- No teams or permissions model in v1.
- No external client reporting features required in v1.
- No browser pixel or on-site AI traffic tracking in v1.
- No content publishing automation in v1.

---

## 3. Core User Story

As the LookC team, we want to run a recurring set of AI prompts against selected engines, capture the responses, extract structured visibility data, score LookC’s presence and evidence strength, compare against competitors, and generate prioritised recommendations for content and positioning.

---

## 4. Primary Workflow

### 4.1 Input

The system has:
- a project called LookC
- a list of prompt clusters
- a list of prompts in each cluster
- target engines
- a run schedule
- a list of tracked competitors

### 4.2 Execution

For each scheduled run:
1. Execute each prompt against each enabled engine.
2. Store the raw prompt request and raw response.
3. Parse the response into structured observations.
4. Score LookC visibility and evidence.
5. Score competitors.
6. Group weak areas into opportunity clusters.
7. Generate evidence-backed recommendations.
8. Surface all of this in the dashboard.

### 4.3 Output

The system should make it easy to answer:
- Where is LookC visible?
- Where is LookC absent?
- Where is LookC cited rather than merely mentioned?
- Which competitors dominate each prompt cluster?
- What themes appear in responses where LookC is absent?
- What page or content type should we create next?

---

## 5. Prompt Taxonomy

Use these prompt clusters as first-class entities.

### 5.1 Clusters

1. Agent Knowledge Layers
2. Agent Memory Systems
3. Alignment with Company Context
4. Data Connectors for Agents
5. Agent Governance and Safety
6. Agent Learning Systems
7. General Agent Infrastructure
8. Brand Awareness

Each prompt must belong to exactly one cluster.

Each prompt must also have:
- strategic weight
- enabled/disabled flag
- notes field

### 5.2 Prompt entity requirements

Each prompt record must include:
- id
- project_id
- cluster
- prompt_text
- strategic_weight
- language
- region
- enabled
- notes
- created_at
- updated_at

`strategic_weight` should default to 1.0 but support decimal values such as:
- 1.25 for very important prompts
- 1.0 for normal prompts
- 0.75 for secondary prompts
- 0.5 for low-priority exploratory prompts

---

## 6. Engines

### 6.1 v1 engine support

Design engine support as pluggable adapters.

The architecture must support multiple engines, even if only one or two are enabled at first.

Each engine adapter must expose a consistent interface:
- execute prompt
- return raw response
- return response metadata
- return execution status
- return timing data

### 6.2 Engine adapter interface

Each adapter should implement something equivalent to:

- `name`
- `runPrompt(input)`
- `normalizeRawResponse(output)`
- `extractCitationsIfAvailable(output)`
- `extractMetadata(output)`

### 6.3 Engine run requirements

For every engine run, store:
- engine name
- prompt text
- prompt cluster
- request timestamp
- response timestamp
- raw response text
- raw structured payload if available
- error state if failed
- latency
- status

---

## 7. Data Model

Use a relational database. PostgreSQL is the target.

The schema must be normalised enough for reliable querying, but not fragmented into absurdity.

### 7.1 Required tables

#### `projects`
Fields:
- id
- name
- slug
- domain
- brand_name
- status
- created_at
- updated_at

#### `competitors`
Fields:
- id
- project_id
- name
- domain nullable
- notes nullable
- created_at
- updated_at

#### `prompt_clusters`
Fields:
- id
- project_id
- key
- label
- description nullable
- created_at
- updated_at

#### `prompts`
Fields:
- id
- project_id
- cluster_id
- prompt_text
- strategic_weight decimal
- language
- region
- enabled boolean
- notes nullable
- created_at
- updated_at

#### `runs`
Represents a batch execution.
Fields:
- id
- project_id
- trigger_type
- status
- started_at
- completed_at nullable
- notes nullable
- created_at
- updated_at

#### `prompt_runs`
Represents a single prompt executed on a single engine within a batch run.
Fields:
- id
- run_id
- project_id
- prompt_id
- engine
- status
- requested_at
- responded_at nullable
- latency_ms nullable
- error_message nullable
- created_at
- updated_at

#### `raw_engine_responses`
Fields:
- id
- prompt_run_id
- raw_response_text
- raw_payload_json nullable
- created_at

#### `extracted_observations`
Fields:
- id
- prompt_run_id
- project_id
- prompt_id
- cluster_key
- engine
- run_timestamp
- region
- language
- brand_mentioned boolean
- brand_display_name nullable
- brand_position nullable
- brand_mention_count integer
- brand_is_primary_recommendation boolean
- brand_mention_strength
- brand_sentiment
- brand_summary nullable
- competitor_count integer
- citations_present boolean
- third_party_roundup_present boolean
- comparison_style_answer boolean
- answer_format
- lookc_url_cited boolean
- lookc_page_cited nullable
- reason_brand_not_included nullable
- reason_brand_included nullable
- confidence_score decimal
- parser_version
- created_at
- updated_at

#### `mentioned_competitors`
Fields:
- id
- extracted_observation_id
- competitor_name
- position nullable
- mention_strength
- sentiment
- is_known_competitor boolean
- created_at

#### `response_citations`
Fields:
- id
- extracted_observation_id
- domain
- url nullable
- page_type
- is_lookc_domain boolean
- created_at

#### `detected_themes`
Fields:
- id
- extracted_observation_id
- theme_type
- theme_value
- created_at

`theme_type` enum candidates:
- lookc_positioning_detected
- missing_capabilities_or_themes
- dominant_themes_in_answer

#### `content_opportunities`
Fields:
- id
- project_id
- prompt_id nullable
- cluster_id nullable
- title
- summary
- opportunity_type
- recommended_page_type
- priority_score decimal
- confidence_score decimal
- supporting_evidence_json
- status
- created_at
- updated_at

#### `scores`
Fields:
- id
- project_id
- run_id nullable
- prompt_id nullable
- cluster_id nullable
- score_type
- score_value decimal
- created_at

This table allows storage of derived metrics without recalculating everything on every page load.

---

## 8. Enums

Use explicit enums or string unions consistently across schema, API and UI.

### 8.1 `run_status`
- pending
- running
- completed
- failed
- partial

### 8.2 `trigger_type`
- manual
- scheduled
- backfill
- test

### 8.3 `brand_mention_strength`
- none
- weak
- moderate
- strong

### 8.4 `brand_sentiment`
- positive
- neutral
- mixed
- negative
- not_applicable

### 8.5 `answer_format`
- tool_list
- comparison
- narrative
- step_by_step
- definition
- mixed
- unknown

### 8.6 `page_type`
- homepage
- docs
- blog
- comparison
- landing_page
- pricing
- api_reference
- case_study
- faq
- glossary
- unknown

### 8.7 `reason_brand_not_included`
- brand_unknown
- competitors_better_match
- insufficient_category_association
- lack_of_cited_content
- prompt_too_broad
- unclear

### 8.8 `reason_brand_included`
- strong_category_match
- clear_positioning
- relevant_cited_content
- brand_awareness
- prompt_alignment
- unclear

### 8.9 `content_opportunity_type`
- new_landing_page
- comparison_page
- thought_leadership_article
- docs_page
- use_case_page
- faq_page
- glossary_page
- positioning_update

### 8.10 `opportunity_status`
- open
- accepted
- dismissed
- completed

### 8.11 `score_type`
- mention_rate
- visibility_score
- evidence_score
- citation_rate
- average_position_score
- competitor_share_of_mention
- opportunity_score
- volatility

---

## 9. Response Extraction Schema

The parser must output structured JSON with stable fields.

### 9.1 High-level schema

Each parsed response must include four logical sections:
- run metadata
- brand visibility
- competition and citations
- recommendation inputs

### 9.2 Canonical parser output shape

```json
{
  "project_id": "uuid",
  "prompt_id": "uuid",
  "prompt_text": "How do companies keep AI agents aligned with internal knowledge?",
  "prompt_cluster": "alignment_with_company_context",
  "engine": "perplexity",
  "run_id": "uuid",
  "run_timestamp": "2026-03-15T12:00:00Z",
  "region": "uk",
  "language": "en",
  "raw_response": "...",
  "brand_visibility": {
    "brand_mentioned": true,
    "brand_display_name": "LookC",
    "brand_position": 2,
    "brand_mention_count": 2,
    "brand_is_primary_recommendation": false,
    "brand_mention_strength": "moderate",
    "brand_sentiment": "positive",
    "brand_summary": "LookC is framed as a self-updating knowledge layer for AI agents."
  },
  "competition_and_citations": {
    "competitors_mentioned": [
      {
        "name": "LangChain",
        "position": 1,
        "mention_strength": "strong",
        "sentiment": "positive"
      }
    ],
    "competitor_count": 1,
    "citations_present": true,
    "cited_domains": ["lookc.ai", "docs.langchain.com"],
    "cited_urls": ["https://lookc.ai/", "https://docs.langchain.com/..."],
    "cited_page_types": ["homepage", "docs"],
    "third_party_roundup_present": false,
    "comparison_style_answer": true,
    "answer_format": "comparison",
    "lookc_url_cited": true,
    "lookc_page_cited": "https://lookc.ai/"
  },
  "recommendation_inputs": {
    "lookc_positioning_detected": ["knowledge layer", "agent alignment"],
    "missing_capabilities_or_themes": [],
    "dominant_themes_in_answer": ["context management", "enterprise knowledge"],
    "reason_brand_not_included": null,
    "reason_brand_included": "strong_category_match",
    "content_opportunity_type": "use_case_page",
    "content_opportunity_summary": "Create a dedicated page on keeping AI agents aligned with changing company knowledge.",
    "recommended_page_type": "use_case_page",
    "recommended_topic_title": "How to Keep AI Agents Aligned With Company Knowledge",
    "confidence_score": 0.86
  }
}
```

### 9.3 Parser requirements

- Parser must preserve raw response separately from parsed structure.
- Parser must be versioned.
- Re-parsing old data with a new parser version must be possible.
- Parser must never silently drop malformed data.
- Parser failures must be logged.
- Partial parser output is acceptable if marked clearly.

---

## 10. Scoring Model

Scoring must be deterministic.

The LLM may assist with extraction and recommendation language, but not with the numeric scoring formulas themselves.

### 10.1 Position weights

Map brand position to a numeric weight:
- position 1 -> 1.0
- position 2 -> 0.8
- position 3 -> 0.6
- position 4 -> 0.4
- position 5 or more -> 0.2
- null or absent -> 0

### 10.2 Mention strength weights

- none -> 0
- weak -> 0.33
- moderate -> 0.66
- strong -> 1.0

### 10.3 Primary recommendation weight

- true -> 1.0
- false -> 0

### 10.4 Citation weight

- LookC directly cited -> 1.0
- LookC mentioned but not cited -> 0.4
- LookC not mentioned -> 0

### 10.5 Prompt visibility score

Formula:

`visibility_score = (position_weight * 0.45) + (mention_strength_weight * 0.35) + (primary_weight * 0.20)`

Range: 0 to 1.

### 10.6 Evidence score

Formula:

`evidence_score = citation_weight`

Range: 0 to 1.

### 10.7 Final prompt score

Formula:

`final_prompt_score = (visibility_score * 0.75) + (evidence_score * 0.25)`

Range: 0 to 1.

### 10.8 Mention rate

Formula:

`mention_rate = count(prompts where brand_mentioned = true) / total_prompts`

### 10.9 Citation rate

Formula:

`citation_rate = count(prompts where lookc_url_cited = true) / total_prompts`

### 10.10 Project visibility score

Formula:

`project_visibility_score = average(final_prompt_score across included prompt runs) * 100`

Range: 0 to 100.

### 10.11 Cluster visibility score

Formula:

`cluster_visibility_score = average(final_prompt_score for prompt runs in cluster) * 100`

### 10.12 Competitor share of mention

For each competitor:

`competitor_share_of_mention = total_mentions_of_competitor / total_mentions_of_all_tracked_tools`

### 10.13 Competitive gap score

For each prompt:

`competitive_gap_score = max_competitor_prompt_score - lookc_prompt_score`

Where competitor prompt score should mirror the LookC prompt score model as closely as possible using extracted competitor position and mention strength.

### 10.14 Opportunity score

Formula:

`opportunity_score = ((1 - lookc_prompt_score) * 0.35) + (top_competitor_score * 0.25) + (citations_present_weight * 0.15) + (strategic_prompt_weight_normalized * 0.15) + (parser_confidence * 0.10)`

Where:
- `citations_present_weight = 1.0 if citations exist else 0.3`
- `strategic_prompt_weight_normalized` should scale prompt strategic weights into a 0 to 1 range
- `parser_confidence` should already be 0 to 1

### 10.15 Volatility

For repeated prompt runs over time:

`volatility = standard_deviation(final_prompt_score across recent runs for the same prompt and engine)`

This should be stored as a derived metric.

---

## 11. Recommendation Generation Rules

Recommendations must be grounded in deterministic thresholds before any LLM writes the human-readable summary.

### 11.1 Recommendation trigger conditions

Create a recommendation candidate when all of the following are true:
- average LookC score for a prompt or theme is below 0.35
- top competitor score is above 0.6
- citations exist in at least 50% of relevant runs
- volatility is below a configurable threshold

### 11.2 Recommendation grouping

Do not generate noisy one-prompt recommendations if multiple prompts point to the same thematic weakness.

Group by:
- cluster
- dominant themes
- missing capabilities/themes
- recommended page type

### 11.3 Recommendation output requirements

Each recommendation must include:
- title
- short summary
- recommended page type
- recommended topic title
- priority score
- confidence score
- supporting prompts
- supporting competitor names
- cited domains/pages that informed it
- linked evidence references

### 11.4 Recommendation writing rules

The narrative recommendation can be LLM-generated, but it must:
- reference actual evidence fields
- avoid fabricated claims
- avoid certainty language when evidence is weak
- mention if volatility is high
- distinguish between mention gaps and citation gaps

---

## 12. Site Crawling and Page Analysis

This is optional in the very first technical slice, but should be designed for in the model and service boundaries.

### 12.1 Goal

Analyse LookC pages and competitor pages that are cited in AI responses, then compare content patterns.

### 12.2 Minimum crawler requirements

- Crawl a given URL
- Store title, meta description, headings, page type guess, main text extract
- Support recrawling with timestamps
- Do not block overall system if crawling fails

### 12.3 Stored page fields

Use a future `site_pages` / `page_crawls` model with fields such as:
- id
- project_id nullable
- domain
- url
- title nullable
- meta_description nullable
- h1 nullable
- headings_json nullable
- body_text nullable
- page_type nullable
- crawl_timestamp
- crawl_status
- created_at

### 12.4 Future content comparison use cases

- Which page types get cited most often for each cluster?
- Are competitor docs or thought-leadership pages winning?
- Is LookC missing page types that frequently get cited?
- Which repeated themes appear in winning pages?

---

## 13. Services and Module Boundaries

The codebase must be modular.

### 13.1 Required modules

#### `collector`
Responsibilities:
- execute prompt runs
- interact with engine adapters
- persist raw responses
- handle retries and failures

#### `parser`
Responsibilities:
- transform raw responses into structured extraction output
- validate output shape
- persist observations, competitors, citations and themes

#### `scoring`
Responsibilities:
- compute deterministic metrics
- store aggregated scores
- expose reusable scoring functions

#### `recommendations`
Responsibilities:
- identify candidate weaknesses
- group opportunities by theme
- generate structured recommendation payloads
- generate final narrative copy with evidence inputs only

#### `dashboard`
Responsibilities:
- read and display metrics and recommendations
- never contain business logic that belongs in scoring or recommendations

#### `scheduler`
Responsibilities:
- launch runs on schedule
- support manual and scheduled executions
- ensure idempotency where possible

---

## 14. API Requirements

Use typed server functions or API routes depending on chosen stack, but keep interfaces explicit.

### 14.1 Required endpoints / actions

- create project
- list projects
- create prompt cluster
- create prompt
- list prompts
- update prompt
- trigger run
- get runs
- get prompt runs
- get raw response
- get extracted observation
- get overview metrics
- get cluster metrics
- get competitor metrics
- get recommendations
- update recommendation status

### 14.2 Response design requirements

- Responses must be typed end to end.
- Use pagination for run history.
- Support filtering by engine, cluster, and date range.
- Support selecting latest run vs historical trend.

---

## 15. Dashboard Requirements

The UI should be simple, internal, and useful. Not theatrical.

### 15.1 Overview screen

Must show:
- project visibility score
- evidence score
- mention rate
- citation rate
- top competitor
- biggest opportunity cluster
- recent trend

### 15.2 Cluster view

Must show for each cluster:
- mention rate
- average visibility score
- citation rate
- competitor dominance
- recent trend

### 15.3 Prompt explorer

Must show:
- prompt text
- cluster
- latest score
- LookC mentioned yes/no
- LookC cited yes/no
- top competitors
- answer format
- raw response link
- observation details

### 15.4 Recommendation view

Must show:
- title
- priority score
- confidence score
- recommended page type
- suggested topic title
- supporting evidence
- status

### 15.5 Raw run history

Must show:
- run timestamp
- engine
- prompt
- status
- latency
- raw response access
- extracted observation access

---

## 16. Job Scheduling Requirements

### 16.1 Scheduling

Support:
- manual run of all prompts
- manual run of selected prompts
- scheduled run of all enabled prompts

### 16.2 Retry policy

- failed prompt runs should be retryable without rerunning the entire batch
- retry attempts must be logged
- hard failures must not delete earlier successful prompt runs

### 16.3 Idempotency

A rerun should create a new prompt run record, not overwrite old data.

Historical comparison is a core feature.

---

## 17. Validation and Testing Requirements

### 17.1 Unit tests

Must cover:
- scoring functions
- enum mappings
- prompt score calculations
- cluster aggregation logic
- opportunity score calculations
- volatility calculation

### 17.2 Parser validation tests

Must cover:
- valid structured parser output
- partial parser output
- malformed parser output
- missing optional fields
- parser versioning behaviour

### 17.3 Integration tests

Must cover:
- end-to-end prompt run persistence
- raw response storage
- extraction persistence
- score generation
- recommendation generation

### 17.4 Golden test cases

Create a small library of golden raw responses with known expected extraction outputs and scores.

This is essential. Otherwise the system will drift quietly like a sneaky little goblin.

---

## 18. Error Handling Requirements

### 18.1 Collector failures

Must distinguish:
- engine timeout
- engine auth/config error
- malformed engine response
- temporary network failure
- unknown error

### 18.2 Parser failures

Must distinguish:
- invalid JSON output
- missing required fields
- enum mismatch
- low-confidence extraction

### 18.3 Dashboard behaviour

The UI must degrade gracefully:
- failed runs should be visible, not hidden
- partial data should be labelled clearly
- recommendations should not appear if evidence requirements are not met

---

## 19. Suggested Tech Stack

Use this unless there is a strong reason not to.

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- background jobs with Trigger.dev or Inngest
- zod for runtime validation
- a lightweight component system for internal UI

### 19.1 Architectural preference

Prefer:
- server-side data access
- explicit service functions
- shared types package if monorepo is used
- minimal client-side state where possible

---

## 20. Repo Structure

Use one of these two structures.

### 20.1 Simpler single-app structure

- `src/app`
- `src/components`
- `src/lib/db`
- `src/lib/collector`
- `src/lib/parser`
- `src/lib/scoring`
- `src/lib/recommendations`
- `src/lib/engines`
- `src/lib/scheduler`
- `src/lib/types`
- `src/lib/validation`
- `prisma`

### 20.2 Preferred modular structure if using workspace

- `apps/web`
- `packages/db`
- `packages/core`
- `packages/collector`
- `packages/parser`
- `packages/scoring`
- `packages/recommendations`
- `packages/ui`
- `workers/scheduler`

If there is any doubt, choose the simpler structure first.

---

## 21. TypeScript Type Requirements

All parser outputs, scores, recommendation payloads and API responses must have shared typed contracts.

### 21.1 Required type groups

- database model types
- parser output types
- scoring input/output types
- recommendation input/output types
- dashboard DTOs

### 21.2 Validation

Use zod schemas for:
- parser output validation
- API payload validation
- config validation
- enum constraints

---

## 22. Configuration

The system should support configuration for:
- enabled engines
- parser version
- prompt execution limits
- retry count
- volatility threshold
- recommendation thresholds
- default strategic weights

Config must be centralised and typed.

---

## 23. CLAUDE.md Requirements

The repo must include a root `CLAUDE.md` with persistent instructions.

It should contain at least:

### 23.1 Product instructions

- This is an internal tool for LookC.
- Prioritise clarity and evidence over flashy UI.
- The product is optimisation-first, not attribution-first.
- Recommendations must be evidence-backed.
- All numeric scoring must remain deterministic.
- Raw engine responses must be preserved before parsing.
- Do not collapse business logic into UI components.
- Prefer explicit typing and small modules.
- Avoid adding premature SaaS features.

### 23.2 Engineering instructions

- Use TypeScript strictly.
- Use zod for parser and payload validation.
- Keep scoring logic pure and unit tested.
- Keep parser outputs versioned.
- Never silently discard parser failures.
- Add comments only where they improve clarity.

---

## 24. Claude Code Task Plan

Claude Code should be instructed to build in phases.

### Phase 1 — foundation

Build:
- Next.js app scaffold
- Prisma setup
- database schema
- seed data for project, clusters, prompts
- internal dashboard shell

### Phase 2 — run pipeline

Build:
- run creation
- prompt run records
- raw response storage
- mock engine adapter if needed

### Phase 3 — parser

Build:
- parser types
- zod validation
- extraction persistence
- parser versioning fields

### Phase 4 — scoring

Build:
- pure scoring functions
- aggregate score generation
- score persistence
- tests for all formulas

### Phase 5 — recommendations

Build:
- candidate detection
- recommendation grouping
- recommendation persistence
- recommendation UI

### Phase 6 — scheduling and polish

Build:
- scheduled runs
- retry support
- trend charts
- filters and history views

---

## 25. Acceptance Criteria

The first usable version is complete when:

1. A LookC project exists in the database.
2. Prompt clusters and prompts can be stored and listed.
3. A batch run can be triggered manually.
4. Prompt runs and raw responses are stored reliably.
5. Parsed observations can be generated and stored.
6. Deterministic scores are computed and visible.
7. Competitor mentions and citations are queryable.
8. Recommendations are generated from threshold rules.
9. The dashboard shows overview, cluster views, prompt explorer, and recommendations.
10. Historical runs are preserved and comparable.

---

## 26. Non-Goals for v1

These are explicitly out of scope unless requested later.

- Multi-tenant SaaS architecture
- Billing
- User management
- Browser tracking pixel
- On-site conversion attribution
- Automatic content publishing
- Automated competitor crawling at scale
- Full BI/reporting suite
- Fine-grained role permissions
- Mobile-first product design

---

## 27. Initial Seed Data Requirements

Seed the database with:
- one project: LookC
- the eight prompt clusters
- the agreed prompt list
- a starter competitor list if provided

Do not leave the app empty on first boot.

---

## 28. Future Extensions

Design for these later, but do not implement by default now.

- competitor page crawling and analysis
- content pattern extraction from cited pages
- prompt mutation engine
- recommendation export to docs or tickets
- weekly emailed strategy report
- model-assisted prompt suggestion generation
- support for additional brands/projects

---

## 29. Build Quality Standard

The code should feel like a serious internal tool, not a hackathon costume.

That means:
- typed
- tested
- modular
- queryable
- traceable
- calm UI
- evidence-backed logic

No haunted abstractions.
No silent magic.
No fake certainty.

---

## 30. Implementation Order Instruction for Claude Code

Build the project in this exact order unless blocked:

1. schema and types
2. seed data
3. dashboard shell
4. run and raw-response pipeline
5. parser and validation
6. scoring and tests
7. recommendations and grouping
8. history and filters
9. scheduling

Do not jump ahead to polish before the data model and scoring are correct.

