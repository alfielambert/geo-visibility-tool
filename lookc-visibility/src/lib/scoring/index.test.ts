/**
 * Unit tests for all scoring functions (spec §17.1).
 */

import { describe, it, expect } from "vitest";
import {
  positionWeight,
  mentionStrengthWeight,
  primaryRecommendationWeight,
  citationWeight,
  visibilityScore,
  evidenceScore,
  finalPromptScore,
  mentionRate,
  citationRate,
  projectVisibilityScore,
  clusterVisibilityScore,
  competitorShareOfMention,
  competitiveGapScore,
  opportunityScore,
  volatility,
} from "./index";

// ─── §10.1 Position Weight ────────────────────────────────────────────

describe("positionWeight", () => {
  it("returns 1.0 for position 1", () => {
    expect(positionWeight(1)).toBe(1.0);
  });

  it("returns 0.8 for position 2", () => {
    expect(positionWeight(2)).toBe(0.8);
  });

  it("returns 0.6 for position 3", () => {
    expect(positionWeight(3)).toBe(0.6);
  });

  it("returns 0.4 for position 4", () => {
    expect(positionWeight(4)).toBe(0.4);
  });

  it("returns 0.2 for position 5 or higher", () => {
    expect(positionWeight(5)).toBe(0.2);
    expect(positionWeight(10)).toBe(0.2);
    expect(positionWeight(100)).toBe(0.2);
  });

  it("returns 0 for null position", () => {
    expect(positionWeight(null)).toBe(0);
  });
});

// ─── §10.2 Mention Strength Weight ───────────────────────────────────

describe("mentionStrengthWeight", () => {
  it("returns 0 for none", () => {
    expect(mentionStrengthWeight("none")).toBe(0);
  });

  it("returns 0.33 for weak", () => {
    expect(mentionStrengthWeight("weak")).toBe(0.33);
  });

  it("returns 0.66 for moderate", () => {
    expect(mentionStrengthWeight("moderate")).toBe(0.66);
  });

  it("returns 1.0 for strong", () => {
    expect(mentionStrengthWeight("strong")).toBe(1.0);
  });
});

// ─── §10.3 Primary Recommendation Weight ─────────────────────────────

describe("primaryRecommendationWeight", () => {
  it("returns 1.0 when true", () => {
    expect(primaryRecommendationWeight(true)).toBe(1.0);
  });

  it("returns 0 when false", () => {
    expect(primaryRecommendationWeight(false)).toBe(0);
  });
});

// ─── §10.4 Citation Weight ───────────────────────────────────────────

describe("citationWeight", () => {
  it("returns 1.0 when brand URL is cited", () => {
    expect(citationWeight(true, true)).toBe(1.0);
  });

  it("returns 0.4 when brand is mentioned but not cited", () => {
    expect(citationWeight(true, false)).toBe(0.4);
  });

  it("returns 0 when brand is not mentioned", () => {
    expect(citationWeight(false, false)).toBe(0);
  });

  it("returns 1.0 when URL cited even if mentioned is false (edge case)", () => {
    expect(citationWeight(false, true)).toBe(1.0);
  });
});

// ─── §10.5 Visibility Score ─────────────────────────────────────────

describe("visibilityScore", () => {
  it("returns max score for best possible case", () => {
    const score = visibilityScore(1, "strong", true);
    // 1.0 * 0.45 + 1.0 * 0.35 + 1.0 * 0.2 = 1.0
    expect(score).toBe(1.0);
  });

  it("returns 0 for worst case", () => {
    const score = visibilityScore(null, "none", false);
    expect(score).toBe(0);
  });

  it("calculates correctly for position 2, moderate, not primary", () => {
    const score = visibilityScore(2, "moderate", false);
    // 0.8 * 0.45 + 0.66 * 0.35 + 0 * 0.2 = 0.36 + 0.231 = 0.591
    expect(score).toBeCloseTo(0.591, 2);
  });
});

// ─── §10.6 Evidence Score ───────────────────────────────────────────

describe("evidenceScore", () => {
  it("matches citationWeight behavior", () => {
    expect(evidenceScore(true, true)).toBe(1.0);
    expect(evidenceScore(true, false)).toBe(0.4);
    expect(evidenceScore(false, false)).toBe(0);
  });
});

// ─── §10.7 Final Prompt Score ───────────────────────────────────────

describe("finalPromptScore", () => {
  it("returns max for best case", () => {
    const score = finalPromptScore(1, "strong", true, true, true);
    // vis=1.0, ev=1.0 => 1.0*0.75 + 1.0*0.25 = 1.0
    expect(score).toBe(1.0);
  });

  it("returns 0 for worst case", () => {
    const score = finalPromptScore(null, "none", false, false, false);
    expect(score).toBe(0);
  });

  it("gives higher score to cited+mentioned vs just mentioned", () => {
    const cited = finalPromptScore(2, "moderate", false, true, true);
    const mentioned = finalPromptScore(2, "moderate", false, true, false);
    expect(cited).toBeGreaterThan(mentioned);
  });
});

// ─── §10.8 Mention Rate ────────────────────────────────────────────

describe("mentionRate", () => {
  it("calculates rate correctly", () => {
    expect(mentionRate(5, 10)).toBe(0.5);
  });

  it("returns 0 for zero total", () => {
    expect(mentionRate(0, 0)).toBe(0);
  });

  it("returns 1 when all mentioned", () => {
    expect(mentionRate(10, 10)).toBe(1.0);
  });
});

// ─── §10.9 Citation Rate ───────────────────────────────────────────

describe("citationRate", () => {
  it("calculates rate correctly", () => {
    expect(citationRate(3, 10)).toBe(0.3);
  });

  it("returns 0 for zero total", () => {
    expect(citationRate(0, 0)).toBe(0);
  });
});

// ─── §10.10 Project Visibility Score ────────────────────────────────

describe("projectVisibilityScore", () => {
  it("returns scaled average", () => {
    // avg of [0.5, 0.8] = 0.65, * 100 = 65
    expect(projectVisibilityScore([0.5, 0.8])).toBe(65);
  });

  it("returns 0 for empty array", () => {
    expect(projectVisibilityScore([])).toBe(0);
  });

  it("returns 100 for perfect scores", () => {
    expect(projectVisibilityScore([1.0, 1.0, 1.0])).toBe(100);
  });
});

// ─── §10.11 Cluster Visibility Score ────────────────────────────────

describe("clusterVisibilityScore", () => {
  it("uses same formula as project visibility", () => {
    expect(clusterVisibilityScore([0.4, 0.6])).toBe(
      projectVisibilityScore([0.4, 0.6])
    );
  });
});

// ─── §10.12 Competitor Share of Mention ─────────────────────────────

describe("competitorShareOfMention", () => {
  it("calculates share correctly", () => {
    expect(competitorShareOfMention(3, 10)).toBe(0.3);
  });

  it("returns 0 for zero total", () => {
    expect(competitorShareOfMention(0, 0)).toBe(0);
  });

  it("returns 1 when competitor dominates", () => {
    expect(competitorShareOfMention(5, 5)).toBe(1.0);
  });
});

// ─── §10.13 Competitive Gap Score ──────────────────────────────────

describe("competitiveGapScore", () => {
  it("returns positive gap when competitor is ahead", () => {
    expect(competitiveGapScore(0.8, 0.3)).toBe(0.5);
  });

  it("returns 0 when brand is ahead", () => {
    expect(competitiveGapScore(0.3, 0.8)).toBe(0);
  });

  it("returns 0 when equal", () => {
    expect(competitiveGapScore(0.5, 0.5)).toBe(0);
  });
});

// ─── §10.14 Opportunity Score ──────────────────────────────────────

describe("opportunityScore", () => {
  it("returns higher score when brand score is low and competitor is high", () => {
    const high = opportunityScore(0.1, 0.9, true, 1.25, 0.9);
    const low = opportunityScore(0.9, 0.1, false, 0.75, 0.5);
    expect(high).toBeGreaterThan(low);
  });

  it("weights citations correctly", () => {
    const withCitations = opportunityScore(0.3, 0.7, true, 1.0, 0.8);
    const withoutCitations = opportunityScore(0.3, 0.7, false, 1.0, 0.8);
    expect(withCitations).toBeGreaterThan(withoutCitations);
  });

  it("returns value between 0 and 1", () => {
    const score = opportunityScore(0.5, 0.5, true, 1.0, 0.5);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ─── §10.15 Volatility ────────────────────────────────────────────

describe("volatility", () => {
  it("returns 0 for single score", () => {
    expect(volatility([0.5])).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(volatility([])).toBe(0);
  });

  it("returns 0 for identical scores", () => {
    expect(volatility([0.5, 0.5, 0.5])).toBe(0);
  });

  it("returns correct standard deviation", () => {
    // scores: [2, 4, 4, 4, 5, 5, 7, 9]
    // mean = 5, variance = 4, std = 2
    expect(volatility([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });

  it("increases with more spread-out scores", () => {
    const tight = volatility([0.5, 0.51, 0.49]);
    const wide = volatility([0.1, 0.5, 0.9]);
    expect(wide).toBeGreaterThan(tight);
  });
});
