/**
 * useProjects hook
 *
 * Provides real-time access to a user's projects and methods to create new ones.
 */

import { useState, useEffect, useCallback } from "react";
import type { Project, NewProject } from "../models/project";
import {
  subscribeToProjects,
  createProject as createProjectService,
} from "../services/projects";

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (data: Omit<NewProject, "userId">) => Promise<Project | null>;
}

export function useProjects(userId: string | undefined): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToProjects(userId, (newProjects) => {
      setProjects(newProjects);
      setLoading(false);
    });

    return unsubscribe;
  }, [userId]);

  const createProject = useCallback(
    async (data: Omit<NewProject, "userId">): Promise<Project | null> => {
      if (!userId) {
        setError("User must be logged in to create a project");
        return null;
      }

      try {
        const newProject = await createProjectService(userId, data);
        return newProject;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create project";
        setError(errorMessage);
        return null;
      }
    },
    [userId]
  );

  return { projects, loading, error, createProject };
}
