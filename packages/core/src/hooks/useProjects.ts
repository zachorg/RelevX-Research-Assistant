/**
 * useProjects hook
 *
 * Provides real-time access to a user's projects and methods to manage them.
 *
 * @param userId - The user ID to fetch projects for
 * @param dbInstance - Optional Firebase Firestore instance (defaults to core's Firebase instance)
 * @param isAdminSDK - Optional flag indicating if using Admin SDK (defaults to core's default)
 */

import { useState, useEffect, useCallback } from "react";
import type { Project, NewProject, ProjectStatus } from "../models/project";
import {
  subscribeToProjects,
  createProject as createProjectService,
  updateProject as updateProjectService,
  updateProjectStatus,
  deleteProject as deleteProjectService,
} from "../services/projects";

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (data: Omit<NewProject, "userId">) => Promise<Project | null>;
  updateProject: (
    projectId: string,
    data: Partial<Omit<Project, "id" | "userId" | "createdAt">>
  ) => Promise<boolean>;
  toggleProjectActive: (
    projectId: string,
    status: ProjectStatus
  ) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
}

export function useProjects(
  userId: string | undefined,
  dbInstance?: any,
  isAdminSDK?: boolean
): UseProjectsResult {
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

    const unsubscribe = subscribeToProjects(
      userId,
      (newProjects) => {
        setProjects(newProjects);
        setLoading(false);
      },
      dbInstance,
      isAdminSDK
    );

    return unsubscribe;
  }, [userId, dbInstance, isAdminSDK]);

  const createProject = useCallback(
    async (data: Omit<NewProject, "userId">): Promise<Project | null> => {
      if (!userId) {
        setError("User must be logged in to create a project");
        return null;
      }

      try {
        const newProject = await createProjectService(
          userId,
          data,
          dbInstance,
          isAdminSDK
        );
        return newProject;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create project";
        setError(errorMessage);
        return null;
      }
    },
    [userId, dbInstance, isAdminSDK]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      data: Partial<Omit<Project, "id" | "userId" | "createdAt">>
    ): Promise<boolean> => {
      if (!userId) {
        setError("User must be logged in to update a project");
        return false;
      }

      try {
        await updateProjectService(
          userId,
          projectId,
          data,
          dbInstance,
          isAdminSDK
        );
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update project";
        setError(errorMessage);
        return false;
      }
    },
    [userId, dbInstance, isAdminSDK]
  );

  const toggleProjectActive = useCallback(
    async (projectId: string, status: ProjectStatus): Promise<boolean> => {
      if (!userId) {
        setError("User must be logged in to toggle project status");
        return false;
      }

      try {
        await updateProjectStatus(
          userId,
          projectId,
          status,
          dbInstance,
          isAdminSDK
        );
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to toggle project status";
        setError(errorMessage);
        return false;
      }
    },
    [userId, dbInstance, isAdminSDK]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!userId) {
        setError("User must be logged in to delete a project");
        return false;
      }

      try {
        await deleteProjectService(userId, projectId, dbInstance, isAdminSDK);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete project";
        setError(errorMessage);
        return false;
      }
    },
    [userId, dbInstance, isAdminSDK]
  );

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    toggleProjectActive,
    deleteProject,
  };
}
