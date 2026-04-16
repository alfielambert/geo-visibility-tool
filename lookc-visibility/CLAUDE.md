# CLAUDE.md — Oiya AI Visibility & Recommendation Tool

## Brand

- **Brand name**: Oiya (oiya.ai)
- **Positioning**: A shared knowledge layer that keeps AI agents aligned with company context.
- **Brand alias**: LookC (legacy name — detect as alias, but Oiya is the primary brand)
- The original build spec (`lookc_ai_visibility_tool_build_spec.md`) still says "LookC" throughout. Treat every reference to "LookC" in that document as meaning "Oiya". The code has already been updated.

## Product Instructions

- This is an internal tool for the Oiya team. Not a SaaS product.
- Prioritise clarity and evidence over flashy UI.
- The product is optimisation-first, not attribution-first.
- Recommendations must be evidence-backed and traceable to stored data.
- All numeric scoring must remain deterministic — no LLM involvement in score formulas.
- Raw engine responses must be preserved before parsing.
- Do not collapse business logic into UI components.
- Prefer explicit typing and small modules.
- Avoid adding premature SaaS features (no auth, no billing, no teams).

## Engineering Instructions

- Use TypeScript strictly. No `any` types.
- Use Zod for parser output and payload validation.
- Keep scoring logic pure and unit tested (src/lib/scoring/).
- Keep parser outputs versioned.
- Never silently discard parser failures — log them.
- Add comments only where they improve clarity.
- Schema field names use `brand_` prefix (not `lookc_`) for portability.

## Architecture

- Next.js App Router (src/app/)
- Drizzle ORM with SQLite/libsql (dev), PostgreSQL (prod target)
- Modular services: collector, parser, scoring, recommendations
- All types in src/lib/types/, validation in src/lib/validation/

## Key Commands

```bash
node scripts/migrate.mjs          # Create/update tables
node scripts/seed.mjs             # Seed initial data
npm run db:reset                  # Drop DB, migrate, and reseed
npm run dev                       # Start dev server
```

## Scoring Model

All scoring formulas are in src/lib/scoring/index.ts.
See spec sections 10.1–10.15 for the exact formulas.
Do not modify scoring weights without updating tests.

## Competitor Landscape

Oiya competes across five categories:
1. **Direct competitors** (shared knowledge/context layers): Egregore (egregore.xyz — shared cognition for teams and agents), Hyperspell (hyperspell.com — memory & context layer, YC F25), Edra (edra.ai — executable knowledge from operational data, Sequoia-backed)
2. **Agent memory/context**: Mem0, Zep, Letta, LangMem
3. **Agent frameworks**: LangChain, LlamaIndex, CrewAI, AutoGen
4. **Vector DBs / RAG infra**: Pinecone, Weaviate, Chroma, Qdrant
5. **Knowledge management**: Notion AI, Guru, Glean, Tettra
