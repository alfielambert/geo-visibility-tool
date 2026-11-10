"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/lib/project-context";
import { useProjectApi } from "@/lib/use-api";
import { MetricCard } from "@/components/MetricCard";
import {
  TrendingUp,
  Target,
  MessageCircle,
  Quote,
  Zap,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface OverviewData {
  hasData: boolean;
  runId?: string;
  runDate?: string;
  prevRunDate?: string | null;
  visibilityScore?: number | null;
  mentionRate?: number | null;
  citationRate?: number | null;
  volatility?: number | null;
  redditCitationRate?: number | null;
  deltas?: {
    visibilityScore: number | null;
    mentionRate: number | null;
    citationRate: number | null;
    redditCitationRate: number | null;
  };
  topCompetitor?: { name: string; mentions: number } | null;
  topOpportunity?: {
    title: string;
    summary: string;
    priorityScore: number;
  } | null;
}

export default function OverviewPage() {
  const { activeProject } = useProject();
  const { apiFetch } = useProjectApi();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    apiFetch("/api/overview")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ hasData: false }))
      .finally(() => setLoading(false));
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const fmt = (v: number | null | undefined, suffix = "") => {
    if (v === null || v === undefined) return "—";
    return `${v.toFixed(1)}${suffix}`;
  };

  const pct = (v: number | null | undefined) => {
    if (v === null || v === undefined) return "—";
    return `${(v * 100).toFixed(0)}%`;
  };

  const deltas = data?.deltas;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="heading-1">Overview</h1>
        <p className="text-muted mt-2">
          Track {activeProject?.brandName ?? "your"} visibility and engagement metrics
          {data?.runDate && (
            <span className="ml-2 text-slate-500">
              — last run: {new Date(data.runDate).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      {/* Top Row - Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Project Visibility Score"
          value={fmt(data?.visibilityScore)}
          subtitle="Overall competitive visibility (0–100)"
          icon={<TrendingUp className="w-6 h-6" />}
          delta={deltas?.visibilityScore}
          deltaFormat="points"
        />
        <MetricCard
          title="Mention Rate"
          value={pct(data?.mentionRate)}
          subtitle={`Prompts where ${activeProject?.brandName ?? "brand"} is mentioned`}
          icon={<MessageCircle className="w-6 h-6" />}
          delta={deltas?.mentionRate}
          deltaFormat="pct"
        />
        <MetricCard
          title="Citation Rate"
          value={pct(data?.citationRate)}
          subtitle={`Prompts where ${activeProject?.domain ?? "your site"} is cited`}
          icon={<Quote className="w-6 h-6" />}
          delta={deltas?.citationRate}
          deltaFormat="pct"
        />
        <MetricCard
          title="Reddit Citation Rate"
          value={pct(data?.redditCitationRate)}
          subtitle="AI citations sourced from Reddit"
          icon={<Target className="w-6 h-6" />}
          delta={deltas?.redditCitationRate}
          deltaFormat="pct"
        />
      </div>

      {/* Bottom Row - Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricCard
          title="Top Competitor"
          subtitle="By mention volume"
          icon={<Zap className="w-6 h-6" />}
        >
          <div className="mt-4 pt-4 border-t border-slate-800">
            {data?.topCompetitor ? (
              <div>
                <p className="text-xl font-semibold text-slate-100">
                  {data.topCompetitor.name}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {data.topCompetitor.mentions} mentions across prompts
                </p>
              </div>
            ) : (
              <p className="text-slate-400">
                No data yet — trigger a run to get started
              </p>
            )}
          </div>
        </MetricCard>

        <MetricCard
          title="Top Recommendation"
          subtitle="Highest priority opportunity"
          icon={<AlertCircle className="w-6 h-6" />}
        >
          <div className="mt-4 pt-4 border-t border-slate-800">
            {data?.topOpportunity ? (
              <div>
                <p className="text-sm font-medium text-slate-200">
                  {data.topOpportunity.title}
                </p>
                <p className="text-sm text-slate-400 mt-2 line-clamp-3">
                  {data.topOpportunity.summary}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Priority: {(data.topOpportunity.priorityScore * 100).toFixed(0)}%
                </p>
              </div>
            ) : (
              <p className="text-slate-400">
                No data yet — trigger a run to get started
              </p>
            )}
          </div>
        </MetricCard>
      </div>
    </div>
  );
}
