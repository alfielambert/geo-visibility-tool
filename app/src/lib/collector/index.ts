/**
 * Run collector — orchestrates prompt execution across engines.
 * Creates Run, PromptRun, and RawEngineResponse records.
 */

import { db, schema } from "../db";
import { eq, and } from "drizzle-orm";
import { getEnabledEngines } from "../engines";
import type { EngineAdapter, EnginePromptInput } from "../engines";
import { RunStatus, TriggerType } from "../types/enums";
import { parseResponse } from "../parser";
import { persistObservation } from "../parser/persist";
import { computeAndPersistScores } from "../scoring/compute";
import { generateRecommendations } from "../recommendations";

interface RunResult {
  runId: string;
  status: string;
  totalPromptRuns: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
}

/**
 * Execute a full run: all enabled prompts x all enabled engines.
 * Returns the run ID and summary stats.
 */
export async function executeRun(
  projectId: string,
  triggerType: TriggerType = TriggerType.MANUAL
): Promise<RunResult> {
  const engines = getEnabledEngines();
  if (engines.length === 0) {
    throw new Error(
      "No engines configured. Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY in .env"
    );
  }

  // Fetch project
  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
  });
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  // Fetch enabled prompts
  const prompts = await db.query.prompts.findMany({
    where: and(
      eq(schema.prompts.projectId, projectId),
      eq(schema.prompts.enabled, true)
    ),
  });
  if (prompts.length === 0) {
    throw new Error("No enabled prompts found for project");
  }

  // Fetch competitors for parser context
  const competitors = await db.query.competitors.findMany({
    where: eq(schema.competitors.projectId, projectId),
  });
  const competitorNames = competitors.map((c) => c.name);

  // Fetch prompt clusters for cluster key lookup
  const clusters = await db.query.promptClusters.findMany({
    where: eq(schema.promptClusters.projectId, projectId),
  });
  const clusterMap = new Map(clusters.map((c) => [c.id, c.key]));

  // Create run record
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.runs).values({
    id: runId,
    projectId,
    triggerType,
    status: RunStatus.RUNNING,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  let completedCount = 0;
  let failedCount = 0;
  const totalPromptRuns = prompts.length * engines.length;

  // Execute each prompt x engine combination
  for (const prompt of prompts) {
    for (const engine of engines) {
      try {
        await executePromptRun(
          runId, projectId, prompt, engine, project,
          competitorNames, clusterMap
        );
        completedCount++;
      } catch (error) {
        failedCount++;
        console.error(
          `Failed: prompt=${prompt.id} engine=${engine.name}`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  // Update run status
  const finalStatus =
    failedCount === totalPromptRuns
      ? RunStatus.FAILED
      : failedCount > 0
        ? RunStatus.PARTIAL
        : RunStatus.COMPLETED;

  await db
    .update(schema.runs)
    .set({
      status: finalStatus,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.runs.id, runId));

  // Compute and persist scores after run completes
  if (completedCount > 0) {
    try {
      await computeAndPersistScores(runId, projectId);
    } catch (error) {
      console.error(
        "Score computation failed:",
        error instanceof Error ? error.message : error
      );
    }

    // Generate recommendations based on observation data
    try {
      const recCount = await generateRecommendations(runId, projectId);
      if (recCount > 0) {
        console.log(`Generated ${recCount} recommendations for run ${runId}`);
      }
    } catch (error) {
      console.error(
        "Recommendation generation failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return {
    runId,
    status: finalStatus,
    totalPromptRuns,
    completedPromptRuns: completedCount,
    failedPromptRuns: failedCount,
  };
}

/**
 * Execute a single prompt against a single engine.
 * Creates PromptRun and RawEngineResponse records.
 */
async function executePromptRun(
  runId: string,
  projectId: string,
  prompt: typeof schema.prompts.$inferSelect,
  engine: EngineAdapter,
  project: typeof schema.projects.$inferSelect,
  competitorNames: string[],
  clusterMap: Map<string, string>
): Promise<void> {
  const promptRunId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  // Create prompt run record
  await db.insert(schema.promptRuns).values({
    id: promptRunId,
    runId,
    projectId,
    promptId: prompt.id,
    engine: engine.name,
    status: RunStatus.RUNNING,
    requestedAt,
    createdAt: requestedAt,
    updatedAt: requestedAt,
  });

  const startTime = Date.now();

  try {
    const input: EnginePromptInput = {
      promptText: prompt.promptText,
      promptId: prompt.id,
      projectId,
      brandName: project.brandName,
      brandDomain: project.domain,
    };

    const response = await engine.runPrompt(input);
    const latencyMs = Date.now() - startTime;
    const respondedAt = new Date().toISOString();

    // Update prompt run as completed
    await db
      .update(schema.promptRuns)
      .set({
        status: RunStatus.COMPLETED,
        respondedAt,
        latencyMs,
        updatedAt: respondedAt,
      })
      .where(eq(schema.promptRuns.id, promptRunId));

    // Store raw response
    await db.insert(schema.rawEngineResponses).values({
      id: crypto.randomUUID(),
      promptRunId,
      rawResponseText: response.text,
      rawPayloadJson: response.payloadJson,
      createdAt: respondedAt,
    });

    // Parse the response and persist structured observations
    const clusterKey = clusterMap.get(prompt.clusterId) ?? "unknown";
    const parseResult = await parseResponse({
      projectId,
      promptId: prompt.id,
      promptText: prompt.promptText,
      clusterKey,
      engine: engine.name,
      runId,
      runTimestamp: respondedAt,
      region: prompt.region,
      language: prompt.language,
      rawResponseText: response.text,
      brandName: project.brandName,
      brandDomain: project.domain,
      knownCompetitors: competitorNames,
    });

    if (parseResult.success && parseResult.data) {
      await persistObservation(promptRunId, parseResult.data, project.domain);
    } else {
      console.error(
        `Parse failed for prompt=${prompt.id} engine=${engine.name}: ${parseResult.error}`
      );
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await db
      .update(schema.promptRuns)
      .set({
        status: RunStatus.FAILED,
        latencyMs,
        errorMessage,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.promptRuns.id, promptRunId));

    throw error;
  }
}
