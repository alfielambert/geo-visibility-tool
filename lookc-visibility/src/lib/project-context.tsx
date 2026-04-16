"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface Project {
  id: string;
  name: string;
  slug: string;
  domain: string;
  brandName: string;
  status: string;
}

interface ProjectContextValue {
  projects: Project[];
  activeProject: Project | null;
  setActiveProjectId: (id: string) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  activeProject: null,
  setActiveProjectId: () => {},
  refreshProjects: async () => {},
  loading: true,
});

export function useProject() {
  return useContext(ProjectContext);
}

const STORAGE_KEY = "activeProjectId";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const list: Project[] = data.projects ?? [];
      setProjects(list);

      // Restore from localStorage or default to first project
      const stored = localStorage.getItem(STORAGE_KEY);
      const validStored = list.find((p) => p.id === stored);
      if (validStored) {
        setActiveProjectIdState(validStored.id);
      } else if (list.length > 0) {
        setActiveProjectIdState(list[0].id);
        localStorage.setItem(STORAGE_KEY, list[0].id);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        setActiveProjectId,
        refreshProjects: fetchProjects,
        loading,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
