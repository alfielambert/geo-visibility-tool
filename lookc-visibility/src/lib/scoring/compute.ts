/**
 * Compute and persist scores after a run completes.
 * Reads extracted observations and writes to the scores table.
 */

import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import {
  finalPromptScore,
  mentionRate,
  citationRate,
  projectVisibilityScore,
  clusterVisibilityScore,
  competitorShareOfMention,
  volatility,
} from "./index";
import type { MentionStrength } from "../types/enums";
import { ScoreType } from "../types/enums";

/**
 * Compute all scores for a completed run and persist them.
 */
export async function computeAndPersistScores(
  runId: string,
  projectId: string
): Promise<void> {
  // Fetch all observations for this run
  const observations = await db.query.extractedObservations.findMany({
    where: and(
      eq(schema.extractedObservations.projectId, projectId),
    ),
  });

  // Filter to observations from prompt runs belonging to this run
  const promptRuns = await db.query.promptRuns.findMany({
    where: eq(schema.promptRuns.runId, runId),
  });
  const promptRunIds = new Set(promptRuns.map((pr) => pr.id));
  const runObservations = observations.filter((o) =>
    promptRunIds.has(o.promptRunId)
  );

  if (runObservations.length === 0) return;

  const now = new Date().toISOString();
  const scoresToInsert: Array<{
    id: string;
    projectId: string;
    runId: string;
    promptId: string | null;
    clusterId: string | null;
    scoreType: string;
    scoreValue: number;
    createdAt: string;
  }> = [];

  // 1. Per-prompt scores
  for (const obs of runObservations) {
    const score = finalPromptScore(
      obs.brandPosition,
      obs.brandMentionStrength as MentionStrength,
      obs.brandIsPrimaryRecommendation,
      obs.brandMentioned,
      obs.brandUrlCited
    );

    scoresToInsert.push({
      id: crypto.randomUUID(),
      projectId,
      runId,
      promptId: obs.promptId,
      clusterId: null,
      scoreType: ScoreType.VISIBILITY_SCORE,
      scoreValue: score,
      createdAt: now,
    });
  }

  // 2. Project-level mention rate
  const mentionedCount = runObservations.filter(
    (o) => o.brandMentioned
  ).length;
  const mRate = mentionRate(mentionedCount, runObservations.length);
  scoresToInsert.push({
    id: crypto.randomUUID(),
    projectId,
    runId,
    promptId: null,
    clusterId: null,
    scoreType: ScoreType.MENTION_RATE,
    scoreValue: mRate,
    createdAt: now,
  });

  // 3. Project-level citation rate
  const citedCount = runObservations.filter(
    (o) => o.brandUrlCited
  ).length;
  const cRate = citationRate(citedCount, runObservations.length);
  scoresToInsert.push({
    id: crypto.randomUUID(),
    projectId,
    runId,
    promptId: null,
    clusterId: null,
    scoreType: ScoreType.CITATION_RATE,
    scoreValue: cRate,
    createdAt: now,
  });

  // 4. Project visibility score
  const promptScores = scoresToInsert
    .filter((s) => s.scoreType === ScoreType.VISIBILITY_SCORE && s.promptId)
    .map((s) => s.scoreValue);
  const projScore = projectVisibilityScore(promptScores);
  scoresToInsert.push({
    id: crypto.randomUUID(),
    projectId,
    runId,
    promptId: null,
    clusterId: null,
    scoreType: ScoreType.AVERAGE_POSITION_SCORE,
    scoreValue: projScore,
    createdAt: now,
  });

  // 5. Per-cluster visibility scores
  const clusterGroups = new Map<string, number[]>();
  for (const obs of runObservations) {
    const clusterKey = obs.clusterKey;
    const promptScore = scoresToInsert.find(
      (s) =>
        s.scoreType === ScoreType.VISIBILITY_SCORE &&
        s.promptId === obs.promptId
    );
    if (promptScore) {
      const existing = clusterGroups.get(clusterKey) ?? [];
      existing.push(promptScore.scoreValue);
      clusterGroups.set(clusterKey, existing);
    }
  }

  // Lookup cluster IDs from the database
  const clusters = await db.query.promptClusters.findMany({
    where: eq(schema.promptClusters.projectId, projectId),
  });
  const clusterKeyToId = new Map(clusters.map((c) => [c.key, c.id]));

  for (const [clusterKey, scores] of clusterGroups) {
    const clusterId = clusterKeyToId.get(clusterKey) ?? null;
    scoresToInsert.push({
      id: crypto.randomUUID(),
      projectId,
      runId,
      promptId: null,
      clusterId,
      scoreType: ScoreType.VISIBILITY_SCORE,
      scoreValue: clusterVisibilityScore(scores),
      createdAt: now,
    });
  }

  // 6. Competitor share of mention
  const allMentionedCompetitors = await Promise.all(
    runObservations.map((obs) =>
      db.query.mentionedCompetitors.findMany({
        where: eq(
          schema.mentionedCompetitors.extractedObservationId,
          obs.id
        ),
      })
    )
  );
  const flatMentions = allMentionedCompetitors.flat();
  const totalMentions = flatMentions.length;

  if (totalMentions > 0) {
    const competitorCounts = new Map<string, number>();
    for (const m of flatMentions) {
      competitorCounts.set(
        m.competitorName,
        (competitorCounts.get(m.competitorName) ?? 0) + 1
      );
    }
    for (const [name, count] of competitorCounts) {
      scoresToInsert.push({
        id: crypto.randomUUID(),
        projectId,
        runId,
        promptId: null,
        clusterId: null,
        scoreType: ScoreType.COMPETITOR_SHARE_OF_MENTION,
        scoreValue: competitorShareOfMention(count, totalMentions),
        createdAt: now,
      });
    }
  }

  // 7. Volatility — compare prompt scores across recent runs
  // For first run, volatility is 0. For subsequent runs, compare.
  const previousScores = await db.query.scores.findMany({
    where: and(
      eq(schema.scores.projectId, projectId),
      eq(schema.scores.scoreType, ScoreType.AVERAGE_POSITION_SCORE)
    ),
  });
  const historicalValues = previousScores.map((s) => s.scoreValue);
  historicalValues.push(projScore);
  const vol = volatility(historicalValues);
  scoresToInsert.push({
    id: crypto.randomUUID(),
    projectId,
    runId,
    promptId: null,
    clusterId: null,
    scoreType: ScoreType.VOLATILITY,
    scoreValue: vol,
    createdAt: now,
  });

  // Persist all scores
  if (scoresToInsert.length > 0) {
    await db.insert(schema.scores).values(scoresToInsert);
  }
}
