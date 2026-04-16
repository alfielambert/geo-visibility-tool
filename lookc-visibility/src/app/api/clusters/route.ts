/**
 * API route: GET /api/clusters — cluster data with visibility scores.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { ScoreType } from "@/lib/types/enums";
import { resolveProject } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ clusters: [] });
    }

    const clusters = await db.query.promptClusters.findMany({
      where: eq(schema.promptClusters.projectId, project.id),
    });

    // Get latest completed run
    const latestRun = await db.query.runs.findMany({
      where: eq(schema.runs.projectId, project.id),
      orderBy: [desc(schema.runs.completedAt)],
      limit: 1,
    });

    if (latestRun.length === 0) {
      return NextResponse.json({
        clusters: clusters.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          description: c.description,
          visibilityScore: null,
          promptCount: 0,
          dominantThemes: [],
        })),
      });
    }

    const run = latestRun[0];

    // Get cluster scores for this run
    const scores = await db.query.scores.findMany({
      where: eq(schema.scores.runId, run.id),
    });

    // Get prompt counts per cluster
    const prompts = await db.query.prompts.findMany({
      where: eq(schema.prompts.projectId, project.id),
    });

    const promptCountByCluster = new Map<string, number>();
    for (const p of prompts) {
      promptCountByCluster.set(
        p.clusterId,
        (promptCountByCluster.get(p.clusterId) ?? 0) + 1
      );
    }

    // Get themes from observations in this run
    const promptRuns = await db.query.promptRuns.findMany({
      where: eq(schema.promptRuns.runId, run.id),
    });
    const promptRunIds = new Set(promptRuns.map((pr) => pr.id));
    const allObs = await db.query.extractedObservations.findMany({
      where: eq(schema.extractedObservations.projectId, project.id),
    });
    const runObs = allObs.filter((o) => promptRunIds.has(o.promptRunId));

    // Group themes by cluster
    const themesByCluster = new Map<string, string[]>();
    for (const obs of runObs) {
      const themes = await db.query.detectedThemes.findMany({
        where: eq(schema.detectedThemes.extractedObservationId, obs.id),
      });
      const dominant = themes
        .filter((t) => t.themeType === "dominant_themes_in_answer")
        .map((t) => t.themeValue);
      const existing = themesByCluster.get(obs.clusterKey) ?? [];
      existing.push(...dominant);
      themesByCluster.set(obs.clusterKey, existing);
    }

    const result = clusters.map((c) => {
      const clusterScore = scores.find(
        (s) =>
          s.scoreType === ScoreType.VISIBILITY_SCORE && s.clusterId === c.id
      );
      const rawThemes = themesByCluster.get(c.key) ?? [];
      const uniqueThemes = [...new Set(rawThemes)].slice(0, 5);

      return {
        id: c.id,
        key: c.key,
        label: c.label,
        description: c.description,
        visibilityScore: clusterScore?.scoreValue ?? null,
        promptCount: promptCountByCluster.get(c.id) ?? 0,
        dominantThemes: uniqueThemes,
      };
    });

    return NextResponse.json({ clusters: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
