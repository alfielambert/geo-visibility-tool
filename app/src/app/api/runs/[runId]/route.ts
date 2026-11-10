/**
 * API route: GET /api/runs/[runId] — details for a specific run, including
 * progress, per-engine stats, and errors.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const run = await db.query.runs.findFirst({
      where: eq(schema.runs.id, runId),
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const promptRuns = await db.query.promptRuns.findMany({
      where: eq(schema.promptRuns.runId, runId),
    });

    // Per-engine breakdown
    const engineStats: Record<string, { total: number; completed: number; failed: number; running: number }> = {};
    for (const pr of promptRuns) {
      if (!engineStats[pr.engine]) {
        engineStats[pr.engine] = { total: 0, completed: 0, failed: 0, running: 0 };
      }
      engineStats[pr.engine].total++;
      if (pr.status === "completed") engineStats[pr.engine].completed++;
      else if (pr.status === "failed") engineStats[pr.engine].failed++;
      else if (pr.status === "running") engineStats[pr.engine].running++;
    }

    // Get unique error messages
    const errors = promptRuns
      .filter((pr) => pr.errorMessage)
      .map((pr) => ({
        engine: pr.engine,
        error: pr.errorMessage,
      }));

    const uniqueErrors = [
      ...new Map(errors.map((e) => [e.error, e])).values(),
    ];

    // Find currently running prompt for live status
    const currentlyRunning = promptRuns.find((pr) => pr.status === "running");
    let currentPromptText: string | null = null;
    if (currentlyRunning) {
      const prompt = await db.query.prompts.findFirst({
        where: eq(schema.prompts.id, currentlyRunning.promptId),
      });
      currentPromptText = prompt?.promptText ?? null;
    }

    return NextResponse.json({
      run,
      summary: {
        total: promptRuns.length,
        completed: promptRuns.filter((pr) => pr.status === "completed").length,
        failed: promptRuns.filter((pr) => pr.status === "failed").length,
        pending: promptRuns.filter((pr) => pr.status === "pending").length,
        running: promptRuns.filter((pr) => pr.status === "running").length,
      },
      engineStats,
      currentPromptText,
      promptRuns: promptRuns.map((pr) => ({
        id: pr.id,
        promptId: pr.promptId,
        engine: pr.engine,
        status: pr.status,
        latencyMs: pr.latencyMs,
        errorMessage: pr.errorMessage,
      })),
      uniqueErrors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
