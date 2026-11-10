/**
 * Deterministic scoring functions.
 * All numeric scoring is pure — no LLM involvement.
 */

// ─── Position Weight (§10.1) ─────────────────────────────────────────

export function positionWeight(position: number | null): number {
  if (position === null || position === undefined) return 0;
  if (position === 1) return 1.0;
  if (position === 2) return 0.8;
  if (position === 3) return 0.6;
  if (position === 4) return 0.4;
  return 0.2; // position 5+
}

// ─── Mention Strength Weight (§10.2) ─────────────────────────────────

export function mentionStrengthWeight(
  strength: "none" | "weak" | "moderate" | "strong"
): number {
  switch (strength) {
    case "none":
      return 0;
    case "weak":
      return 0.33;
    case "moderate":
      return 0.66;
    case "strong":
      return 1.0;
    default:
      return 0;
  }
}

// ─── Primary Recommendation Weight (§10.3) ───────────────────────────

export function primaryRecommendationWeight(isPrimary: boolean): number {
  return isPrimary ? 1.0 : 0;
}

// ─── Citation Weight (§10.4) ─────────────────────────────────────────

export function citationWeight(
  brandMentioned: boolean,
  brandUrlCited: boolean
): number {
  if (brandUrlCited) return 1.0;
  if (brandMentioned) return 0.4;
  return 0;
}

// ─── Prompt Visibility Score (§10.5) ─────────────────────────────────

export function visibilityScore(
  position: number | null,
  strength: "none" | "weak" | "moderate" | "strong",
  isPrimary: boolean
): number {
  return (
    positionWeight(position) * 0.45 +
    mentionStrengthWeight(strength) * 0.35 +
    primaryRecommendationWeight(isPrimary) * 0.2
  );
}

// ─── Evidence Score (§10.6) ──────────────────────────────────────────

export function evidenceScore(
  brandMentioned: boolean,
  brandUrlCited: boolean
): number {
  return citationWeight(brandMentioned, brandUrlCited);
}

// ─── Final Prompt Score (§10.7) ──────────────────────────────────────

export function finalPromptScore(
  position: number | null,
  strength: "none" | "weak" | "moderate" | "strong",
  isPrimary: boolean,
  brandMentioned: boolean,
  brandUrlCited: boolean
): number {
  const vis = visibilityScore(position, strength, isPrimary);
  const ev = evidenceScore(brandMentioned, brandUrlCited);
  return vis * 0.75 + ev * 0.25;
}

// ─── Mention Rate (§10.8) ────────────────────────────────────────────

export function mentionRate(
  mentionedCount: number,
  totalPrompts: number
): number {
  if (totalPrompts === 0) return 0;
  return mentionedCount / totalPrompts;
}

// ─── Citation Rate (§10.9) ───────────────────────────────────────────

export function citationRate(
  citedCount: number,
  totalPrompts: number
): number {
  if (totalPrompts === 0) return 0;
  return citedCount / totalPrompts;
}

// ─── Project Visibility Score (§10.10) ───────────────────────────────

export function projectVisibilityScore(promptScores: number[]): number {
  if (promptScores.length === 0) return 0;
  const avg =
    promptScores.reduce((sum, s) => sum + s, 0) / promptScores.length;
  return avg * 100;
}

// ─── Cluster Visibility Score (§10.11) ───────────────────────────────

export function clusterVisibilityScore(promptScores: number[]): number {
  return projectVisibilityScore(promptScores); // Same formula, different scope
}

// ─── Competitor Share of Mention (§10.12) ────────────────────────────

export function competitorShareOfMention(
  competitorMentions: number,
  totalMentions: number
): number {
  if (totalMentions === 0) return 0;
  return competitorMentions / totalMentions;
}

// ─── Competitive Gap Score (§10.13) ──────────────────────────────────

export function competitiveGapScore(
  maxCompetitorScore: number,
  brandScore: number
): number {
  return Math.max(0, maxCompetitorScore - brandScore);
}

// ─── Opportunity Score (§10.14) ──────────────────────────────────────

export function opportunityScore(
  brandPromptScore: number,
  topCompetitorScore: number,
  citationsPresent: boolean,
  strategicWeight: number,
  parserConfidence: number,
  maxStrategicWeight: number = 1.25
): number {
  const citationsWeight = citationsPresent ? 1.0 : 0.3;
  const normalizedStrategicWeight =
    maxStrategicWeight > 0 ? strategicWeight / maxStrategicWeight : 0;

  return (
    (1 - brandPromptScore) * 0.35 +
    topCompetitorScore * 0.25 +
    citationsWeight * 0.15 +
    normalizedStrategicWeight * 0.15 +
    parserConfidence * 0.1
  );
}

// ─── Volatility (§10.15) ────────────────────────────────────────────

export function volatility(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}
