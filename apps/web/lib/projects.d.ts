/**
 * Project CRUD service
 *
 * Handles all Firestore operations for projects.
 * Uses subcollection pattern: users/{userId}/projects/{projectId}
 * Works with both Admin SDK (server) and Client SDK (browser)
 */
import type { NewProject, ProjectStatus, ProjectInfo } from "../../../packages/core/src/models/project";
import type { ProjectDeliveryLogResponse } from "../../../packages/core/src/models/delivery-log";
/**
 * Create a new project for a user
 */
export declare function createProject(data: NewProject): Promise<ProjectInfo>;
/**
 * List all projects for a user (one-time fetch)
 */
export declare function listProjects(): Promise<ProjectInfo[]>;
/**
 * Subscribe to projects for a user (real-time updates)
 * Returns an unsubscribe function
 */
export declare function subscribeToProjects(callback: (projects: ProjectInfo[]) => void): () => void;
export declare class ProjectError extends Error {
    errorCode?: string;
    errorMessage?: string;
    constructor(message: string, errorCode?: string, errorMessage?: string);
}
/**
 * Update project status
 */
export declare function updateProjectStatus(projectTitle: string, status: ProjectStatus): Promise<boolean>;
/**
 * Update project execution tracking after a research run
 */
/**
 * Update a project with partial data
 */
export declare function updateProject(projectTitle: string, data: Partial<Omit<ProjectInfo, "createdAt" | "updatedAt">>): Promise<void>;
/**
 * Delete a project
 */
export declare function deleteProject(projectTitle: string): Promise<void>;
/**
 * Get delivery logs for a project
 */
export declare function getProjectDeliveryLogs(projectTitle: string, limit?: number, offset?: number): Promise<ProjectDeliveryLogResponse>;
//# sourceMappingURL=projects.d.ts.map