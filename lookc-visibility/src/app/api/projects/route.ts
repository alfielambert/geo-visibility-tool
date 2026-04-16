/**
 * API route: GET /api/projects — list all projects.
 * POST /api/projects — create a new project with competitors, clusters, and prompts.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const projects = await db.query.projects.findMany({
      orderBy: [desc(schema.projects.createdAt)],
    });
    return NextResponse.json({ projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface CreateProjectBody {
  name: string;
  domain: string;
  brandName: string;
  brandAliases?: string[];
  competitors: Array<{ name: string; domain?: string }>;
  clusters: Array<{
    key: string;
    label: string;
    description?: string;
    prompts: Array<{ text: string; weight?: number }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProjectBody;

    if (!body.name || !body.domain || !body.brandName) {
      return NextResponse.json(
        { error: "name, domain, and brandName are required" },
        { status: 400 }
      );
    }

    if (!body.clusters || body.clusters.length === 0) {
      return NextResponse.json(
        { error: "At least one cluster with prompts is required" },
        { status: 400 }
      );
    }

    const projectId = crypto.randomUUID();
    const slug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const now = new Date().toISOString();

    // Create project
    await db.insert(schema.projects).values({
      id: projectId,
      name: body.name,
      slug,
      domain: body.domain,
      brandName: body.brandName,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // Create competitors
    if (body.competitors && body.competitors.length > 0) {
      for (const comp of body.competitors) {
        await db.insert(schema.competitors).values({
          id: crypto.randomUUID(),
          projectId,
          name: comp.name,
          domain: comp.domain ?? null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Create clusters and prompts
    let totalPrompts = 0;
    for (const cluster of body.clusters) {
      const clusterId = crypto.randomUUID();
      await db.insert(schema.promptClusters).values({
        id: clusterId,
        projectId,
        key: cluster.key,
        label: cluster.label,
        description: cluster.description ?? null,
        createdAt: now,
        updatedAt: now,
      });

      for (const prompt of cluster.prompts) {
        await db.insert(schema.prompts).values({
          id: crypto.randomUUID(),
          projectId,
          clusterId,
          promptText: prompt.text,
          strategicWeight: prompt.weight ?? 1.0,
          language: "en",
          region: "uk",
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        totalPrompts++;
      }
    }

    return NextResponse.json(
      {
        projectId,
        name: body.name,
        competitorCount: body.competitors?.length ?? 0,
        clusterCount: body.clusters.length,
        promptCount: totalPrompts,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Project creation failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
