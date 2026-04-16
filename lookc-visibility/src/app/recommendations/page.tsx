"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Lightbulb,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Users,
  FileText,
  ExternalLink,
  Target,
} from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useProjectApi } from "@/lib/use-api";

interface CandidateEvidence {
  promptId: string;
  promptText: string;
  brandScore: number;
  topCompetitor: string;
  topCompetitorScore: number;
  redditCitationRate?: number;
}

interface Evidence {
  runId?: string;
  candidates?: CandidateEvidence[];
  dominantThemes?: string[];
  missingThemes?: string[];
  topCompetitors?: string[];
  citedDomains?: string[];
  redditCitationRate?: number;
}

interface Recommendation {
  id: string;
  title: string;
  summary: string;
  opportunityType: string;
  recommendedPageType: string;
  priorityScore: number;
  confidenceScore: number;
  status: string;
  clusterLabel: string | null;
  createdAt: string;
  evidence: Evidence;
}

export default function RecommendationsPage() {
  const { activeProject } = useProject();
  const { apiFetch } = useProjectApi();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    apiFetch("/api/recommendations")
      .then((r) => r.json())
      .then((data) => setRecommendations(data.recommendations ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const priorityColor = (score: number) => {
    if (score >= 0.7) return "border-red-500/30 bg-red-950/20";
    if (score >= 0.5) return "border-yellow-500/30 bg-yellow-950/20";
    return "border-blue-500/30 bg-blue-950/20";
  };

  const priorityLabel = (score: number) => {
    if (score >= 0.7) return "High Priority";
    if (score >= 0.5) return "Medium Priority";
    return "Low Priority";
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="heading-1">Recommendations</h1>
        <p className="text-muted mt-2">
          Evidence-backed content and positioning recommendations
          {recommendations.length > 0 && (
            <span className="ml-2">({recommendations.length} total)</span>
          )}
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="card p-12 text-center">
          <Lightbulb className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">
            No recommendations yet — trigger a run to generate insights
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Recommendations are generated when brand visibility scores fall below
            thresholds and competitors dominate specific clusters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const isReddit =
              rec.opportunityType === "reddit_presence" ||
              rec.recommendedPageType === "reddit_thread";
            const isExpanded = expandedId === rec.id;
            const ev = rec.evidence;

            return (
              <div
                key={rec.id}
                className={`rounded-lg border ${priorityColor(rec.priorityScore)}`}
              >
                {/* Header — always visible */}
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {isReddit ? (
                        <MessageCircle className="w-5 h-5 text-orange-400" />
                      ) : (
                        <Lightbulb className="w-5 h-5 text-slate-400" />
                      )}
                      <span className="text-xs font-medium text-slate-400 uppercase">
                        {priorityLabel(rec.priorityScore)}
                      </span>
                      {isReddit && (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-950/50 text-orange-400 border border-orange-900/50">
                          Reddit
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {isExpanded ? "Close" : "View brief"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-100 mb-2">
                    {rec.title}
                  </h3>

                  <p className="text-sm text-slate-300 leading-relaxed mb-4">
                    {rec.summary}
                  </p>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    {rec.clusterLabel && (
                      <span className="px-2 py-0.5 bg-slate-800 rounded">
                        {rec.clusterLabel}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded capitalize ${
                        isReddit
                          ? "bg-orange-950/30 text-orange-400"
                          : "bg-slate-800"
                      }`}
                    >
                      {rec.recommendedPageType.replace(/_/g, " ")}
                    </span>
                    <span>
                      Confidence: {(rec.confidenceScore * 100).toFixed(0)}%
                    </span>
                    <span>
                      Priority: {(rec.priorityScore * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && ev && (
                  <div className="border-t border-slate-800/50 px-6 pb-6 pt-5 space-y-6">
                    {/* Prompts you're missing from */}
                    {ev.candidates && ev.candidates.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Search className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                            Searches you&apos;re not appearing in
                          </h4>
                        </div>
                        <div className="space-y-2">
                          {ev.candidates.map((c, i) => (
                            <div
                              key={i}
                              className="flex items-start justify-between p-3 bg-slate-900/60 rounded-lg border border-slate-800/50"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-slate-200 leading-snug">
                                  &ldquo;{c.promptText}&rdquo;
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Your score: {(c.brandScore * 100).toFixed(0)}%
                                  {c.topCompetitor && (
                                    <span>
                                      {" "}— <span className="text-red-400">{c.topCompetitor}</span> scores {(c.topCompetitorScore * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Competitors dominating this space */}
                    {ev.topCompetitors && ev.topCompetitors.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                            Competitors dominating this space
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ev.topCompetitors.map((comp) => (
                            <span
                              key={comp}
                              className="px-3 py-1.5 bg-red-950/30 border border-red-900/40 rounded-lg text-sm text-red-300"
                            >
                              {comp}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Themes to cover in your content */}
                    {((ev.dominantThemes && ev.dominantThemes.length > 0) ||
                      (ev.missingThemes && ev.missingThemes.length > 0)) && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                            Topics and themes to cover
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {ev.missingThemes && ev.missingThemes.length > 0 && (
                            <div>
                              <p className="text-xs text-red-400 font-medium mb-2">
                                Missing from your presence
                              </p>
                              <div className="space-y-1">
                                {ev.missingThemes.map((theme) => (
                                  <div
                                    key={theme}
                                    className="flex items-center gap-2 text-sm text-slate-300"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                                    {theme}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {ev.dominantThemes && ev.dominantThemes.length > 0 && (
                            <div>
                              <p className="text-xs text-blue-400 font-medium mb-2">
                                Dominant themes in AI responses
                              </p>
                              <div className="space-y-1">
                                {ev.dominantThemes.map((theme) => (
                                  <div
                                    key={theme}
                                    className="flex items-center gap-2 text-sm text-slate-300"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                    {theme}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {/* Domains being cited */}
                    {ev.citedDomains && ev.citedDomains.length > 0 && (
                      <section>
                        <div className="flex items-center gap-2 mb-3">
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                            Domains AI models are citing
                          </h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {ev.citedDomains.map((domain) => (
                            <span
                              key={domain}
                              className="px-2.5 py-1 bg-slate-800 border border-slate-700/50 rounded text-xs text-slate-300 font-mono"
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* Content brief */}
                    <section className="p-4 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-green-400" />
                        <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                          Content brief
                        </h4>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-slate-500">Format:</span>{" "}
                          <span className="text-slate-200 capitalize">
                            {rec.recommendedPageType.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Target queries:</span>
                          <div className="mt-1 space-y-1">
                            {(ev.candidates ?? []).map((c, i) => (
                              <p key={i} className="text-slate-300 text-xs pl-3 border-l-2 border-slate-700">
                                {c.promptText}
                              </p>
                            ))}
                          </div>
                        </div>
                        {ev.missingThemes && ev.missingThemes.length > 0 && (
                          <div>
                            <span className="text-slate-500">Must cover:</span>{" "}
                            <span className="text-slate-200">
                              {ev.missingThemes.join(", ")}
                            </span>
                          </div>
                        )}
                        {ev.topCompetitors && ev.topCompetitors.length > 0 && (
                          <div>
                            <span className="text-slate-500">Position against:</span>{" "}
                            <span className="text-slate-200">
                              {ev.topCompetitors.join(", ")}
                            </span>
                          </div>
                        )}
                        {ev.citedDomains && ev.citedDomains.length > 0 && (
                          <div>
                            <span className="text-slate-500">Reference / outperform:</span>{" "}
                            <span className="text-slate-200 font-mono text-xs">
                              {ev.citedDomains.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
