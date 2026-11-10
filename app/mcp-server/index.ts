#!/usr/bin/env npx tsx
/**
 * GEO Visibility Tool: MCP Server
 *
 * Exposes the visibility tool's API as MCP tools so Claude Code agents
 * can trigger runs, check scores, and get recommendations programmatically.
 *
 * Talks to the local Next.js dev server at BASE_URL (default http://localhost:3000).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.VISIBILITY_API_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function api<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown }
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function fmt(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "N/A";
  return `${(value * 100).toFixed(1)}%${suffix}`;
}

function fmtDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const sign = value >= 0 ? "+" : "";
  return ` (${sign}${(value * 100).toFixed(1)}pp)`;
}

function fmtScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "geo-visibility",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: list-projects
// ---------------------------------------------------------------------------

server.tool(
  "list-projects",
  "List all configured projects in the visibility tool",
  {},
  async () => {
    const data = await api<{
      projects: Array<{
        id: string;
        name: string;
        slug: string;
        domain: string;
        brandName: string;
        status: string;
      }>;
    }>("/api/projects");

    if (data.projects.length === 0) {
      return { content: [{ type: "text", text: "No projects configured. Create one via the web UI at /projects/new" }] };
    }

    const lines = data.projects.map(
      (p, i) => `${i + 1}. **${p.brandName}** (${p.domain}) — ID: ${p.id} [${p.status}]`
    );

    return {
      content: [{ type: "text", text: `## Projects\n\n${lines.join("\n")}` }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get-overview
// ---------------------------------------------------------------------------

server.tool(
  "get-overview",
  "Get current visibility scores, mention rate, citation rate, and deltas vs previous run for a project",
  {
    projectId: z.string().optional().describe("Project ID (uses default project if omitted)"),
  },
  async ({ projectId }) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    const data = await api<{
      hasData: boolean;
      runDate?: string;
      prevRunDate?: string;
      visibilityScore?: number;
      mentionRate?: number;
      citationRate?: number;
      volatility?: number;
      redditCitationRate?: number;
      deltas?: {
        visibilityScore: number | null;
        mentionRate: number | null;
        citationRate: number | null;
        redditCitationRate: number | null;
      };
      topCompetitor?: { name: string; mentions: number } | null;
      topOpportunity?: { title: string; priorityScore: number } | null;
      clusterScores?: Array<{ clusterId: string; score: number }>;
    }>(`/api/overview${qs}`);

    if (!data.hasData) {
      return { content: [{ type: "text", text: "No run data yet. Trigger a run first." }] };
    }

    const d = data.deltas;
    const lines = [
      `## Visibility Overview`,
      ``,
      `**Last run:** ${data.runDate ?? "unknown"}`,
      data.prevRunDate ? `**Previous run:** ${data.prevRunDate}` : null,
      ``,
      `| Metric | Value | Change |`,
      `|--------|-------|--------|`,
      `| Visibility Score | ${fmtScore(data.visibilityScore)} | ${fmtDelta(d?.visibilityScore)} |`,
      `| Mention Rate | ${fmt(data.mentionRate)} | ${fmtDelta(d?.mentionRate)} |`,
      `| Citation Rate | ${fmt(data.citationRate)} | ${fmtDelta(d?.citationRate)} |`,
      `| Reddit Citation Rate | ${fmt(data.redditCitationRate)} | ${fmtDelta(d?.redditCitationRate)} |`,
      `| Volatility | ${fmtScore(data.volatility)} | |`,
      ``,
      data.topCompetitor
        ? `**Top competitor:** ${data.topCompetitor.name} (${data.topCompetitor.mentions} mentions)`
        : null,
      data.topOpportunity
        ? `**Top opportunity:** ${data.topOpportunity.title} (priority: ${data.topOpportunity.priorityScore.toFixed(2)})`
        : null,
    ];

    return {
      content: [{ type: "text", text: lines.filter(Boolean).join("\n") }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: trigger-run
// ---------------------------------------------------------------------------

server.tool(
  "trigger-run",
  "Start a new visibility analysis run. Returns the run ID for tracking progress. The run executes in the background — use get-run-status to monitor it.",
  {
    projectId: z.string().optional().describe("Project ID (uses default project if omitted)"),
  },
  async ({ projectId }) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    try {
      const data = await api<{
        runId: string | null;
        status: string;
        totalExpected: number;
      }>(`/api/runs${qs}`, { method: "POST", body: { triggerType: "manual" } });

      return {
        content: [{
          type: "text",
          text: [
            `## Run Triggered`,
            ``,
            `- **Run ID:** ${data.runId}`,
            `- **Status:** ${data.status}`,
            `- **Expected prompt-engine combos:** ${data.totalExpected}`,
            ``,
            `Use \`get-run-status\` with this run ID to monitor progress.`,
          ].join("\n"),
        }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("409")) {
        return {
          content: [{ type: "text", text: "A run is already in progress. Use `get-run-status` to check its progress, or wait for it to finish." }],
        };
      }
      throw err;
    }
  }
);

// ---------------------------------------------------------------------------
// Tool: get-run-status
// ---------------------------------------------------------------------------

server.tool(
  "get-run-status",
  "Check the status and progress of a specific run, or list recent runs if no run ID is provided",
  {
    runId: z.string().optional().describe("Run ID to check. If omitted, lists the 5 most recent runs."),
    projectId: z.string().optional().describe("Project ID (only used when listing runs, not for a specific run ID)"),
  },
  async ({ runId, projectId }) => {
    if (runId) {
      const data = await api<{
        run: { id: string; status: string; startedAt: string; completedAt: string | null };
        summary: { total: number; completed: number; failed: number; pending: number; running: number };
        engineStats: Record<string, { total: number; completed: number; failed: number; running: number }>;
        currentPromptText: string | null;
        uniqueErrors: Array<{ engine: string; error: string }>;
      }>(`/api/runs/${runId}`);

      const { run, summary, engineStats, currentPromptText, uniqueErrors } = data;
      const pct = summary.total > 0 ? ((summary.completed + summary.failed) / summary.total * 100).toFixed(0) : "0";

      const lines = [
        `## Run ${run.id.slice(0, 8)}...`,
        ``,
        `- **Status:** ${run.status}`,
        `- **Started:** ${run.startedAt}`,
        run.completedAt ? `- **Completed:** ${run.completedAt}` : null,
        `- **Progress:** ${summary.completed + summary.failed}/${summary.total} (${pct}%)`,
        `  - Completed: ${summary.completed}`,
        `  - Failed: ${summary.failed}`,
        `  - Running: ${summary.running}`,
        `  - Pending: ${summary.pending}`,
      ];

      if (Object.keys(engineStats).length > 0) {
        lines.push(``, `### Per-engine`);
        for (const [engine, stats] of Object.entries(engineStats)) {
          lines.push(`- **${engine}:** ${stats.completed}/${stats.total} done, ${stats.failed} failed`);
        }
      }

      if (currentPromptText) {
        lines.push(``, `### Currently processing`, `> ${currentPromptText}`);
      }

      if (uniqueErrors.length > 0) {
        lines.push(``, `### Errors`);
        for (const e of uniqueErrors) {
          lines.push(`- [${e.engine}] ${e.error}`);
        }
      }

      return { content: [{ type: "text", text: lines.filter(Boolean).join("\n") }] };
    }

    // List recent runs
    const qs = projectId ? `?projectId=${projectId}` : "";
    const data = await api<{
      runs: Array<{
        id: string;
        status: string;
        startedAt: string;
        completedAt: string | null;
        triggerType: string;
        totalPromptRuns: number;
        completedPromptRuns: number;
        failedPromptRuns: number;
      }>;
    }>(`/api/runs${qs}`);

    if (data.runs.length === 0) {
      return { content: [{ type: "text", text: "No runs found. Trigger one with `trigger-run`." }] };
    }

    const lines = [`## Recent Runs`, ``];
    for (const run of data.runs.slice(0, 5)) {
      const pct = run.totalPromptRuns > 0
        ? ((run.completedPromptRuns + run.failedPromptRuns) / run.totalPromptRuns * 100).toFixed(0)
        : "0";
      lines.push(
        `- **${run.id.slice(0, 8)}...** [${run.status}] — ${run.startedAt} — ${run.completedPromptRuns}/${run.totalPromptRuns} (${pct}%) — ${run.failedPromptRuns} failed — trigger: ${run.triggerType}`
      );
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get-recommendations
// ---------------------------------------------------------------------------

server.tool(
  "get-recommendations",
  "Get content recommendations and opportunities with evidence, content briefs, and priority scores",
  {
    projectId: z.string().optional().describe("Project ID (uses default project if omitted)"),
    limit: z.number().optional().default(10).describe("Max number of recommendations to return (default 10)"),
  },
  async ({ projectId, limit }) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    const data = await api<{
      recommendations: Array<{
        id: string;
        title: string;
        summary: string;
        opportunityType: string;
        recommendedPageType: string | null;
        priorityScore: number;
        confidenceScore: number;
        status: string;
        clusterLabel: string | null;
        evidence: {
          candidates?: Array<{ promptText: string; brandScore: number; topCompetitorName: string }>;
          dominantThemes?: string[];
          missingThemes?: string[];
          topCompetitors?: string[];
          citedDomains?: string[];
          redditCitationRate?: number;
        };
      }>;
    }>(`/api/recommendations${qs}`);

    const recs = data.recommendations.slice(0, limit);

    if (recs.length === 0) {
      return { content: [{ type: "text", text: "No recommendations yet. Run a visibility analysis first." }] };
    }

    const lines = [`## Content Recommendations`, ``, `Found ${data.recommendations.length} total. Showing top ${recs.length}:`, ``];

    for (const rec of recs) {
      lines.push(`### ${rec.title}`);
      lines.push(`**Priority:** ${rec.priorityScore.toFixed(2)} | **Confidence:** ${rec.confidenceScore.toFixed(2)} | **Status:** ${rec.status} | **Type:** ${rec.opportunityType}`);
      if (rec.recommendedPageType) lines.push(`**Recommended format:** ${rec.recommendedPageType}`);
      if (rec.clusterLabel) lines.push(`**Cluster:** ${rec.clusterLabel}`);
      lines.push(``);
      lines.push(rec.summary);
      lines.push(``);

      const ev = rec.evidence;
      if (ev?.candidates && ev.candidates.length > 0) {
        lines.push(`**Searches you're not appearing in:**`);
        for (const c of ev.candidates.slice(0, 5)) {
          lines.push(`- "${c.promptText}" — your score: ${(c.brandScore * 100).toFixed(0)}%, top competitor: ${c.topCompetitorName}`);
        }
        lines.push(``);
      }

      if (ev?.missingThemes && ev.missingThemes.length > 0) {
        lines.push(`**Topics to cover:** ${ev.missingThemes.join(", ")}`);
      }

      if (ev?.topCompetitors && ev.topCompetitors.length > 0) {
        lines.push(`**Competitors dominating:** ${ev.topCompetitors.join(", ")}`);
      }

      if (ev?.citedDomains && ev.citedDomains.length > 0) {
        lines.push(`**Domains AI is citing:** ${ev.citedDomains.join(", ")}`);
      }

      if (ev?.redditCitationRate) {
        lines.push(`**Reddit citation rate:** ${(ev.redditCitationRate * 100).toFixed(1)}%`);
      }

      lines.push(``, `---`, ``);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Tool: get-prompts
// ---------------------------------------------------------------------------

server.tool(
  "get-prompts",
  "Get prompt-level results with per-engine breakdown (GPT-4o vs Claude), visibility scores, and mention/citation data",
  {
    projectId: z.string().optional().describe("Project ID (uses default project if omitted)"),
    cluster: z.string().optional().describe("Filter to a specific cluster key (e.g. 'product_discovery')"),
    mentionedOnly: z.boolean().optional().default(false).describe("Only show prompts where brand was mentioned"),
    notMentionedOnly: z.boolean().optional().default(false).describe("Only show prompts where brand was NOT mentioned"),
  },
  async ({ projectId, cluster, mentionedOnly, notMentionedOnly }) => {
    const qs = projectId ? `?projectId=${projectId}` : "";
    const data = await api<{
      prompts: Array<{
        id: string;
        promptText: string;
        cluster: string;
        clusterKey: string;
        strategicWeight: number;
        enabled: boolean;
        visibilityScore: number | null;
        brandMentioned: boolean | null;
        brandUrlCited: boolean | null;
        lastRunDate: string | null;
        engines: Array<{
          engine: string;
          brandMentioned: boolean;
          brandUrlCited: boolean;
          brandPosition: number | null;
          brandMentionStrength: string | null;
          brandSentiment: string | null;
          competitorCount: number | null;
          answerFormat: string | null;
        }>;
      }>;
    }>(`/api/prompts${qs}`);

    let prompts = data.prompts;

    if (cluster) {
      prompts = prompts.filter((p) => p.clusterKey === cluster);
    }
    if (mentionedOnly) {
      prompts = prompts.filter((p) => p.brandMentioned === true);
    }
    if (notMentionedOnly) {
      prompts = prompts.filter((p) => p.brandMentioned === false);
    }

    if (prompts.length === 0) {
      return { content: [{ type: "text", text: "No prompts match the filters." }] };
    }

    const lines = [
      `## Prompt Results (${prompts.length} prompts)`,
      ``,
      `| Prompt | Cluster | Score | Mentioned | Cited | Engines |`,
      `|--------|---------|-------|-----------|-------|---------|`,
    ];

    for (const p of prompts) {
      const mentioned = p.brandMentioned === null ? "—" : p.brandMentioned ? "Yes" : "No";
      const cited = p.brandUrlCited === null ? "—" : p.brandUrlCited ? "Yes" : "No";
      const score = p.visibilityScore !== null ? p.visibilityScore.toFixed(2) : "—";
      const engineSummary = p.engines
        .map((e) => `${e.engine}:${e.brandMentioned ? "M" : "-"}${e.brandUrlCited ? "C" : "-"}`)
        .join(" ");
      const truncatedPrompt = p.promptText.length > 60 ? p.promptText.slice(0, 57) + "..." : p.promptText;

      lines.push(`| ${truncatedPrompt} | ${p.cluster} | ${score} | ${mentioned} | ${cited} | ${engineSummary} |`);
    }

    // Clusters summary
    const clusterCounts = new Map<string, { total: number; mentioned: number; cited: number }>();
    for (const p of prompts) {
      const key = p.cluster;
      const existing = clusterCounts.get(key) ?? { total: 0, mentioned: 0, cited: 0 };
      existing.total++;
      if (p.brandMentioned) existing.mentioned++;
      if (p.brandUrlCited) existing.cited++;
      clusterCounts.set(key, existing);
    }

    lines.push(``, `### Cluster Summary`);
    for (const [key, counts] of clusterCounts) {
      lines.push(`- **${key}:** ${counts.mentioned}/${counts.total} mentioned, ${counts.cited}/${counts.total} cited`);
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`GEO Visibility MCP server running (API: ${BASE_URL})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
