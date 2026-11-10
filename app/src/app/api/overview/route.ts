/**
 * API route: GET /api/overview — dashboard overview metrics from latest run,
 * including deltas vs the previous run.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, and, inArray } from "drizzle-orm";
import { ScoreType } from "@/lib/types/enums";
import { resolveProject } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ hasData: false });
    }

    // Get last 2 completed or partial runs
    const recentRuns = await db.query.runs.findMany({
      where: and(
        eq(schema.runs.projectId, project.id),
        inArray(schema.runs.status, ["completed", "partial"])
      ),
      orderBy: [desc(schema.runs.completedAt)],
      limit: 2,
    });

    if (recentRuns.length === 0) {
      return NextResponse.json({ hasData: false });
    }

    const run = recentRuns[0];
    const prevRun = recentRuns.length > 1 ? recentRuns[1] : null;

    // Helper: get project-level score from a score set
    const getScore = (scoreSet: typeof scores, type: string) =>
      scoreSet.find((s) => s.scoreType === type && !s.promptId)?.scoreValue ??
      null;

    // Get scores for current run
    const scores = await db.query.scores.findMany({
      where: eq(schema.scores.runId, run.id),
    });

    // Get scores for previous run (for deltas)
    let prevScores: typeof scores = [];
    if (prevRun) {
      prevScores = await db.query.scores.findMany({
        where: eq(schema.scores.runId, prevRun.id),
      });
    }

    const currentVisibility = getScore(scores, ScoreType.AVERAGE_POSITION_SCORE);
    const currentMentionRate = getScore(scores, ScoreType.MENTION_RATE);
    const currentCitationRate = getScore(scores, ScoreType.CITATION_RATE);

    const prevVisibility = getScore(prevScores, ScoreType.AVERAGE_POSITION_SCORE);
    const prevMentionRate = getScore(prevScores, ScoreType.MENTION_RATE);
    const prevCitationRate = getScore(prevScores, ScoreType.CITATION_RATE);

    // Calculate deltas (null if no previous run)
    const delta = (current: number | null, prev: number | null) => {
      if (current === null || prev === null) return null;
      return current - prev;
    };

    // Get observations for current run (for top competitor + reddit rate)
    const promptRuns = await db.query.promptRuns.findMany({
      where: eq(schema.promptRuns.runId, run.id),
    });
    const promptRunIds = new Set(promptRuns.map((pr) => pr.id));
    const allObs = await db.query.extractedObservations.findMany({
      where: eq(schema.extractedObservations.projectId, project.id),
    });
    const runObs = allObs.filter((o) => promptRunIds.has(o.promptRunId));

    let topCompetitor: { name: string; mentions: number } | null = null;
    if (runObs.length > 0) {
      const allMentions = await Promise.all(
        runObs.map((o) =>
          db.query.mentionedCompetitors.findMany({
            where: eq(
              schema.mentionedCompetitors.extractedObservationId,
              o.id
            ),
          })
        )
      );
      const flat = allMentions.flat();
      const counts = new Map<string, number>();
      for (const m of flat) {
        counts.set(m.competitorName, (counts.get(m.competitorName) ?? 0) + 1);
      }
      let maxName = "";
      let maxCount = 0;
      for (const [name, count] of counts) {
        if (count > maxCount) {
          maxCount = count;
          maxName = name;
        }
      }
      if (maxName) {
        topCompetitor = { name: maxName, mentions: maxCount };
      }
    }

    // Top opportunity
    const opportunities = await db.query.contentOpportunities.findMany({
      where: and(
        eq(schema.contentOpportunities.projectId, project.id),
        eq(schema.contentOpportunities.status, "open")
      ),
      orderBy: [desc(schema.contentOpportunities.priorityScore)],
      limit: 1,
    });

    // Cluster scores
    const clusterScores = scores.filter(
      (s) => s.scoreType === ScoreType.VISIBILITY_SCORE && s.clusterId
    );

    // Reddit citation rate
    let redditCitationRate: number | null = null;
    let prevRedditCitationRate: number | null = null;

    if (runObs.length > 0) {
      const allCitations = await Promise.all(
        runObs.map((o) =>
          db.query.responseCitations.findMany({
            where: eq(
              schema.responseCitations.extractedObservationId,
              o.id
            ),
          })
        )
      );
      const flatCitations = allCitations.flat();
      if (flatCitations.length > 0) {
        const redditCount = flatCitations.filter((c) => {
          const d = c.domain.toLowerCase();
          return d === "reddit.com" || d.endsWith(".reddit.com") || d === "redd.it";
        }).length;
        redditCitationRate = redditCount / flatCitations.length;
      }
    }

    // Previous run Reddit citation rate
    if (prevRun) {
      const prevPromptRuns = await db.query.promptRuns.findMany({
        where: eq(schema.promptRuns.runId, prevRun.id),
      });
      const prevPrIds = new Set(prevPromptRuns.map((pr) => pr.id));
      const prevObs = allObs.filter((o) => prevPrIds.has(o.promptRunId));
      if (prevObs.length > 0) {
        const prevCitations = await Promise.all(
          prevObs.map((o) =>
            db.query.responseCitations.findMany({
              where: eq(
                schema.responseCitations.extractedObservationId,
                o.id
              ),
            })
          )
        );
        const prevFlat = prevCitations.flat();
        if (prevFlat.length > 0) {
          const prevRedditCount = prevFlat.filter((c) => {
            const d = c.domain.toLowerCase();
            return d === "reddit.com" || d.endsWith(".reddit.com") || d === "redd.it";
          }).length;
          prevRedditCitationRate = prevRedditCount / prevFlat.length;
        }
      }
    }

    return NextResponse.json({
      hasData: true,
      runId: run.id,
      runDate: run.completedAt,
      prevRunDate: prevRun?.completedAt ?? null,
      visibilityScore: currentVisibility,
      mentionRate: currentMentionRate,
      citationRate: currentCitationRate,
      volatility: getScore(scores, ScoreType.VOLATILITY),
      redditCitationRate,
      deltas: {
        visibilityScore: delta(currentVisibility, prevVisibility),
        mentionRate: delta(currentMentionRate, prevMentionRate),
        citationRate: delta(currentCitationRate, prevCitationRate),
        redditCitationRate: delta(redditCitationRate, prevRedditCitationRate),
      },
      topCompetitor,
      topOpportunity: opportunities[0] ?? null,
      clusterScores: clusterScores.map((s) => ({
        clusterId: s.clusterId,
        score: s.scoreValue,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
