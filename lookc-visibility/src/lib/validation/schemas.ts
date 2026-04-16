/**
 * Zod validation schemas for parser output, API payloads, and config.
 */

import { z } from "zod";

// ─── Parser Output Schema ────────────────────────────────────────────

export const MentionStrengthSchema = z.enum([
  "none",
  "weak",
  "moderate",
  "strong",
]);

export const BrandSentimentSchema = z.enum([
  "positive",
  "neutral",
  "mixed",
  "negative",
  "not_applicable",
]);

export const AnswerFormatSchema = z.enum([
  "tool_list",
  "comparison",
  "narrative",
  "step_by_step",
  "definition",
  "mixed",
  "unknown",
]);

export const PageTypeSchema = z.enum([
  "homepage",
  "docs",
  "blog",
  "comparison",
  "landing_page",
  "pricing",
  "api_reference",
  "case_study",
  "faq",
  "glossary",
  "unknown",
]);

export const ReasonBrandNotIncludedSchema = z.enum([
  "brand_unknown",
  "competitors_better_match",
  "insufficient_category_association",
  "lack_of_cited_content",
  "prompt_too_broad",
  "unclear",
]);

export const ReasonBrandIncludedSchema = z.enum([
  "strong_category_match",
  "clear_positioning",
  "relevant_cited_content",
  "brand_awareness",
  "prompt_alignment",
  "unclear",
]);

export const CompetitorMentionSchema = z.object({
  name: z.string(),
  position: z.number().nullable(),
  mention_strength: MentionStrengthSchema,
  sentiment: BrandSentimentSchema,
});

export const BrandVisibilitySchema = z.object({
  brand_mentioned: z.boolean(),
  brand_display_name: z.string().nullable(),
  brand_position: z.number().nullable(),
  brand_mention_count: z.number().int().min(0),
  brand_is_primary_recommendation: z.boolean(),
  brand_mention_strength: MentionStrengthSchema,
  brand_sentiment: BrandSentimentSchema,
  brand_summary: z.string().nullable(),
});

export const CompetitionAndCitationsSchema = z.object({
  competitors_mentioned: z.array(CompetitorMentionSchema),
  competitor_count: z.number().int().min(0),
  citations_present: z.boolean(),
  cited_domains: z.array(z.string()),
  cited_urls: z.array(z.string()),
  cited_page_types: z.array(PageTypeSchema),
  third_party_roundup_present: z.boolean(),
  comparison_style_answer: z.boolean(),
  answer_format: AnswerFormatSchema,
  brand_url_cited: z.boolean(),
  brand_page_cited: z.string().nullable(),
});

export const RecommendationInputsSchema = z.object({
  brand_positioning_detected: z.array(z.string()),
  missing_capabilities_or_themes: z.array(z.string()),
  dominant_themes_in_answer: z.array(z.string()),
  reason_brand_not_included: ReasonBrandNotIncludedSchema.nullable(),
  reason_brand_included: ReasonBrandIncludedSchema.nullable(),
  content_opportunity_type: z.string().nullable(),
  content_opportunity_summary: z.string().nullable(),
  recommended_page_type: PageTypeSchema.nullable(),
  recommended_topic_title: z.string().nullable(),
  confidence_score: z.number().min(0).max(1),
});

/** Canonical parser output — the full structured extraction from one prompt run. */
export const ParserOutputSchema = z.object({
  project_id: z.string(),
  prompt_id: z.string(),
  prompt_text: z.string(),
  prompt_cluster: z.string(),
  engine: z.string(),
  run_id: z.string(),
  run_timestamp: z.string(),
  region: z.string(),
  language: z.string(),
  raw_response: z.string(),
  brand_visibility: BrandVisibilitySchema,
  competition_and_citations: CompetitionAndCitationsSchema,
  recommendation_inputs: RecommendationInputsSchema,
});

export type ParserOutput = z.infer<typeof ParserOutputSchema>;
export type BrandVisibility = z.infer<typeof BrandVisibilitySchema>;
export type CompetitionAndCitations = z.infer<
  typeof CompetitionAndCitationsSchema
>;
export type RecommendationInputs = z.infer<typeof RecommendationInputsSchema>;
export type CompetitorMention = z.infer<typeof CompetitorMentionSchema>;

// ─── Config Schema ───────────────────────────────────────────────────

export const AppConfigSchema = z.object({
  enabledEngines: z.array(z.string()),
  parserVersion: z.string(),
  promptExecutionLimit: z.number().int().positive().optional(),
  retryCount: z.number().int().min(0).default(2),
  volatilityThreshold: z.number().min(0).max(1).default(0.3),
  recommendationThresholds: z.object({
    minBrandScoreBelow: z.number().default(0.35),
    minTopCompetitorScoreAbove: z.number().default(0.6),
    minCitationPresenceRate: z.number().default(0.5),
  }),
  defaultStrategicWeight: z.number().default(1.0),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
