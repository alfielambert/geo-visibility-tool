"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { Play, RefreshCw, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useProjectApi } from "@/lib/use-api";

interface RunData {
  id: string;
  triggerType: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalPromptRuns: number;
  completedPromptRuns: number;
  failedPromptRuns: number;
}

interface EngineStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
}

interface RunDetail {
  uniqueErrors: Array<{ engine: string; error: string }>;
  summary: { total: number; completed: number; failed: number; pending: number; running: number };
  engineStats: Record<string, EngineStats>;
  currentPromptText: string | null;
}

export default function RunHistoryPage() {
  const { activeProject } = useProject();
  const { apiFetch } = useProjectApi();
  const [runs, setRuns] = useState<RunData[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunDetail>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeProgress, setActiveProgress] = useState<RunDetail | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await apiFetch("/api/runs");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setRuns(data.runs ?? []);
        setError(null);

        // Detect if there's a currently running run
        const running = (data.runs ?? []).find((r: RunData) => r.status === "running");
        if (running) {
          setActiveRunId(running.id);
        } else {
          setActiveRunId(null);
          setActiveProgress(null);
        }
      }
    } catch {
      setError("Failed to fetch runs");
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll progress for the active run
  const pollProgress = useCallback(async () => {
    if (!activeRunId) return;
    try {
      const res = await apiFetch(`/api/runs/${activeRunId}`);
      const data = await res.json();
      setActiveProgress(data);

      // If the run is no longer running, stop polling and refresh
      if (data.run?.status !== "running") {
        setActiveRunId(null);
        setActiveProgress(null);
        fetchRuns();
      }
    } catch {
      // Silently continue polling
    }
  }, [activeRunId, fetchRuns]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeProject) return;
    fetchRuns();
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up polling when there's an active run
  useEffect(() => {
    if (activeRunId) {
      pollProgress(); // immediate first poll
      pollRef.current = setInterval(pollProgress, 2000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRunId, pollProgress]);

  const triggerRun = async () => {
    setTriggering(true);
    setError(null);
    try {
      const res = await apiFetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerType: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to trigger run");
      } else {
        // Run started in background — start polling
        if (data.runId) {
          setActiveRunId(data.runId);
        }
        await fetchRuns();
      }
    } catch {
      setError("Failed to trigger run");
    } finally {
      setTriggering(false);
    }
  };

  const toggleRunDetails = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);

    if (!runDetails[runId]) {
      try {
        const res = await apiFetch(`/api/runs/${runId}`);
        const data = await res.json();
        setRunDetails((prev) => ({ ...prev, [runId]: data }));
      } catch {
        // Silently fail
      }
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-400";
      case "running":
        return "text-yellow-400";
      case "failed":
        return "text-red-400";
      case "partial":
        return "text-orange-400";
      default:
        return "text-slate-400";
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Progress bar component for active run
  const progressCompleted = activeProgress?.summary?.completed ?? 0;
  const progressFailed = activeProgress?.summary?.failed ?? 0;
  const progressTotal = activeProgress?.summary?.total ?? 0;
  const progressDone = progressCompleted + progressFailed;
  const progressPct = progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="heading-1">Run History</h1>
          <p className="text-muted mt-2">
            View and manage past analysis runs
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchRuns}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={triggerRun}
            disabled={triggering || !!activeRunId}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {triggering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {activeRunId ? "Run in Progress" : triggering ? "Starting..." : "Trigger Run"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {/* Live progress panel */}
      {activeRunId && activeProgress && (
        <div className="mb-6 p-5 bg-slate-900 border border-slate-700 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-sm font-medium text-slate-200">
              Run in progress — {progressDone} of {progressTotal} prompt runs complete
            </span>
            <span className="text-xs text-slate-500 ml-auto">{progressPct}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className="h-full flex">
              <div
                className="bg-green-500 transition-all duration-500 ease-out"
                style={{ width: progressTotal > 0 ? `${(progressCompleted / progressTotal) * 100}%` : "0%" }}
              />
              <div
                className="bg-red-500 transition-all duration-500 ease-out"
                style={{ width: progressTotal > 0 ? `${(progressFailed / progressTotal) * 100}%` : "0%" }}
              />
            </div>
          </div>

          {/* Per-engine progress */}
          {activeProgress.engineStats && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              {Object.entries(activeProgress.engineStats).map(([engine, stats]) => (
                <div key={engine} className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-mono uppercase w-20">{engine}</span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full flex">
                      <div
                        className="bg-green-500/80 transition-all duration-500"
                        style={{ width: stats.total > 0 ? `${(stats.completed / stats.total) * 100}%` : "0%" }}
                      />
                      <div
                        className="bg-red-500/80 transition-all duration-500"
                        style={{ width: stats.total > 0 ? `${(stats.failed / stats.total) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                  <span className="text-slate-500 w-12 text-right">{stats.completed}/{stats.total}</span>
                </div>
              ))}
            </div>
          )}

          {/* Current prompt */}
          {activeProgress.currentPromptText && (
            <div className="text-xs text-slate-500 truncate">
              Processing: <span className="text-slate-400 italic">&ldquo;{activeProgress.currentPromptText}&rdquo;</span>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header w-8"></th>
                <th className="table-header">Run ID</th>
                <th className="table-header">Trigger</th>
                <th className="table-header">Started</th>
                <th className="table-header">Status</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Results</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="table-cell py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : runs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell py-8 text-center text-slate-400">
                    No runs yet — click &quot;Trigger Run&quot; to get started
                  </td>
                </tr>
              ) : (
                runs.map((run) => (
                  <Fragment key={run.id}>
                    <tr
                      className="border-b border-slate-800 last:border-b-0 cursor-pointer hover:bg-slate-800/50"
                      onClick={() => toggleRunDetails(run.id)}
                    >
                      <td className="table-cell text-center">
                        {expandedRun === run.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-500 inline" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500 inline" />
                        )}
                      </td>
                      <td className="table-cell font-mono text-xs">
                        {run.id.slice(0, 8)}...
                      </td>
                      <td className="table-cell capitalize">{run.triggerType}</td>
                      <td className="table-cell">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className={`table-cell capitalize font-medium ${statusColor(run.status)}`}>
                        {run.status === "running" ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            running
                          </span>
                        ) : run.status}
                      </td>
                      <td className="table-cell">
                        {formatDuration(run.startedAt, run.completedAt)}
                      </td>
                      <td className="table-cell">
                        <span className="text-green-400">{run.completedPromptRuns}</span>
                        {run.failedPromptRuns > 0 && (
                          <span className="text-red-400"> / {run.failedPromptRuns} failed</span>
                        )}
                        <span className="text-slate-500"> of {run.totalPromptRuns}</span>
                      </td>
                    </tr>
                    {expandedRun === run.id && (
                      <tr key={`${run.id}-detail`} className="border-b border-slate-800">
                        <td colSpan={7} className="px-6 py-4 bg-slate-900/50">
                          {runDetails[run.id]?.uniqueErrors?.length ? (
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                <span className="text-sm font-medium text-red-300">
                                  Errors ({runDetails[run.id].uniqueErrors.length} unique)
                                </span>
                              </div>
                              <div className="space-y-2">
                                {runDetails[run.id].uniqueErrors.map((e, i) => (
                                  <div
                                    key={i}
                                    className="p-3 bg-red-950/30 border border-red-900/50 rounded text-sm"
                                  >
                                    <span className="text-red-400 font-mono text-xs mr-2">
                                      [{e.engine}]
                                    </span>
                                    <span className="text-red-200">{e.error}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">
                              {run.status === "completed"
                                ? "All prompt runs completed successfully."
                                : run.status === "running"
                                  ? "Run is still in progress..."
                                  : "Loading details..."}
                            </p>
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
