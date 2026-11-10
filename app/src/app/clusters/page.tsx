"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useProject } from "@/lib/project-context";
import { useProjectApi } from "@/lib/use-api";

interface ClusterData {
  id: string;
  key: string;
  label: string;
  description: string | null;
  visibilityScore: number | null;
  promptCount: number;
  dominantThemes: string[];
}

export default function ClustersPage() {
  const { activeProject } = useProject();
  const { apiFetch } = useProjectApi();
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    apiFetch("/api/clusters")
      .then((r) => r.json())
      .then((data) => setClusters(data.clusters ?? []))
      .catch(() => setClusters([]))
      .finally(() => setLoading(false));
  }, [activeProject?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const scoreColor = (score: number | null) => {
    if (score === null) return "text-slate-500";
    if (score >= 60) return "text-green-400";
    if (score >= 30) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="heading-1">Clusters</h1>
        <p className="text-muted mt-2">
          Analyze topic clusters and competitive positioning
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Cluster</th>
                <th className="table-header">Prompts</th>
                <th className="table-header">Visibility Score</th>
                <th className="table-header">Dominant Themes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="table-cell py-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : clusters.length === 0 ? (
                <tr>
                  <td colSpan={4} className="table-cell py-8 text-center text-slate-400">
                    No clusters found
                  </td>
                </tr>
              ) : (
                clusters.map((c) => (
                  <tr key={c.id} className="border-b border-slate-800 last:border-b-0">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-slate-100">{c.label}</p>
                        {c.description && (
                          <p className="text-xs text-slate-500 mt-1">{c.description}</p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-center">{c.promptCount}</td>
                    <td className={`table-cell text-center font-mono font-medium ${scoreColor(c.visibilityScore)}`}>
                      {c.visibilityScore !== null
                        ? c.visibilityScore.toFixed(1)
                        : "—"}
                    </td>
                    <td className="table-cell">
                      {c.dominantThemes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {c.dominantThemes.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
