/**
 * API route: GET /api/recommendations — content opportunities with evidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { resolveProject } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ recommendations: [] });
    }

    const opportunities = await db.query.contentOpportunities.findMany({
      where: eq(schema.contentOpportunities.projectId, project.id),
      orderBy: [desc(schema.contentOpportunities.priorityScore)],
    });

    // Enrich with cluster labels
    const clusters = await db.query.promptClusters.findMany({
      where: eq(schema.promptClusters.projectId, project.id),
    });
    const clusterMap = new Map(clusters.map((c) => [c.id, c]));

    const result = opportunities.map((o) => {
      const cluster = o.clusterId ? clusterMap.get(o.clusterId) : null;

      // Parse supporting evidence
      let evidence: Record<string, unknown> = {};
      try {
        evidence = JSON.parse(o.supportingEvidenceJson);
      } catch {
        // Leave empty
      }

      return {
        id: o.id,
        title: o.title,
        summary: o.summary,
        opportunityType: o.opportunityType,
        recommendedPageType: o.recommendedPageType,
        action: o.action ?? "create",
        matchedPageUrl: o.matchedPageUrl ?? null,
        matchedPageTitle: o.matchedPageTitle ?? null,
        matchedPageReason: o.matchedPageReason ?? null,
        priorityScore: o.priorityScore,
        confidenceScore: o.confidenceScore,
        status: o.status,
        clusterLabel: cluster?.label ?? null,
        createdAt: o.createdAt,
        evidence,
      };
    });

    return NextResponse.json({ recommendations: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
