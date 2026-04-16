"use client";

import { useProject } from "./project-context";

/**
 * Returns a fetch wrapper that appends ?projectId= to API calls.
 */
export function useProjectApi() {
  const { activeProject } = useProject();

  const apiFetch = (path: string, init?: RequestInit) => {
    const separator = path.includes("?") ? "&" : "?";
    const url = activeProject
      ? `${path}${separator}projectId=${activeProject.id}`
      : path;
    return fetch(url, init);
  };

  return { apiFetch, projectId: activeProject?.id ?? null };
}
