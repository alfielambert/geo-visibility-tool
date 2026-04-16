/**
 * Database migration — creates all tables.
 * Run: node scripts/migrate.mjs
 */

import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./dev.db" });

const statements = [
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS competitors (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    domain TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS prompt_clusters (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, key)
  )`,

  `CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    cluster_id TEXT NOT NULL REFERENCES prompt_clusters(id),
    prompt_text TEXT NOT NULL,
    strategic_weight REAL NOT NULL DEFAULT 1.0,
    language TEXT NOT NULL DEFAULT 'en',
    region TEXT NOT NULL DEFAULT 'uk',
    enabled INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    trigger_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS prompt_runs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    engine TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    responded_at TEXT,
    latency_ms INTEGER,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS raw_engine_responses (
    id TEXT PRIMARY KEY,
    prompt_run_id TEXT NOT NULL UNIQUE REFERENCES prompt_runs(id),
    raw_response_text TEXT NOT NULL,
    raw_payload_json TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS extracted_observations (
    id TEXT PRIMARY KEY,
    prompt_run_id TEXT NOT NULL UNIQUE REFERENCES prompt_runs(id),
    project_id TEXT NOT NULL REFERENCES projects(id),
    prompt_id TEXT NOT NULL REFERENCES prompts(id),
    cluster_key TEXT NOT NULL,
    engine TEXT NOT NULL,
    run_timestamp TEXT NOT NULL,
    region TEXT NOT NULL,
    language TEXT NOT NULL,
    brand_mentioned INTEGER NOT NULL DEFAULT 0,
    brand_display_name TEXT,
    brand_position INTEGER,
    brand_mention_count INTEGER NOT NULL DEFAULT 0,
    brand_is_primary_recommendation INTEGER NOT NULL DEFAULT 0,
    brand_mention_strength TEXT NOT NULL,
    brand_sentiment TEXT NOT NULL,
    brand_summary TEXT,
    competitor_count INTEGER NOT NULL DEFAULT 0,
    citations_present INTEGER NOT NULL DEFAULT 0,
    third_party_roundup_present INTEGER NOT NULL DEFAULT 0,
    comparison_style_answer INTEGER NOT NULL DEFAULT 0,
    answer_format TEXT NOT NULL,
    brand_url_cited INTEGER NOT NULL DEFAULT 0,
    brand_page_cited TEXT,
    reason_brand_not_included TEXT,
    reason_brand_included TEXT,
    confidence_score REAL NOT NULL DEFAULT 0,
    parser_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS mentioned_competitors (
    id TEXT PRIMARY KEY,
    extracted_observation_id TEXT NOT NULL REFERENCES extracted_observations(id),
    competitor_name TEXT NOT NULL,
    position INTEGER,
    mention_strength TEXT NOT NULL,
    sentiment TEXT NOT NULL,
    is_known_competitor INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS response_citations (
    id TEXT PRIMARY KEY,
    extracted_observation_id TEXT NOT NULL REFERENCES extracted_observations(id),
    domain TEXT NOT NULL,
    url TEXT,
    page_type TEXT NOT NULL,
    is_brand_domain INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS detected_themes (
    id TEXT PRIMARY KEY,
    extracted_observation_id TEXT NOT NULL REFERENCES extracted_observations(id),
    theme_type TEXT NOT NULL,
    theme_value TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS content_opportunities (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    prompt_id TEXT REFERENCES prompts(id),
    cluster_id TEXT REFERENCES prompt_clusters(id),
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    opportunity_type TEXT NOT NULL,
    recommended_page_type TEXT NOT NULL,
    priority_score REAL NOT NULL,
    confidence_score REAL NOT NULL,
    supporting_evidence_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    run_id TEXT REFERENCES runs(id),
    prompt_id TEXT REFERENCES prompts(id),
    cluster_id TEXT REFERENCES prompt_clusters(id),
    score_type TEXT NOT NULL,
    score_value REAL NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

console.log("🗄️  Running migrations...\n");
for (const stmt of statements) {
  const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  await client.execute(stmt);
  console.log(`  ✅ ${tableName}`);
}
console.log("\n🎉 Migration complete!");
