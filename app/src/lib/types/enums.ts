/**
 * Shared enums — single source of truth for all status/type values.
 * Used across schema, API, scoring, and UI.
 */

export const RunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  PARTIAL: "partial",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const TriggerType = {
  MANUAL: "manual",
  SCHEDULED: "scheduled",
  BACKFILL: "backfill",
  TEST: "test",
} as const;
export type TriggerType = (typeof TriggerType)[keyof typeof TriggerType];

export const MentionStrength = {
  NONE: "none",
  WEAK: "weak",
  MODERATE: "moderate",
  STRONG: "strong",
} as const;
export type MentionStrength =
  (typeof MentionStrength)[keyof typeof MentionStrength];

export const BrandSentiment = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  MIXED: "mixed",
  NEGATIVE: "negative",
  NOT_APPLICABLE: "not_applicable",
} as const;
export type BrandSentiment =
  (typeof BrandSentiment)[keyof typeof BrandSentiment];

export const AnswerFormat = {
  TOOL_LIST: "tool_list",
  COMPARISON: "comparison",
  NARRATIVE: "narrative",
  STEP_BY_STEP: "step_by_step",
  DEFINITION: "definition",
  MIXED: "mixed",
  UNKNOWN: "unknown",
} as const;
export type AnswerFormat = (typeof AnswerFormat)[keyof typeof AnswerFormat];

export const PageType = {
  HOMEPAGE: "homepage",
  DOCS: "docs",
  BLOG: "blog",
  COMPARISON: "comparison",
  LANDING_PAGE: "landing_page",
  PRICING: "pricing",
  API_REFERENCE: "api_reference",
  CASE_STUDY: "case_study",
  FAQ: "faq",
  GLOSSARY: "glossary",
  UNKNOWN: "unknown",
} as const;
export type PageType = (typeof PageType)[keyof typeof PageType];

export const ReasonBrandNotIncluded = {
  BRAND_UNKNOWN: "brand_unknown",
  COMPETITORS_BETTER_MATCH: "competitors_better_match",
  INSUFFICIENT_CATEGORY_ASSOCIATION: "insufficient_category_association",
  LACK_OF_CITED_CONTENT: "lack_of_cited_content",
  PROMPT_TOO_BROAD: "prompt_too_broad",
  UNCLEAR: "unclear",
} as const;
export type ReasonBrandNotIncluded =
  (typeof ReasonBrandNotIncluded)[keyof typeof ReasonBrandNotIncluded];

export const ReasonBrandIncluded = {
  STRONG_CATEGORY_MATCH: "strong_category_match",
  CLEAR_POSITIONING: "clear_positioning",
  RELEVANT_CITED_CONTENT: "relevant_cited_content",
  BRAND_AWARENESS: "brand_awareness",
  PROMPT_ALIGNMENT: "prompt_alignment",
  UNCLEAR: "unclear",
} as const;
export type ReasonBrandIncluded =
  (typeof ReasonBrandIncluded)[keyof typeof ReasonBrandIncluded];

export const ContentOpportunityType = {
  NEW_LANDING_PAGE: "new_landing_page",
  COMPARISON_PAGE: "comparison_page",
  THOUGHT_LEADERSHIP_ARTICLE: "thought_leadership_article",
  DOCS_PAGE: "docs_page",
  USE_CASE_PAGE: "use_case_page",
  FAQ_PAGE: "faq_page",
  GLOSSARY_PAGE: "glossary_page",
  POSITIONING_UPDATE: "positioning_update",
} as const;
export type ContentOpportunityType =
  (typeof ContentOpportunityType)[keyof typeof ContentOpportunityType];

export const OpportunityStatus = {
  OPEN: "open",
  ACCEPTED: "accepted",
  DISMISSED: "dismissed",
  COMPLETED: "completed",
} as const;
export type OpportunityStatus =
  (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const ScoreType = {
  MENTION_RATE: "mention_rate",
  VISIBILITY_SCORE: "visibility_score",
  EVIDENCE_SCORE: "evidence_score",
  CITATION_RATE: "citation_rate",
  AVERAGE_POSITION_SCORE: "average_position_score",
  COMPETITOR_SHARE_OF_MENTION: "competitor_share_of_mention",
  OPPORTUNITY_SCORE: "opportunity_score",
  VOLATILITY: "volatility",
} as const;
export type ScoreType = (typeof ScoreType)[keyof typeof ScoreType];

export const ThemeType = {
  BRAND_POSITIONING_DETECTED: "brand_positioning_detected",
  MISSING_CAPABILITIES_OR_THEMES: "missing_capabilities_or_themes",
  DOMINANT_THEMES_IN_ANSWER: "dominant_themes_in_answer",
} as const;
export type ThemeType = (typeof ThemeType)[keyof typeof ThemeType];

// Prompt cluster keys — first-class entities per spec
export const PromptClusterKey = {
  AGENT_KNOWLEDGE_LAYERS: "agent_knowledge_layers",
  AGENT_MEMORY_SYSTEMS: "agent_memory_systems",
  ALIGNMENT_WITH_COMPANY_CONTEXT: "alignment_with_company_context",
  DATA_CONNECTORS_FOR_AGENTS: "data_connectors_for_agents",
  AGENT_GOVERNANCE_AND_SAFETY: "agent_governance_and_safety",
  AGENT_LEARNING_SYSTEMS: "agent_learning_systems",
  GENERAL_AGENT_INFRASTRUCTURE: "general_agent_infrastructure",
  BRAND_AWARENESS: "brand_awareness",
} as const;
export type PromptClusterKey =
  (typeof PromptClusterKey)[keyof typeof PromptClusterKey];
