/**
 * API route: POST /api/runs — trigger a new run (non-blocking).
 * GET /api/runs — list runs for the default project.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";
import { executeRun } from "@/lib/collector";
import { TriggerType } from "@/lib/types/enums";
import { resolveProject } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json(
        { error: "No project found. Run db:seed first." },
        { status: 404 }
      );
    }

    // Check if a run is already in progress
    const existingRun = await db.query.runs.findFirst({
      where: and(
        eq(schema.runs.projectId, project.id),
        eq(schema.runs.status, "running")
      ),
    });
    if (existingRun) {
      return NextResponse.json(
        { error: "A run is already in progress", runId: existingRun.id },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const triggerType =
      (body as Record<string, string>).triggerType ?? TriggerType.MANUAL;

    // Count expected prompt runs to return immediately
    const prompts = await db.query.prompts.findMany({
      where: and(
        eq(schema.prompts.projectId, project.id),
        eq(schema.prompts.enabled, true)
      ),
    });

    // Fire and forget — run executes in the background
    const runPromise = executeRun(project.id, triggerType as TriggerType);

    // Wait briefly to get the run ID (it's created at the start of executeRun)
    await new Promise((resolve) => setTimeout(resolve, 200));

    const latestRun = await db.query.runs.findFirst({
      where: and(
        eq(schema.runs.projectId, project.id),
        eq(schema.runs.status, "running")
      ),
      orderBy: [desc(schema.runs.startedAt)],
    });

    // Don't await the full run — let it complete in the background
    runPromise.catch((err) => {
      console.error("Background run failed:", err instanceof Error ? err.message : err);
    });

    return NextResponse.json(
      {
        runId: latestRun?.id ?? null,
        status: "running",
        totalExpected: prompts.length * 2, // 2 engines
      },
      { status: 202 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Run trigger failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ runs: [] });
    }

    const runs = await db.query.runs.findMany({
      where: eq(schema.runs.projectId, project.id),
      orderBy: [desc(schema.runs.startedAt)],
    });

    const runsWithCounts = await Promise.all(
      runs.map(async (run) => {
        const promptRuns = await db.query.promptRuns.findMany({
          where: eq(schema.promptRuns.runId, run.id),
        });
        const completed = promptRuns.filter(
          (pr) => pr.status === "completed"
        ).length;
        const failed = promptRuns.filter(
          (pr) => pr.status === "failed"
        ).length;

        return {
          ...run,
          totalPromptRuns: promptRuns.length,
          completedPromptRuns: completed,
          failedPromptRuns: failed,
        };
      })
    );

    return NextResponse.json({ runs: runsWithCounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
