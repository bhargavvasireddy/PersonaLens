"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createProject as apiCreateProject, getProjects } from "@/lib/api";
import { Project } from "@/lib/types";

const PROJECT_STORAGE_KEY = "personaLens.selectedProjectId";

type ProjectContextValue = {
  projects: Project[];
  selectedProjectId: string;
  selectedProject: Project | null;
  loading: boolean;
  error: string;
  creating: boolean;
  selectProject: (projectId: string) => void;
  createProject: (name: string) => Promise<Project>;
  refreshProjects: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

function getStoredProjectId(): string {
  try {
    return localStorage.getItem(PROJECT_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeProjectId(projectId: string) {
  try {
    localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
  } catch {
    /* ignore */
  }
}

function resolveSelectedProjectId(projects: Project[], preferredProjectId: string): string {
  if (preferredProjectId && projects.some((project) => String(project.id) === preferredProjectId)) {
    return preferredProjectId;
  }

  const storedProjectId = getStoredProjectId();
  if (storedProjectId && projects.some((project) => String(project.id) === storedProjectId)) {
    return storedProjectId;
  }

  return projects.length > 0 ? String(projects[0].id) : "";
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function refreshProjects() {
    setLoading(true);
    try {
      const rows = await getProjects();
      setProjects(rows);
      setError("");
      setSelectedProjectId((current) => {
        const next = resolveSelectedProjectId(rows, current);
        if (next) {
          storeProjectId(next);
        }
        return next;
      });
    } catch (err) {
      setProjects([]);
      setSelectedProjectId("");
      setError(err instanceof Error ? err.message : "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshProjects();
  }, []);

  function selectProject(projectId: string) {
    setSelectedProjectId(projectId);
    if (projectId) {
      storeProjectId(projectId);
    }
  }

  async function createProject(name: string) {
    setCreating(true);
    try {
      const created = await apiCreateProject({ name });
      setProjects((prev) => [created, ...prev.filter((project) => project.id !== created.id)]);
      setError("");
      selectProject(String(created.id));
      return created;
    } catch (err) {
      throw (err instanceof Error ? err : new Error("Unable to create project."));
    } finally {
      setCreating(false);
    }
  }

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  );

  const value = useMemo(
    () => ({
      projects,
      selectedProjectId,
      selectedProject,
      loading,
      error,
      creating,
      selectProject,
      createProject,
      refreshProjects,
    }),
    [projects, selectedProjectId, selectedProject, loading, error, creating]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProjectContext must be used within a ProjectProvider.");
  }
  return context;
}
