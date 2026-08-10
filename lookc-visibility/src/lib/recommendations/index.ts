/**
 * Recommendation engine — detects opportunities, groups them,
 * generates evidence-backed narratives, and persists to content_opportunities.
 *
 * Includes Reddit-as-channel detection: when Reddit domains dominate citations
 * in a cluster, recommendations suggest Reddit thread presence rather than
 * only owned-content page types.
 */

import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { checkPageCoverage } from "../site-inventory";
import { opportunityScore, finalPromptScore } from "../scoring";
import type { MentionStrength } from "../types/enums";

/** Configurable thresholds (from AppConfigSchema defaults) */
interface RecommendationConfig {
  minBrandScoreBelow: number;
  minTopCompetitorScoreAbove: number;
  minCitationPresenceRate: number;
  volatilityThreshold: number;
  /** If Reddit makes up this fraction of cited domains, flag as Reddit-dominant */
  redditCitationDominanceThreshold: number;
}

const DEFAULT_CONFIG: RecommendationConfig = {
  minBrandScoreBelow: 0.35,
  minTopCompetitorScoreAbove: 0.6,
  minCitationPresenceRate: 0.5,
  volatilityThreshold: 0.3,
  redditCitationDominanceThreshold: 0.25,
};

interface RecommendationCandidate {
  promptId: string;
  promptText: string;
  clusterKey: string;
  clusterId: string | null;
  brandScore: number;
  topCompetitorScore: number;
  topCompetitorName: string;
  citationRate: number;
  dominantThemes: string[];
  missingThemes: string[];
  competitorNames: string[];
  citedDomains: string[];
  redditCitationRate: number;
  recommendedPageType: string | null;
  contentOpportunitySummary: string | null;
  confidenceScore: number;
}

interface GroupedRecommendation {
  clusterKey: string;
  clusterId: string | null;
  candidates: RecommendationCandidate[];
  dominantThemes: string[];
  missingThemes: string[];
  topCompetitors: string[];
  citedDomains: string[];
  redditCitationRate: number;
  avgBrandScore: number;
  avgTopCompetitorScore: number;
  recommendedPageType: string;
  priorityScore: number;
  avgConfidence: number;
}

const REDDIT_DOMAIN_PATTERNS = ["reddit.com", "redd.it", "old.reddit.com"];

function isRedditDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return REDDIT_DOMAIN_PATTERNS.some(
    (p) => lower === p || lower.endsWith("." + p)
  );
}

/**
 * Generate recommendations for a completed run.
 */
export async function generateRecommendations(
  runId: string,
  projectId: string,
  config: RecommendationConfig = DEFAULT_CONFIG
): Promise<number> {
  // Get prompt runs for this run
  const promptRuns = await db.query.promptRuns.findMany({
    where: eq(schema.promptRuns.runId, runId),
  });
  const promptRunIds = new Set(promptRuns.map((pr) => pr.id));

  // Get observations for this run
  const allObservations = await db.query.extractedObservations.findMany({
    where: eq(schema.extractedObservations.projectId, projectId),
  });
  const observations = allObservations.filter((o) =>
    promptRunIds.has(o.promptRunId)
  );

  if (observations.length === 0) return 0;

  // Get prompts and clusters for context
  const prompts = await db.query.prompts.findMany({
    where: eq(schema.prompts.projectId, projectId),
  });
  const promptMap = new Map(prompts.map((p) => [p.id, p]));

  const clusters = await db.query.promptClusters.findMany({
    where: eq(schema.promptClusters.projectId, projectId),
  });
  const clusterKeyToId = new Map(clusters.map((c) => [c.key, c.id]));

  // Build candidates: evaluate each prompt's observations
  const promptGroups = new Map<string, typeof observations>();
  for (const obs of observations) {
    const existing = promptGroups.get(obs.promptId) ?? [];
    existing.push(obs);
    promptGroups.set(obs.promptId, existing);
  }

  const candidates: RecommendationCandidate[] = [];

  for (const [promptId, promptObs] of promptGroups) {
    const prompt = promptMap.get(promptId);
    if (!prompt) continue;

    // Calculate average brand score for this prompt using scoring functions
    const brandScores = promptObs.map((o) =>
      finalPromptScore(
        o.brandPosition,
        o.brandMentionStrength as MentionStrength,
        o.brandIsPrimaryRecommendation,
        o.brandMentioned,
        o.brandUrlCited
      )
    );

    const avgBrandScore =
      brandScores.reduce((a, b) => a + b, 0) / brandScores.length;

    // Get competitor mentions
    const allCompMentions = await Promise.all(
      promptObs.map((o) =>
        db.query.mentionedCompetitors.findMany({
          where: eq(
            schema.mentionedCompetitors.extractedObservationId,
            o.id
          ),
        })
      )
    );
    const flatCompMentions = allCompMentions.flat();

    // Find top competitor
    const compScores = new Map<string, number[]>();
    for (const m of flatCompMentions) {
      const scores = compScores.get(m.competitorName) ?? [];
      const msW =
        m.mentionStrength === "strong"
          ? 1.0
          : m.mentionStrength === "moderate"
            ? 0.66
            : m.mentionStrength === "weak"
              ? 0.33
              : 0;
      scores.push(msW);
      compScores.set(m.competitorName, scores);
    }

    let topCompName = "";
    let topCompScore = 0;
    for (const [name, scores] of compScores) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      if (avg > topCompScore) {
        topCompScore = avg;
        topCompName = name;
      }
    }

    // Citation rate
    const citedCount = promptObs.filter((o) => o.citationsPresent).length;
    const citRate = citedCount / promptObs.length;

    // Get themes
    const allThemes = await Promise.all(
      promptObs.map((o) =>
        db.query.detectedThemes.findMany({
          where: eq(schema.detectedThemes.extractedObservationId, o.id),
        })
      )
    );
    const flatThemes = allThemes.flat();
    const dominantThemes = [
      ...new Set(
        flatThemes
          .filter((t) => t.themeType === "dominant_themes_in_answer")
          .map((t) => t.themeValue)
      ),
    ];
    const missingThemes = [
      ...new Set(
        flatThemes
          .filter((t) => t.themeType === "missing_capabilities_or_themes")
          .map((t) => t.themeValue)
      ),
    ];

    // Get cited domains and calculate Reddit citation rate
    const allCitations = await Promise.all(
      promptObs.map((o) =>
        db.query.responseCitations.findMany({
          where: eq(
            schema.responseCitations.extractedObservationId,
            o.id
          ),
        })
      )
    );
    const flatCitations = allCitations.flat();
    const citedDomains = [
      ...new Set(flatCitations.map((c) => c.domain)),
    ];

    // Reddit citation rate: fraction of all citations that are Reddit domains
    const redditCitations = flatCitations.filter((c) =>
      isRedditDomain(c.domain)
    );
    const redditCitationRate =
      flatCitations.length > 0
        ? redditCitations.length / flatCitations.length
        : 0;

    // Check trigger conditions
    if (
      avgBrandScore < config.minBrandScoreBelow &&
      topCompScore > config.minTopCompetitorScoreAbove &&
      citRate >= config.minCitationPresenceRate
    ) {
      const avgConfidence =
        promptObs.reduce((a, o) => a + o.confidenceScore, 0) /
        promptObs.length;

      // Determine recommended page type — factor in Reddit dominance
      let recommendedPageType: string;
      if (redditCitationRate >= config.redditCitationDominanceThreshold) {
        recommendedPageType = "reddit_thread";
      } else if (promptObs[0].answerFormat === "comparison") {
        recommendedPageType = "comparison";
      } else if (promptObs[0].answerFormat === "tool_list") {
        recommendedPageType = "landing_page";
      } else {
        recommendedPageType = "blog";
      }

      candidates.push({
        promptId,
        promptText: prompt.promptText,
        clusterKey: promptObs[0].clusterKey,
        clusterId: clusterKeyToId.get(promptObs[0].clusterKey) ?? null,
        brandScore: avgBrandScore,
        topCompetitorScore: topCompScore,
        topCompetitorName: topCompName,
        citationRate: citRate,
        dominantThemes,
        missingThemes,
        competitorNames: [...compScores.keys()],
        citedDomains,
        redditCitationRate,
        recommendedPageType,
        contentOpportunitySummary: null,
        confidenceScore: avgConfidence,
      });
    }
  }

  if (candidates.length === 0) return 0;

  // Group candidates by cluster
  const grouped = groupCandidates(candidates, config);

  // Generate narratives and persist
  let count = 0;
  for (const group of grouped) {
    const [narrative, coverage] = await Promise.all([
      generateNarrative(group),
      checkPageCoverage(
        projectId,
        group.clusterKey,
        group.candidates.map((c) => c.promptText),
        group.dominantThemes,
        group.missingThemes
      ),
    ]);
    await persistRecommendation(projectId, runId, group, narrative, coverage);
    count++;
  }

  return count;
}

/**
 * Group recommendation candidates by cluster to avoid noisy per-prompt recommendations.
 */
function groupCandidates(
  candidates: RecommendationCandidate[],
  config: RecommendationConfig
): GroupedRecommendation[] {
  const clusterGroups = new Map<string, RecommendationCandidate[]>();
  for (const c of candidates) {
    const existing = clusterGroups.get(c.clusterKey) ?? [];
    existing.push(c);
    clusterGroups.set(c.clusterKey, existing);
  }

  const groups: GroupedRecommendation[] = [];
  for (const [clusterKey, clusterCandidates] of clusterGroups) {
    const allDominant = clusterCandidates.flatMap((c) => c.dominantThemes);
    const allMissing = clusterCandidates.flatMap((c) => c.missingThemes);
    const allCompetitors = clusterCandidates.flatMap(
      (c) => c.competitorNames
    );
    const allDomains = clusterCandidates.flatMap((c) => c.citedDomains);

    const avgBrand =
      clusterCandidates.reduce((a, c) => a + c.brandScore, 0) /
      clusterCandidates.length;
    const avgTopComp =
      clusterCandidates.reduce((a, c) => a + c.topCompetitorScore, 0) /
      clusterCandidates.length;
    const avgConf =
      clusterCandidates.reduce((a, c) => a + c.confidenceScore, 0) /
      clusterCandidates.length;

    // Aggregate Reddit citation rate across candidates
    const avgRedditCitRate =
      clusterCandidates.reduce((a, c) => a + c.redditCitationRate, 0) /
      clusterCandidates.length;

    // Pick most common recommended page type
    const pageTypeCounts = new Map<string, number>();
    for (const c of clusterCandidates) {
      if (c.recommendedPageType) {
        pageTypeCounts.set(
          c.recommendedPageType,
          (pageTypeCounts.get(c.recommendedPageType) ?? 0) + 1
        );
      }
    }
    let recommendedPageType = "blog";
    let maxCount = 0;
    for (const [pt, count] of pageTypeCounts) {
      if (count > maxCount) {
        maxCount = count;
        recommendedPageType = pt;
      }
    }

    // If Reddit citations are dominant across the cluster, override to reddit_thread
    if (
      avgRedditCitRate >= config.redditCitationDominanceThreshold &&
      recommendedPageType !== "reddit_thread"
    ) {
      recommendedPageType = "reddit_thread";
    }

    const priority = opportunityScore(
      avgBrand,
      avgTopComp,
      true,
      1.0,
      avgConf
    );

    groups.push({
      clusterKey,
      clusterId: clusterCandidates[0].clusterId,
      candidates: clusterCandidates,
      dominantThemes: [...new Set(allDominant)],
      missingThemes: [...new Set(allMissing)],
      topCompetitors: [...new Set(allCompetitors)].slice(0, 5),
      citedDomains: [...new Set(allDomains)].slice(0, 10),
      redditCitationRate: avgRedditCitRate,
      avgBrandScore: avgBrand,
      avgTopCompetitorScore: avgTopComp,
      recommendedPageType,
      priorityScore: priority,
      avgConfidence: avgConf,
    });
  }

  // Sort by priority (highest first)
  groups.sort((a, b) => b.priorityScore - a.priorityScore);
  return groups;
}

/**
 * Generate an LLM-assisted narrative for a grouped recommendation.
 */
async function generateNarrative(
  group: GroupedRecommendation
): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openRouterKey && !anthropicKey) {
    return buildFallbackNarrative(group);
  }

  const promptTexts = group.candidates
    .map((c) => `- "${c.promptText}"`)
    .join("\n");

  const redditContext =
    group.redditCitationRate > 0.15
      ? `\n- Reddit citation rate: ${(group.redditCitationRate * 100).toFixed(0)}% of all cited sources are Reddit threads — Reddit is the #1 domain AI models cite for product recommendations (40% of all AI citations). When Reddit threads dominate citations, getting mentioned in relevant Reddit discussions is often more impactful than creating owned content.`
      : "";

  const pageTypeGuidance =
    group.recommendedPageType === "reddit_thread"
      ? `\n- IMPORTANT: The recommended channel is Reddit thread presence (not owned blog/page content). The evidence shows AI models are pulling recommendations from Reddit for this cluster. Recommend getting mentioned in relevant Reddit threads and subreddit discussions, not just creating owned content.`
      : "";

  const prompt = `You are writing a recommendation for the Oiya marketing team. Based on the evidence below, write a 2-3 sentence recommendation for content they should create or conversations they should participate in.

## Evidence
- Cluster: ${group.clusterKey.replace(/_/g, " ")}
- Average brand visibility score: ${(group.avgBrandScore * 100).toFixed(1)}%
- Top competitor average score: ${(group.avgTopCompetitorScore * 100).toFixed(1)}%
- Top competitors appearing: ${group.topCompetitors.join(", ")}
- Dominant themes in AI responses: ${group.dominantThemes.join(", ") || "none detected"}
- Themes missing from Oiya's presence: ${group.missingThemes.join(", ") || "none detected"}
- Cited domains: ${group.citedDomains.join(", ") || "none"}
- Recommended channel: ${group.recommendedPageType.replace(/_/g, " ")}${redditContext}${pageTypeGuidance}

## Prompts that triggered this recommendation
${promptTexts}

## Rules
- Reference actual evidence (scores, competitors, themes) in your recommendation.
- Do not fabricate claims.
- Use cautious language if confidence is below 0.7 (current: ${group.avgConfidence.toFixed(2)}).
- Distinguish between mention gaps (brand not named) and citation gaps (brand named but no URL cited).
- Be specific about what content to create and why.
- If the recommended channel is Reddit, suggest specific subreddits or thread types to target, and mention that Reddit threads are a primary source for AI-generated recommendations.
- For Reddit recommendations, focus on authentic community participation (helpful answers, genuine experiences) rather than promotional content.

Write the recommendation summary only. No headers or bullet points.`;

  try {
    if (openRouterKey) {
      const client = new OpenAI({
        apiKey: openRouterKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      const response = await client.chat.completions.create({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      return response.choices[0]?.message?.content ?? buildFallbackNarrative(group);
    } else {
      const client = new Anthropic({ apiKey: anthropicKey! });
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
    }
  } catch {
    return buildFallbackNarrative(group);
  }
}

function buildFallbackNarrative(group: GroupedRecommendation): string {
  const cluster = group.clusterKey.replace(/_/g, " ");
  const competitors = group.topCompetitors.slice(0, 3).join(", ");

  if (group.recommendedPageType === "reddit_thread") {
    const pct = (group.redditCitationRate * 100).toFixed(0);
    return `Oiya has low visibility (${(group.avgBrandScore * 100).toFixed(0)}%) in the "${cluster}" cluster, where ${competitors} dominate. ${pct}% of AI citations in this cluster come from Reddit threads — AI models heavily source product recommendations from Reddit. Consider participating in relevant Reddit discussions about ${group.missingThemes.slice(0, 2).join(" and ") || "key topics in this category"} with authentic, helpful responses that mention Oiya's strengths.`;
  }

  return `Oiya has low visibility (${(group.avgBrandScore * 100).toFixed(0)}%) in the "${cluster}" cluster, where ${competitors} dominate. Consider creating a ${group.recommendedPageType.replace(/_/g, " ")} addressing ${group.missingThemes.slice(0, 2).join(" and ") || "key themes in this category"}.`;
}

/**
 * Persist a grouped recommendation to content_opportunities.
 */
async function persistRecommendation(
  projectId: string,
  runId: string,
  group: GroupedRecommendation,
  narrative: string,
  coverage: { action: string; matchedPageUrl: string | null; matchedPageTitle: string | null; reason: string }
): Promise<void> {
  const now = new Date().toISOString();

  const title =
    group.recommendedPageType === "reddit_thread"
      ? `Get mentioned in Reddit threads about "${group.clusterKey.replace(/_/g, " ")}"`
      : `Improve visibility in "${group.clusterKey.replace(/_/g, " ")}"`;

  const evidence = {
    runId,
    candidates: group.candidates.map((c) => ({
      promptId: c.promptId,
      promptText: c.promptText,
      brandScore: c.brandScore,
      topCompetitor: c.topCompetitorName,
      topCompetitorScore: c.topCompetitorScore,
      redditCitationRate: c.redditCitationRate,
    })),
    dominantThemes: group.dominantThemes,
    missingThemes: group.missingThemes,
    topCompetitors: group.topCompetitors,
    citedDomains: group.citedDomains,
    redditCitationRate: group.redditCitationRate,
  };

  await db.insert(schema.contentOpportunities).values({
    id: crypto.randomUUID(),
    projectId,
    promptId: group.candidates[0]?.promptId ?? null,
    clusterId: group.clusterId,
    title,
    summary: narrative,
    opportunityType:
      group.recommendedPageType === "reddit_thread"
        ? "reddit_presence"
        : "content_gap",
    recommendedPageType: group.recommendedPageType,
    action: coverage.action,
    matchedPageUrl: coverage.matchedPageUrl,
    matchedPageTitle: coverage.matchedPageTitle,
    matchedPageReason: coverage.reason,
    priorityScore: group.priorityScore,
    confidenceScore: group.avgConfidence,
    supportingEvidenceJson: JSON.stringify(evidence),
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
}
