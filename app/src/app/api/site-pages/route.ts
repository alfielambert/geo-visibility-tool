/**
 * API route: GET /api/site-pages — list all indexed pages for a project.
 * POST /api/site-pages — import pages from a sitemap URL or add manually.
 * DELETE /api/site-pages — clear all pages for a project.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { resolveProject } from "@/lib/api-utils";
import { fetchSitemap } from "@/lib/site-inventory";

export async function GET(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) return NextResponse.json({ pages: [] });

    const pages = await db.query.sitePages.findMany({
      where: eq(schema.sitePages.projectId, project.id),
    });

    return NextResponse.json({ pages, total: pages.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface ImportBody {
  sitemapUrl?: string;
  pages?: Array<{ url: string; title?: string; metaDescription?: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ error: "No project found" }, { status: 404 });
    }

    const body = (await request.json()) as ImportBody;
    const now = new Date().toISOString();
    let importedPages: Array<{ url: string; title: string | null; metaDescription: string | null }> = [];

    if (body.sitemapUrl) {
      const fetched = await fetchSitemap(body.sitemapUrl);
      importedPages = fetched.map((p) => ({
        url: p.url,
        title: p.title,
        metaDescription: p.metaDescription,
      }));
    } else if (body.pages && body.pages.length > 0) {
      importedPages = body.pages.map((p) => ({
        url: p.url,
        title: p.title ?? null,
        metaDescription: p.metaDescription ?? null,
      }));
    } else {
      return NextResponse.json(
        { error: "Provide either sitemapUrl or pages array" },
        { status: 400 }
      );
    }

    if (importedPages.length === 0) {
      return NextResponse.json({ imported: 0, message: "No pages found in sitemap" });
    }

    // Upsert: delete existing pages from same source then re-insert
    const source = body.sitemapUrl ? "sitemap" : "manual";
    const existing = await db.query.sitePages.findMany({
      where: eq(schema.sitePages.projectId, project.id),
    });
    const existingUrls = new Set(existing.map((p) => p.url));

    // Only insert pages not already present
    const newPages = importedPages.filter((p) => !existingUrls.has(p.url));

    for (const page of newPages) {
      await db.insert(schema.sitePages).values({
        id: crypto.randomUUID(),
        projectId: project.id,
        url: page.url,
        title: page.title,
        metaDescription: page.metaDescription,
        source,
        indexedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      imported: newPages.length,
      skipped: importedPages.length - newPages.length,
      total: existing.length + newPages.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const project = await resolveProject(request);
    if (!project) {
      return NextResponse.json({ error: "No project found" }, { status: 404 });
    }

    await db.delete(schema.sitePages).where(eq(schema.sitePages.projectId, project.id));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
