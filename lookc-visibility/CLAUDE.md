# CLAUDE.md — GEO Visibility Tool

## Engineering Instructions

- Use TypeScript strictly. No `any` types.
- Use Zod for parser output and payload validation.
- Keep scoring logic pure and unit tested (`src/lib/scoring/`).
- Never silently discard parser failures — log them.
- Add comments only where they improve clarity.
- Schema field names use `brand_` prefix for portability.

## Architecture

- Next.js App Router (`src/app/`)
- Drizzle ORM with SQLite/libsql (dev), PostgreSQL (prod target)
- Modular services: collector, parser, scoring, recommendations
- All types in `src/lib/types/`, validation in `src/lib/validation/`

## Key Commands

```bash
node scripts/migrate.mjs   # Create/update tables
node scripts/seed.mjs      # Seed demo data
npm run db:reset            # Drop DB, migrate, and reseed
npm run dev                 # Start dev server
```

## Scoring Model

All scoring formulas are in `src/lib/scoring/index.ts`.
Do not modify scoring weights without updating tests.

## Product Guidelines

- Prioritise clarity and evidence over flashy UI.
- Recommendations must be evidence-backed and traceable to stored data.
- All numeric scoring must remain deterministic — no LLM involvement in score formulas.
- Raw engine responses must be preserved before parsing.
- Do not collapse business logic into UI components.
- Prefer explicit typing and small modules.
