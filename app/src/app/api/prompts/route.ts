/**
 * API route: GET /api/prompts — prompts with per-engine observation data.
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
      return NextResponse.json({ prompts: [] });
    }

    const prompts = await db.query.prompts.findMany({
      where: eq(schema.prompts.projectId, project.id),
    });

    const clusters = await db.query.promptClusters.findMany({
      where: eq(schema.promptClusters.projectId, project.id),
    });
    const clusterMap = new Map(clusters.map((c) => [c.id, c]));

    // Get latest completed or partial run
    const latestRun = await db.query.runs.findMany({
      where: eq(schema.runs.projectId, project.id),
      orderBy: [desc(schema.runs.completedAt)],
      limit: 1,
    });

    if (latestRun.length === 0) {
      return NextResponse.json({
        prompts: prompts.map((p) => ({
          id: p.id,
          promptText: p.promptText,
          cluster: clusterMap.get(p.clusterId)?.label ?? "Unknown",
          clusterKey: clusterMap.get(p.clusterId)?.key ?? "unknown",
          strategicWeight: p.strategicWeight,
          enabled: p.enabled,
          visibilityScore: null,
          brandMentioned: null,
          brandUrlCited: null,
          lastRunDate: null,
          engines: [],
        })),
      });
    }

    const run = latestRun[0];

    // Get scores for this run
    const scores = await db.query.scores.findMany({
      where: eq(schema.scores.runId, run.id),
    });

    // Get observations for this run
    const promptRuns = await db.query.promptRuns.findMany({
      where: eq(schema.promptRuns.runId, run.id),
    });
    const promptRunMap = new Map(promptRuns.map((pr) => [pr.id, pr]));
    const promptRunIds = new Set(promptRuns.map((pr) => pr.id));

    const allObs = await db.query.extractedObservations.findMany({
      where: eq(schema.extractedObservations.projectId, project.id),
    });
    const runObs = allObs.filter((o) => promptRunIds.has(o.promptRunId));

    // Group observations by prompt
    const obsByPrompt = new Map<string, typeof runObs>();
    for (const obs of runObs) {
      const existing = obsByPrompt.get(obs.promptId) ?? [];
      existing.push(obs);
      obsByPrompt.set(obs.promptId, existing);
    }

    // Get raw responses for prompt runs in this run
    const rawResponses = await db.query.rawEngineResponses.findMany();
    const rawByPromptRunId = new Map(rawResponses.map((r) => [r.promptRunId, r]));

    const result = prompts.map((p) => {
      const promptScore = scores.find(
        (s) =>
          s.scoreType === ScoreType.VISIBILITY_SCORE && s.promptId === p.id
      );
      const promptObs = obsByPrompt.get(p.id) ?? [];
      const anyMentioned = promptObs.some((o) => o.brandMentioned);
      const anyCited = promptObs.some((o) => o.brandUrlCited);

      // Per-engine breakdown
      const engines = promptObs.map((obs) => {
        const pr = promptRunMap.get(obs.promptRunId);
        const raw = rawByPromptRunId.get(obs.promptRunId);
        return {
          engine: obs.engine,
          brandMentioned: obs.brandMentioned,
          brandUrlCited: obs.brandUrlCited,
          brandPosition: obs.brandPosition,
          brandMentionStrength: obs.brandMentionStrength,
          brandSentiment: obs.brandSentiment,
          brandSummary: obs.brandSummary,
          competitorCount: obs.competitorCount,
          answerFormat: obs.answerFormat,
          confidenceScore: obs.confidenceScore,
          rawResponse: raw?.rawResponseText ?? null,
          latencyMs: pr?.latencyMs ?? null,
        };
      });

      return {
        id: p.id,
        promptText: p.promptText,
        cluster: clusterMap.get(p.clusterId)?.label ?? "Unknown",
        clusterKey: clusterMap.get(p.clusterId)?.key ?? "unknown",
        strategicWeight: p.strategicWeight,
        enabled: p.enabled,
        visibilityScore: promptScore?.scoreValue ?? null,
        brandMentioned: promptObs.length > 0 ? anyMentioned : null,
        brandUrlCited: promptObs.length > 0 ? anyCited : null,
        lastRunDate: run.completedAt,
        engines,
      };
    });

    return NextResponse.json({ prompts: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
