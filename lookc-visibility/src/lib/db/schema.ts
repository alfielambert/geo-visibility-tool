/**
 * Database schema — Drizzle ORM with SQLite (libsql).
 * Designed for easy migration to PostgreSQL later.
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Helper for UUID default
const uuid = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
};

// ─── Projects ────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: uuid(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  domain: text("domain").notNull(),
  brandName: text("brand_name").notNull(),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

// ─── Competitors ─────────────────────────────────────────────────────

export const competitors = sqliteTable("competitors", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  name: text("name").notNull(),
  domain: text("domain"),
  notes: text("notes"),
  ...timestamps,
});

// ─── Prompt Clusters ─────────────────────────────────────────────────

export const promptClusters = sqliteTable("prompt_clusters", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  key: text("key").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  ...timestamps,
});

// ─── Prompts ─────────────────────────────────────────────────────────

export const prompts = sqliteTable("prompts", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  clusterId: text("cluster_id")
    .notNull()
    .references(() => promptClusters.id),
  promptText: text("prompt_text").notNull(),
  strategicWeight: real("strategic_weight").notNull().default(1.0),
  language: text("language").notNull().default("en"),
  region: text("region").notNull().default("uk"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  ...timestamps,
});

// ─── Runs (batch execution) ──────────────────────────────────────────

export const runs = sqliteTable("runs", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  triggerType: text("trigger_type").notNull(), // manual | scheduled | backfill | test
  status: text("status").notNull().default("pending"), // pending | running | completed | failed | partial
  startedAt: text("started_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
  notes: text("notes"),
  ...timestamps,
});

// ─── Prompt Runs (single prompt × single engine) ─────────────────────

export const promptRuns = sqliteTable("prompt_runs", {
  id: uuid(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  promptId: text("prompt_id")
    .notNull()
    .references(() => prompts.id),
  engine: text("engine").notNull(),
  status: text("status").notNull().default("pending"),
  requestedAt: text("requested_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  respondedAt: text("responded_at"),
  latencyMs: integer("latency_ms"),
  errorMessage: text("error_message"),
  ...timestamps,
});

// ─── Raw Engine Responses ────────────────────────────────────────────

export const rawEngineResponses = sqliteTable("raw_engine_responses", {
  id: uuid(),
  promptRunId: text("prompt_run_id")
    .notNull()
    .unique()
    .references(() => promptRuns.id),
  rawResponseText: text("raw_response_text").notNull(),
  rawPayloadJson: text("raw_payload_json"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Extracted Observations ──────────────────────────────────────────

export const extractedObservations = sqliteTable("extracted_observations", {
  id: uuid(),
  promptRunId: text("prompt_run_id")
    .notNull()
    .unique()
    .references(() => promptRuns.id),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  promptId: text("prompt_id")
    .notNull()
    .references(() => prompts.id),
  clusterKey: text("cluster_key").notNull(),
  engine: text("engine").notNull(),
  runTimestamp: text("run_timestamp").notNull(),
  region: text("region").notNull(),
  language: text("language").notNull(),

  // Brand visibility
  brandMentioned: integer("brand_mentioned", { mode: "boolean" })
    .notNull()
    .default(false),
  brandDisplayName: text("brand_display_name"),
  brandPosition: integer("brand_position"),
  brandMentionCount: integer("brand_mention_count").notNull().default(0),
  brandIsPrimaryRecommendation: integer("brand_is_primary_recommendation", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  brandMentionStrength: text("brand_mention_strength").notNull(), // none | weak | moderate | strong
  brandSentiment: text("brand_sentiment").notNull(), // positive | neutral | mixed | negative | not_applicable
  brandSummary: text("brand_summary"),

  // Competition & citations
  competitorCount: integer("competitor_count").notNull().default(0),
  citationsPresent: integer("citations_present", { mode: "boolean" })
    .notNull()
    .default(false),
  thirdPartyRoundupPresent: integer("third_party_roundup_present", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  comparisonStyleAnswer: integer("comparison_style_answer", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  answerFormat: text("answer_format").notNull(), // tool_list | comparison | narrative | step_by_step | definition | mixed | unknown
  brandUrlCited: integer("brand_url_cited", { mode: "boolean" })
    .notNull()
    .default(false),
  brandPageCited: text("brand_page_cited"),

  // Recommendation inputs
  reasonBrandNotIncluded: text("reason_brand_not_included"),
  reasonBrandIncluded: text("reason_brand_included"),
  confidenceScore: real("confidence_score").notNull().default(0),
  parserVersion: text("parser_version").notNull(),

  ...timestamps,
});

// ─── Mentioned Competitors ───────────────────────────────────────────

export const mentionedCompetitors = sqliteTable("mentioned_competitors", {
  id: uuid(),
  extractedObservationId: text("extracted_observation_id")
    .notNull()
    .references(() => extractedObservations.id),
  competitorName: text("competitor_name").notNull(),
  position: integer("position"),
  mentionStrength: text("mention_strength").notNull(),
  sentiment: text("sentiment").notNull(),
  isKnownCompetitor: integer("is_known_competitor", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Response Citations ──────────────────────────────────────────────

export const responseCitations = sqliteTable("response_citations", {
  id: uuid(),
  extractedObservationId: text("extracted_observation_id")
    .notNull()
    .references(() => extractedObservations.id),
  domain: text("domain").notNull(),
  url: text("url"),
  pageType: text("page_type").notNull(),
  isBrandDomain: integer("is_brand_domain", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Detected Themes ─────────────────────────────────────────────────

export const detectedThemes = sqliteTable("detected_themes", {
  id: uuid(),
  extractedObservationId: text("extracted_observation_id")
    .notNull()
    .references(() => extractedObservations.id),
  themeType: text("theme_type").notNull(), // brand_positioning_detected | missing_capabilities_or_themes | dominant_themes_in_answer
  themeValue: text("theme_value").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Site Pages (indexed page inventory for cannibalisation checks) ──

export const sitePages = sqliteTable("site_pages", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  url: text("url").notNull(),
  title: text("title"),
  metaDescription: text("meta_description"),
  source: text("source").notNull().default("manual"), // manual | sitemap
  indexedAt: text("indexed_at"),
  ...timestamps,
});

// ─── Content Opportunities ───────────────────────────────────────────

export const contentOpportunities = sqliteTable("content_opportunities", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  promptId: text("prompt_id").references(() => prompts.id),
  clusterId: text("cluster_id").references(() => promptClusters.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  opportunityType: text("opportunity_type").notNull(),
  recommendedPageType: text("recommended_page_type").notNull(),
  // create | refresh | expand | reposition (set after checking site inventory)
  action: text("action").notNull().default("create"),
  matchedPageUrl: text("matched_page_url"),
  matchedPageTitle: text("matched_page_title"),
  matchedPageReason: text("matched_page_reason"),
  priorityScore: real("priority_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  supportingEvidenceJson: text("supporting_evidence_json").notNull(),
  status: text("status").notNull().default("open"),
  ...timestamps,
});

// ─── Scores ──────────────────────────────────────────────────────────

export const scores = sqliteTable("scores", {
  id: uuid(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  runId: text("run_id").references(() => runs.id),
  promptId: text("prompt_id").references(() => prompts.id),
  clusterId: text("cluster_id").references(() => promptClusters.id),
  scoreType: text("score_type").notNull(),
  scoreValue: real("score_value").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
