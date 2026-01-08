/**
 * Project CRUD service
 *
 * Handles all Firestore operations for projects.
 * Uses subcollection pattern: users/{userId}/projects/{projectId}
 * Works with both Admin SDK (server) and Client SDK (browser)
 */

import type {
  NewProject,
  ProjectStatus,
  ListProjectsResponse,
  ProjectInfo,
  CreateProjectResponse,
  CreateProjectRequest,
  ToggleProjectStatusResponse,
} from "../../../packages/core/src/models/project";
import type {
  ProjectDeliveryLogResponse,
  RelevxDeliveryLog,
} from "../../../packages/core/src/models/delivery-log";
import { relevx_api } from "@/lib/client";

/**
 * Create a new project for a user
 */
export async function createProject(data: NewProject): Promise<ProjectInfo> {
  try {
    // Set default settings if not provided
    const settings = data.settings || {
      relevancyThreshold: 60,
      minResults: 5,
      maxResults: 20,
    };

    const projectData: NewProject = {
      title: data.title,
      description: data.description,
      frequency: data.frequency,
      resultsDestination: data.resultsDestination,
      deliveryTime: data.deliveryTime,
      timezone: data.timezone,
      searchParameters: data.searchParameters,
      settings,
      deliveryConfig: data.deliveryConfig,
    };
    const request: CreateProjectRequest = {
      projectInfo: projectData,
    };

    const response = await relevx_api.post<CreateProjectResponse>(
      `/api/v1/user/projects/create`,
      {
        ...request,
      }
    );
    if (!response) {
      throw new Error("Failed to create project");
    }

    return response.project;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

/**
 * List all projects for a user (one-time fetch)
 */
export async function listProjects(): Promise<ProjectInfo[]> {
  const response = await relevx_api.get<ListProjectsResponse>(
    `/api/v1/user/projects/list`
  );
  if (!response) {
    throw new Error("Failed to list projects");
  }

  return response.projects;
}

/**
 * Subscribe to projects for a user (real-time updates)
 * Returns an unsubscribe function
 */
export function subscribeToProjects(
  callback: (projects: ProjectInfo[]) => void
): () => void {
  // We use the backend WebSocket for real-time updates
  // Authentication is handled by passing the token in the query or first message
  // Since we are in core, we need to know the API base URL.
  // We'll assume the same base URL as relevx_api but with ws/wss protocol.

  let socket: WebSocket | null = null;
  let isClosed = false;

  const connect = async () => {
    try {
      if (isClosed) return;

      const auth = require("./firebase").auth;
      const idToken = await auth.currentUser?.getIdToken(true);

      // Get base URL from environment or fallback
      const baseUrl =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";
      const wsUrl =
        baseUrl.replace(/^http/, "ws") + "/api/v1/user/projects/subscribe";

      // Fastify-websocket expects the token. We'll send it as a protocol or query param
      // or just rely on the session if cookies are used. But here we use Bearer.
      // Fastify-websocket doesn't easily support custom headers in browser WebSocket API.
      // We'll use a query parameter for the token.
      socket = new WebSocket(`${wsUrl}?token=${idToken}`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.connected) {
            console.log("WebSocket connected");
          } else if (data.projects) {
            callback(data.projects);
          } else if (data.error) {
            console.error("WebSocket error message:", data.error);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      socket.onclose = () => {
        if (!isClosed) {
          // Reconnect with exponential backoff could be added here
          setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error("WebSocket error:", err);
        socket?.close();
      };
    } catch (err) {
      console.error("Failed to connect to WebSocket:", err);
      setTimeout(connect, 5000);
    }
  };

  connect();

  return () => {
    isClosed = true;
    socket?.close();
  };
}

// Custom error class to propagate structured backend errors to the UI
export class ProjectError extends Error {
  errorCode?: string;
  errorMessage?: string;

  constructor(message: string, errorCode?: string, errorMessage?: string) {
    super(message);
    this.name = "ProjectError";
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
  }
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  projectTitle: string,
  status: ProjectStatus
): Promise<boolean> {
  const response = await relevx_api.post<ToggleProjectStatusResponse>(
    "/api/v1/user/projects/toggle-status",
    {
      title: projectTitle,
      status,
    }
  );
  if (!response) {
    throw new Error("Failed to update project status");
  }

  if (response.errorCode) {
    throw new ProjectError(
      response.errorMessage || "Error updating project",
      response.errorCode,
      response.errorMessage
    );
  }

  return response.status === status;
}

/**
 * Update project execution tracking after a research run
 */
// export async function updateProjectExecution(
//   userId: string,
//   projectId: string,
//   updates: {
//     status?: ProjectStatus;
//     lastRunAt?: number;
//     nextRunAt?: number;
//     lastError?: string;
//   },
//   dbInstance?: any,
//   isAdminSDK?: boolean
// ): Promise<void> {
//   // This is typically called from the backend/worker, so it might still use Firestore directly
//   // or we can add a route for it. For now, let's keep it if it's Admin SDK.
//   if (isAdminSDK) {
//     const projectRef = getProjectRef(userId, projectId, dbInstance, isAdminSDK);
//     const updateData = {
//       ...updates,
//       updatedAt: Date.now(),
//     };
//     await projectRef.update(updateData);
//     return;
//   }

//   // If called from client, we should use the update route
//   // Note: we'd need the title here too.
//   throw new Error("updateProjectExecution should only be called by Admin SDK");
// }

/**
 * Update a project with partial data
 */
export async function updateProject(
  projectTitle: string,
  data: Partial<Omit<ProjectInfo, "createdAt" | "updatedAt">>
): Promise<void> {
  const title = projectTitle;
  const response = await relevx_api.post("/api/v1/user/projects/update", {
    title,
    data,
  });
  if (!response) {
    throw new Error("Failed to update project");
  }
}

/**
 * Delete a project
 */
export async function deleteProject(projectTitle: string): Promise<void> {
  const title = projectTitle;
  const response = await relevx_api.post("/api/v1/user/projects/delete", {
    title,
  });
  if (!response) {
    throw new Error("Failed to delete project");
  }
}

/**
 * Get delivery logs for a project
 */
export async function getProjectDeliveryLogs(
  projectTitle: string,
  limit: number = 5,
  offset: number = 0
): Promise<ProjectDeliveryLogResponse> {
  try {
    const response = await relevx_api.get<ProjectDeliveryLogResponse>(
      `/api/v1/user/projects/delivery-logs?limit=${limit}&offset=${offset}`,
      { projectId: projectTitle }
    );
    if (!response) {
      throw new Error("Failed to fetch delivery logs");
    }
    return response;
  } catch (error: any) {
    // Return empty result for 404 (no logs yet)
    if (error?.status === 404) {
      return {
        logs: [],
        pagination: { total: 0, limit, offset, hasMore: false },
      };
    }
    throw error;
  }
}
