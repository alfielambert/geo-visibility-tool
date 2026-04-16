# Oiya AI Visibility Tool — Claude Code Handover Prompt

Paste this into Claude Code when opening the `lookc-visibility` project directory.

---

## Context

You are continuing development of the **Oiya AI Visibility & Recommendation Tool** — an internal strategy tool that monitors how AI systems describe, mention, cite, and recommend Oiya across a set of prompts, then generates evidence-backed recommendations for content and positioning.

**Brand**: Oiya (oiya.ai) — a shared knowledge layer that keeps AI agents aligned with company context. LookC is a legacy brand name and should be detected as an alias only.

The full build specification is in `lookc_ai_visibility_tool_build_spec.md` in the project root. **Important**: that spec still says "LookC" everywhere — treat every reference to "LookC" as meaning "Oiya". The codebase has already been updated to use Oiya as the primary brand and brand-generic field names (e.g. `brand_url_cited` not `lookc_url_cited`).

Read `CLAUDE.md` first — it has the corrected brand info, product principles, and engineering instructions.

## What has been built (Phase 1 — complete)

### Stack
- **Next.js 16** with App Router, TypeScript, Tailwind CSS v4
- **Drizzle ORM** with `@libsql/client` (SQLite for dev). Schema is designed for PostgreSQL migration later.
- **Zod** for validation schemas

### Database (13 tables, all created and working)
`projects`, `competitors`, `prompt_clusters`, `prompts`, `runs`, `prompt_runs`, `raw_engine_responses`, `extracted_observations`, `mentioned_competitors`, `response_citations`, `detected_themes`, `content_opportunities`, `scores`

Migration and seed scripts are `.mjs` files in `scripts/`:
- `node scripts/migrate.mjs` — creates all tables
- `node scripts/seed.mjs` — populates initial data
- `npm run db:reset` — drops DB, migrates, and reseeds

### Seed data (populated in dev.db)
- 1 project: **Oiya** (oiya.ai)
- 8 prompt clusters: Agent Knowledge Layers, Agent Memory Systems, Alignment with Company Context, Data Connectors for Agents, Agent Governance and Safety, Agent Learning Systems, General Agent Infrastructure, Brand Awareness
- 27 prompts across all clusters with strategic weights (0.75–1.25), reflecting Oiya's positioning as a shared knowledge layer for AI agent alignment
- 19 tracked competitors across 5 categories:
  - **Direct competitors** (shared knowledge/context layers): Egregore (egregore.xyz — shared cognition for teams and agents), Hyperspell (hyperspell.com — memory & context layer, YC F25), Edra (edra.ai — executable knowledge from operational data, Sequoia-backed)
  - **Agent memory/context**: Mem0, Zep, Letta, LangMem
  - **Agent frameworks**: LangChain, LlamaIndex, CrewAI, AutoGen
  - **Vector DBs / RAG infra**: Pinecone, Weaviate, Chroma, Qdrant
  - **Knowledge management**: Notion AI, Guru, Glean, Tettra

### Types & validation (complete)
- `src/lib/types/enums.ts` — all 12 enum groups from spec §8 (RunStatus, TriggerType, MentionStrength, BrandSentiment, AnswerFormat, PageType, ReasonBrandNotIncluded, ReasonBrandIncluded, ContentOpportunityType, OpportunityStatus, ScoreType, ThemeType, PromptClusterKey)
- `src/lib/validation/schemas.ts` — Zod schemas for canonical parser output (§9.2), brand visibility, competition & citations, recommendation inputs, competitor mentions, app config

### Scoring module (complete, untested)
- `src/lib/scoring/index.ts` — all 15 scoring functions from spec §10.1–§10.15 implemented as pure deterministic functions: `positionWeight`, `mentionStrengthWeight`, `primaryRecommendationWeight`, `citationWeight`, `visibilityScore`, `evidenceScore`, `finalPromptScore`, `mentionRate`, `citationRate`, `projectVisibilityScore`, `clusterVisibilityScore`, `competitorShareOfMention`, `competitiveGapScore`, `opportunityScore`, `volatility`
- **No unit tests yet** — spec §17.1 requires tests for all scoring functions. This should be done early in the next phase.

### Dashboard shell (placeholder UI only, not wired to data)
- `src/app/page.tsx` — Overview with 7 metric cards (hardcoded placeholder values)
- `src/app/clusters/page.tsx` — Cluster view with placeholder table
- `src/app/prompts/page.tsx` — Prompt explorer with placeholder table
- `src/app/recommendations/page.tsx` — Recommendations view with placeholder cards
- `src/app/runs/page.tsx` — Run history with placeholder table
- `src/components/Sidebar.tsx` — Navigation sidebar (client component, uses usePathname)
- `src/components/MetricCard.tsx` — Reusable metric display card
- Dark theme (slate/zinc palette), Tailwind utility classes, lucide-react icons

### Other files
- `CLAUDE.md` — product and engineering instructions with corrected brand info (read this first)
- `src/lib/db/schema.ts` — Drizzle ORM schema definition (13 tables)
- `src/lib/db/index.ts` — Database client singleton

### Empty module directories (created, no code yet)
- `src/lib/collector/` — prompt execution, engine adapters, raw response persistence
- `src/lib/parser/` — LLM-assisted response extraction into structured observations
- `src/lib/engines/` — pluggable engine adapters (OpenAI, Anthropic, Perplexity)
- `src/lib/recommendations/` — candidate detection, grouping, narrative generation
- `src/lib/scheduler/` — run scheduling, retry support

### Unused TypeScript files (can be deleted or consolidated)
- `src/lib/db/migrate.ts` and `src/lib/db/seed.ts` — these are TypeScript versions that are NOT used because tsx had IPC pipe permission issues in the original build environment. The working scripts are `scripts/migrate.mjs` and `scripts/seed.mjs`. You can consolidate if you get tsx working, or just delete the .ts versions.

## What needs to be built next

Follow the phased order from spec §30. Do not jump ahead to polish before data model and scoring are correct.

### Phase 2 — Run pipeline
- Engine adapter interface (spec §6.2): `name`, `runPrompt(input)`, `normalizeRawResponse(output)`, `extractCitationsIfAvailable(output)`, `extractMetadata(output)`
- At minimum implement adapters for: OpenAI (GPT-4o) and Anthropic (Claude Sonnet). Consider Perplexity as a stretch since it provides citations natively.
- Run creation and execution flow: create a `Run`, create `PromptRun` records for each prompt × engine, execute, store `RawEngineResponse`, handle errors/retries
- Wire the "Trigger Run" button in the dashboard to actually create and execute a run
- API keys via `.env` (OPENAI_API_KEY, ANTHROPIC_API_KEY)

### Phase 3 — Parser
- LLM-assisted extraction: take raw response text and produce the canonical parser output shape (spec §9.2, already defined as Zod schema in `src/lib/validation/schemas.ts`)
- Validate output with Zod before persisting
- Persist to `extracted_observations`, `mentioned_competitors`, `response_citations`, `detected_themes`
- Parser versioning (store version string with each observation)
- Handle partial/failed parses gracefully — log errors, never silently drop data

### Phase 4 — Scoring
- Wire the pure scoring functions to actual observation data
- Compute and persist scores to the `scores` table after each run
- **Write unit tests for all scoring functions** (spec §17.1) — this is overdue from Phase 1

### Phase 5 — Recommendations
- Implement recommendation trigger conditions (spec §11.1): brand score < 0.35, top competitor > 0.6, citations in 50%+ of runs, volatility below threshold
- Group by cluster/theme/page type (spec §11.2)
- Generate structured recommendation payloads with evidence references
- LLM-assisted narrative writing with evidence constraints (spec §11.4)
- Persist to `content_opportunities`

### Phase 6 — Dashboard wiring & polish
- Replace all placeholder data in dashboard pages with real database queries
- Wire overview metrics, cluster views, prompt explorer, recommendations, run history
- Add trend charts, filters (by engine, cluster, date range), pagination
- Scheduled runs support
- Retry support for failed prompt runs

## Key commands
```bash
npm run db:migrate    # Create tables
npm run db:seed       # Seed initial data
npm run db:reset      # Drop and recreate everything
npm run dev           # Start dev server
npm run build         # Production build (verified working)
```

## Important technical notes
- The project builds cleanly with `next build` as of Phase 1 completion.
- Drizzle ORM is used instead of Prisma (Prisma binaries were unavailable in the original build environment). The Drizzle schema in `src/lib/db/schema.ts` and the raw SQL in `scripts/migrate.mjs` must stay in sync — if you modify the schema, update both.
- SQLite via libsql for development. The schema is designed to be straightforward to migrate to PostgreSQL — timestamps are stored as ISO strings, booleans as integers, UUIDs as text.
- Schema field names use `brand_` prefix (e.g. `brand_url_cited`, `brand_page_cited`, `is_brand_domain`) rather than `lookc_` — this was updated for brand-generic naming.
- The build spec file (`lookc_ai_visibility_tool_build_spec.md`) still references "LookC" and uses `lookc_` field names. The code has already been updated to use "Oiya" and `brand_` prefixes. Follow the code, not the spec, for naming.
