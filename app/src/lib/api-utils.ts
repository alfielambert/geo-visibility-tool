/**
 * Shared API utilities.
 */

import { NextRequest } from "next/server";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";

/**
 * Resolve the active project from a request's ?projectId= query param.
 * Falls back to the first project if no param is provided (backwards compat).
 */
export async function resolveProject(request?: NextRequest | Request | null) {
  let projectId: string | null = null;

  if (request) {
    const url = new URL(request.url);
    projectId = url.searchParams.get("projectId");
  }

  if (projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    });
    return project ?? null;
  }

  // Fallback: first project
  return (await db.query.projects.findFirst()) ?? null;
}
