/**
 * Persist parsed observations to the database.
 * Takes a validated ParserOutput and writes to:
 * - extracted_observations
 * - mentioned_competitors
 * - response_citations
 * - detected_themes
 */

import { db, schema } from "../db";
import type { ParserOutput } from "../validation/schemas";
import { PARSER_VERSION } from "./index";

export async function persistObservation(
  promptRunId: string,
  parsed: ParserOutput,
  brandDomain?: string
): Promise<string> {
  const observationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const bv = parsed.brand_visibility;
  const cc = parsed.competition_and_citations;
  const ri = parsed.recommendation_inputs;

  // 1. Insert extracted observation
  await db.insert(schema.extractedObservations).values({
    id: observationId,
    promptRunId,
    projectId: parsed.project_id,
    promptId: parsed.prompt_id,
    clusterKey: parsed.prompt_cluster,
    engine: parsed.engine,
    runTimestamp: parsed.run_timestamp,
    region: parsed.region,
    language: parsed.language,
    brandMentioned: bv.brand_mentioned,
    brandDisplayName: bv.brand_display_name,
    brandPosition: bv.brand_position,
    brandMentionCount: bv.brand_mention_count,
    brandIsPrimaryRecommendation: bv.brand_is_primary_recommendation,
    brandMentionStrength: bv.brand_mention_strength,
    brandSentiment: bv.brand_sentiment,
    brandSummary: bv.brand_summary,
    competitorCount: cc.competitor_count,
    citationsPresent: cc.citations_present,
    thirdPartyRoundupPresent: cc.third_party_roundup_present,
    comparisonStyleAnswer: cc.comparison_style_answer,
    answerFormat: cc.answer_format,
    brandUrlCited: cc.brand_url_cited,
    brandPageCited: cc.brand_page_cited,
    reasonBrandNotIncluded: ri.reason_brand_not_included,
    reasonBrandIncluded: ri.reason_brand_included,
    confidenceScore: ri.confidence_score,
    parserVersion: PARSER_VERSION,
    createdAt: now,
    updatedAt: now,
  });

  // 2. Insert mentioned competitors
  if (cc.competitors_mentioned.length > 0) {
    await db.insert(schema.mentionedCompetitors).values(
      cc.competitors_mentioned.map((comp) => ({
        id: crypto.randomUUID(),
        extractedObservationId: observationId,
        competitorName: comp.name,
        position: comp.position,
        mentionStrength: comp.mention_strength,
        sentiment: comp.sentiment,
        isKnownCompetitor: false, // Will be matched in a separate step
        createdAt: now,
      }))
    );
  }

  // 3. Insert response citations
  const citations: Array<{
    domain: string;
    url: string | null;
    pageType: string;
    isBrandDomain: boolean;
  }> = [];

  for (let i = 0; i < cc.cited_domains.length; i++) {
    const domain = cc.cited_domains[i];
    const url = cc.cited_urls[i] ?? null;
    const pageType = cc.cited_page_types[i] ?? "unknown";
    citations.push({
      domain,
      url,
      pageType,
      isBrandDomain: brandDomain
        ? domain.toLowerCase().includes(brandDomain.toLowerCase().replace(/^www\./, ""))
        : false,
    });
  }

  if (citations.length > 0) {
    await db.insert(schema.responseCitations).values(
      citations.map((c) => ({
        id: crypto.randomUUID(),
        extractedObservationId: observationId,
        domain: c.domain,
        url: c.url,
        pageType: c.pageType,
        isBrandDomain: c.isBrandDomain,
        createdAt: now,
      }))
    );
  }

  // 4. Insert detected themes
  const themes: Array<{ themeType: string; themeValue: string }> = [];

  for (const theme of ri.brand_positioning_detected) {
    themes.push({
      themeType: "brand_positioning_detected",
      themeValue: theme,
    });
  }
  for (const theme of ri.missing_capabilities_or_themes) {
    themes.push({
      themeType: "missing_capabilities_or_themes",
      themeValue: theme,
    });
  }
  for (const theme of ri.dominant_themes_in_answer) {
    themes.push({
      themeType: "dominant_themes_in_answer",
      themeValue: theme,
    });
  }

  if (themes.length > 0) {
    await db.insert(schema.detectedThemes).values(
      themes.map((t) => ({
        id: crypto.randomUUID(),
        extractedObservationId: observationId,
        themeType: t.themeType,
        themeValue: t.themeValue,
        createdAt: now,
      }))
    );
  }

  return observationId;
}
