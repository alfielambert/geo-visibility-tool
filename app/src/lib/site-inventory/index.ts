/**
 * Site inventory — fetches and stores indexed pages, then checks whether
 * a proposed recommendation topic is already covered by an existing page.
 *
 * Coverage actions:
 *   create     — no existing page covers this intent
 *   refresh    — existing page covers the intent but may be outdated/thin
 *   expand     — existing page covers the intent but too narrowly
 *   reposition — existing page exists but targets wrong angle/audience
 */

import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

export interface SitePage {
  url: string;
  title: string | null;
  metaDescription: string | null;
}

export type CoverageAction = "create" | "refresh" | "expand" | "reposition";

export interface CoverageResult {
  action: CoverageAction;
  matchedPageUrl: string | null;
  matchedPageTitle: string | null;
  reason: string;
}

// ---------------------------------------------------------------------------
// Sitemap fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch a sitemap URL and extract all page entries.
 * Supports standard sitemap index and urlset formats.
 * Does not depend on any XML library — uses regex extraction.
 */
export async function fetchSitemap(sitemapUrl: string): Promise<SitePage[]> {
  const res = await fetch(sitemapUrl, {
    headers: { "User-Agent": "GEO-Visibility-Bot/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Sitemap fetch failed: ${res.status} ${sitemapUrl}`);
  }

  const xml = await res.text();

  // Sitemap index — recurse into child sitemaps
  if (xml.includes("<sitemapindex")) {
    const childUrls = [...xml.matchAll(/<loc>\s*(https?[^<]+)\s*<\/loc>/gi)].map(
      (m) => m[1].trim()
    );
    const results: SitePage[] = [];
    for (const childUrl of childUrls.slice(0, 10)) {
      try {
        const pages = await fetchSitemap(childUrl);
        results.push(...pages);
      } catch {
        // skip broken child sitemaps
      }
    }
    return results;
  }

  // Standard urlset
  const urlBlocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)];
  return urlBlocks.map((block) => {
    const content = block[1];
    const url = content.match(/<loc>\s*(https?[^<]+)\s*<\/loc>/i)?.[1]?.trim() ?? "";
    const title = content.match(/<(?:news:)?title>\s*([^<]+)\s*<\/(?:news:)?title>/i)?.[1]?.trim() ?? null;
    return { url, title, metaDescription: null };
  }).filter((p) => p.url);
}

// ---------------------------------------------------------------------------
// Coverage check
// ---------------------------------------------------------------------------

/**
 * Semantically compare a recommendation's topic against all known site pages
 * for the project. Returns the action type and (if matched) which page to act on.
 *
 * If no pages are indexed, returns action: "create" with a note.
 */
export async function checkPageCoverage(
  projectId: string,
  clusterKey: string,
  promptTexts: string[],
  dominantThemes: string[],
  missingThemes: string[]
): Promise<CoverageResult> {
  const pages = await db.query.sitePages.findMany({
    where: eq(schema.sitePages.projectId, projectId),
  });

  if (pages.length === 0) {
    return {
      action: "create",
      matchedPageUrl: null,
      matchedPageTitle: null,
      reason: "No pages in site inventory. Import your sitemap to enable cannibalisation checks.",
    };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    return {
      action: "create",
      matchedPageUrl: null,
      matchedPageTitle: null,
      reason: "No LLM key available for semantic comparison.",
    };
  }

  const pageList = pages
    .map((p, i) => {
      const desc = p.metaDescription ? ` — ${p.metaDescription}` : "";
      const title = p.title ? `"${p.title}"` : "(no title)";
      return `${i + 1}. ${p.url} | ${title}${desc}`;
    })
    .join("\n");

  const topic = [
    `Cluster: ${clusterKey.replace(/_/g, " ")}`,
    `Representative searches: ${promptTexts.slice(0, 5).join("; ")}`,
    dominantThemes.length > 0 ? `Themes AI covers: ${dominantThemes.join(", ")}` : null,
    missingThemes.length > 0 ? `Themes missing from brand: ${missingThemes.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a content strategist auditing a website for SEO/AEO cannibalisation.

## Proposed recommendation topic
${topic}

## Existing site pages
${pageList}

## Task
Determine whether any existing page already covers the same search intent as the proposed topic.

Rules:
- Compare INTENT and TOPIC COVERAGE, not just keywords or URL slugs.
- A page that covers the same core question from the same angle = MATCH.
- A page that covers a related but genuinely distinct sub-topic = NO MATCH.
- Reddit or competitor pages in the list are irrelevant — only consider brand pages.

If a match is found, classify the action:
- refresh: Page exists but is likely thin, outdated, or could be improved with fresher data.
- expand: Page exists but covers the topic too narrowly — a section or angle is missing.
- reposition: Page exists but targets the wrong audience or intent (e.g. product page vs. informational guide).

Respond ONLY with JSON (no markdown, no prose):
{
  "match": true | false,
  "action": "create" | "refresh" | "expand" | "reposition",
  "matchedUrl": "<url or null>",
  "matchedTitle": "<title or null>",
  "reason": "<one sentence explaining why, naming the page if matched>"
}`;

  try {
    const client = new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const response = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      match: boolean;
      action: CoverageAction;
      matchedUrl: string | null;
      matchedTitle: string | null;
      reason: string;
    };

    return {
      action: parsed.action ?? "create",
      matchedPageUrl: parsed.matchedUrl ?? null,
      matchedPageTitle: parsed.matchedTitle ?? null,
      reason: parsed.reason ?? "",
    };
  } catch {
    return {
      action: "create",
      matchedPageUrl: null,
      matchedPageTitle: null,
      reason: "Coverage check failed — defaulting to create.",
    };
  }
}
