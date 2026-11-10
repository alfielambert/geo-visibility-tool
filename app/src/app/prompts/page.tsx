"use client";

import { useState, useEffect, Fragment } from "react";
import { Loader2, Check, X, Minus, ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useProjectApi } from "@/lib/use-api";

interface EngineResult {
  engine: string;
  brandMentioned: boolean;
  brandUrlCited: boolean;
  brandPosition: number | null;
  brandMentionStrength: string;
  brandSentiment: string;
  brandSummary: string | null;
  competitorCount: number;
  answerFormat: string;
  confidenceScore: number;
  rawResponse: string | null;
  latencyMs: number | null;
}

interface PromptData {
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
  engines: EngineResult[];
}

export default function PromptsPage() {
  const { activeProject } = useProject();
  const { apiFetch } = useProjectApi();
  const [prompts, setPrompts] = useState<PromptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);
  const [showResponse, setShowResponse] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    apiFetch("/api/prompts")
      .then((r) => r.json())
      .then((data) => setPrompts(data.prompts ?? []))
      .catch(() => setPrompts([]))
      .finally(() => setLoading(false));
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = prompts.filter(
    (p) =>
      p.promptText.toLowerCase().includes(filter.toLowerCase()) ||
      p.cluster.toLowerCase().includes(filter.toLowerCase())
  );

  const scoreColor = (score: number | null) => {
    if (score === null) return "text-slate-500";
    if (score >= 0.6) return "text-green-400";
    if (score >= 0.3) return "text-yellow-400";
    return "text-red-400";
  };

  const strengthColor = (strength: string) => {
    switch (strength) {
      case "strong": return "text-green-400";
      case "moderate": return "text-yellow-400";
      case "weak": return "text-orange-400";
      default: return "text-slate-500";
    }
  };

  const boolIcon = (v: boolean | null) => {
    if (v === null) return <Minus className="w-4 h-4 text-slate-600" />;
    return v ? (
      <Check className="w-4 h-4 text-green-400" />
    ) : (
      <X className="w-4 h-4 text-red-400" />
    );
  };

  const engineLabel = (engine: string) => {
    switch (engine) {
      case "openai": return "GPT-4o";
      case "anthropic": return "Claude";
      default: return engine;
    }
  };

  // Per-engine mention indicators inline
  const engineIndicators = (engines: EngineResult[]) => {
    if (engines.length === 0) return <span className="text-slate-600">—</span>;
    return (
      <div className="flex gap-1.5">
        {engines.map((e) => (
          <span
            key={e.engine}
            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-mono ${
              e.brandMentioned
                ? "bg-green-950/50 text-green-400 border border-green-900/50"
                : "bg-slate-800 text-slate-500 border border-slate-700/50"
            }`}
            title={`${engineLabel(e.engine)}: ${e.brandMentioned ? "mentioned" : "not mentioned"}`}
          >
            {engineLabel(e.engine)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="heading-1">Prompts</h1>
        <p className="text-muted mt-2">
          Manage and explore analysis prompts ({prompts.length} total)
        </p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Filter by prompt text or cluster..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-700"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-8"></th>
                <th className="table-header">Prompt</th>
                <th className="table-header">Cluster</th>
                <th className="table-header">Score</th>
                <th className="table-header">Appears in</th>
                <th className="table-header">Cited</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="table-cell py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-cell py-8 text-center text-slate-400">
                    {prompts.length === 0
                      ? "No prompts found — run db:seed first"
                      : "No prompts match your filter"}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <Fragment key={p.id}>
                    <tr
                      className="border-b border-slate-800 last:border-b-0 cursor-pointer hover:bg-slate-800/50"
                      onClick={() => setExpandedPrompt(expandedPrompt === p.id ? null : p.id)}
                    >
                      <td className="table-cell text-center">
                        {expandedPrompt === p.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-500 inline" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500 inline" />
                        )}
                      </td>
                      <td className="table-cell max-w-md">
                        <p className="text-sm text-slate-200 truncate" title={p.promptText}>
                          {p.promptText}
                        </p>
                      </td>
                      <td className="table-cell">
                        <span className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                          {p.cluster}
                        </span>
                      </td>
                      <td className={`table-cell text-center font-mono font-medium ${scoreColor(p.visibilityScore)}`}>
                        {p.visibilityScore !== null
                          ? (p.visibilityScore * 100).toFixed(0) + "%"
                          : "—"}
                      </td>
                      <td className="table-cell">{engineIndicators(p.engines)}</td>
                      <td className="table-cell text-center">{boolIcon(p.brandUrlCited)}</td>
                    </tr>

                    {/* Expanded detail: per-engine breakdown */}
                    {expandedPrompt === p.id && (
                      <tr key={`${p.id}-detail`} className="border-b border-slate-800">
                        <td colSpan={6} className="px-6 py-4 bg-slate-900/50">
                          {p.engines.length === 0 ? (
                            <p className="text-sm text-slate-400">No observation data yet for this prompt.</p>
                          ) : (
                            <div className="space-y-4">
                              {p.engines.map((e) => {
                                const responseKey = `${p.id}-${e.engine}`;
                                return (
                                  <div key={e.engine} className="border border-slate-800 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-3">
                                        <span className="font-mono text-sm font-medium text-slate-200">
                                          {engineLabel(e.engine)}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                          e.brandMentioned
                                            ? "bg-green-950/50 text-green-400"
                                            : "bg-red-950/30 text-red-400"
                                        }`}>
                                          {e.brandMentioned ? "Mentioned" : "Not mentioned"}
                                        </span>
                                        {e.brandUrlCited && (
                                          <span className="text-xs px-2 py-0.5 rounded bg-blue-950/50 text-blue-400">
                                            URL cited
                                          </span>
                                        )}
                                      </div>
                                      {e.rawResponse && (
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation();
                                            setShowResponse(showResponse === responseKey ? null : responseKey);
                                          }}
                                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                        >
                                          {showResponse === responseKey ? (
                                            <><EyeOff className="w-3.5 h-3.5" /> Hide response</>
                                          ) : (
                                            <><Eye className="w-3.5 h-3.5" /> View response</>
                                          )}
                                        </button>
                                      )}
                                    </div>

                                    {/* Metadata grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                      <div>
                                        <span className="text-slate-500">Strength</span>
                                        <p className={`font-medium capitalize ${strengthColor(e.brandMentionStrength)}`}>
                                          {e.brandMentionStrength}
                                        </p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Position</span>
                                        <p className="text-slate-200">{e.brandPosition ?? "—"}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Competitors</span>
                                        <p className="text-slate-200">{e.competitorCount}</p>
                                      </div>
                                      <div>
                                        <span className="text-slate-500">Format</span>
                                        <p className="text-slate-200 capitalize">{e.answerFormat.replace(/_/g, " ")}</p>
                                      </div>
                                    </div>

                                    {/* Brand summary */}
                                    {e.brandSummary && (
                                      <p className="mt-3 text-xs text-slate-400 italic">
                                        {e.brandSummary}
                                      </p>
                                    )}

                                    {/* Raw response */}
                                    {showResponse === responseKey && e.rawResponse && (
                                      <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                                        {e.rawResponse}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
